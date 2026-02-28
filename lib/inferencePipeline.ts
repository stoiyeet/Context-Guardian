// PHASE 2: LLM INTEGRATION POINT
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  listKnowledgeArtifacts,
  type KnowledgeArtifact,
} from "@/lib/knowledgeBase";
import { getOpenAIClient, hasOpenAIKey } from "@/lib/openaiClient";
import {
  loadSynthesizedKnowledge,
  querySynthesizedKnowledge,
  type SynthesizedKnowledgeState,
} from "@/lib/synthesizedKnowledge";
import {
  normalizeVector,
  searchVectorIndex,
  type VectorRecord,
} from "@/lib/vectorUtils";
import type {
  BlueprintType,
  IngestPayload,
  OpsTicket,
  ResolutionStep,
  SMEReference,
  TicketBlueprint,
} from "@/lib/types";
import type {
  ConfidenceBreakdown,
  ConnectionType,
  EvidenceCitation,
  InferenceMetadata,
} from "@/lib/inferenceTypes";

export type InferencePipelineInput = IngestPayload & {
  ticketId: string;
  ingestedAt: string;
};

export type InferencePipelineResult = {
  blueprint: TicketBlueprint;
  metadata: InferenceMetadata;
  blueprintGeneratedAt: string;
};

type RetrievalIntent = "symptom" | "system" | "resolution";

type RetrievalQuery = {
  intent: RetrievalIntent;
  text: string;
  weight: number;
  threshold: number;
};

type ArtifactDocument = {
  id: string;
  artifact: KnowledgeArtifact;
  title: string;
  kind: "slack" | "jira" | "postmortem";
  searchText: string;
  citation: string;
  href: string;
  systems: string[];
};

type ArtifactIndex = {
  docs: ArtifactDocument[];
  vectors: VectorRecord<ArtifactDocument>[] | null;
  model: string;
};

type RetrievedArtifact = {
  document: ArtifactDocument;
  score: number;
  intent: RetrievalIntent;
  connectionType: ConnectionType;
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const SYNTHESIS_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";
const EMBEDDING_FILE = path.join(process.cwd(), "data", "knowledgeEmbeddings.json");
const UNKNOWN_DIAGNOSIS = "No organizational precedent found for this error pattern.";
const LEXICAL_STOPWORDS = new Set([
  "with",
  "from",
  "that",
  "this",
  "path",
  "used",
  "same",
  "systems",
  "match",
  "ticket",
  "error",
  "raw",
  "account",
  "type",
  "resolution",
  "symptom",
  "query",
  "what",
  "when",
  "where",
  "which",
]);

let indexPromise: Promise<ArtifactIndex> | null = null;

function clamp01(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function contextToText(input: InferencePipelineInput): string {
  const context = input.context;
  return normalizeWhitespace(
    [
      `pipeline_stage ${context.pipelineStage}`,
      `attempted_action ${context.attemptedAction}`,
      `last_successful_state ${context.lastSuccessfulState}`,
      `source_institution ${context.sourceInstitution}`,
      `over_contribution ${context.existingFlags.overContributionHistory}`,
      `aml_status ${context.existingFlags.amlStatus}`,
      `pending_reviews ${context.existingFlags.pendingReviews.join(" ")}`,
      `additional_signals ${(context.additionalSignals ?? []).join(" ")}`,
      `operator_narrative ${context.operatorNarrative ?? ""}`,
    ].join(" "),
  );
}

function snippet(value: string, max = 600): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rawErrorClass(rawError: string): string {
  const normalized = rawError.toUpperCase();
  const match = normalized.match(/ERR_(\d{3})/);
  if (match?.[1]) {
    return match[1];
  }
  return normalized.split("_").slice(0, 2).join("_");
}

function isoDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function extractSystems(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  const add = (system: string, ...tokens: string[]) => {
    if (tokens.some((token) => lower.includes(token)) && !out.includes(system)) {
      out.push(system);
    }
  };
  add("ATON", "aton");
  add("CAS", "cas");
  add("bridge", "bridge");
  add("queue", "queue", "retry", "backlog");
  add("ledger", "ledger", "recon");
  add("validator", "validator");
  add("OMS", "oms");
  add("compliance", "compliance", "aml", "cra", "w-8ben", "reg");
  return out;
}

function toSearchText(artifact: KnowledgeArtifact): string {
  if (artifact.type === "slack") {
    const head = artifact.messages.slice(0, 16).map((message) => message.body).join(" ");
    const tail = artifact.messages.slice(-12).map((message) => message.body).join(" ");
    return normalizeWhitespace(`${artifact.title} #${artifact.channel} ${head} ${tail}`);
  }
  if (artifact.type === "jira") {
    return normalizeWhitespace(
      `${artifact.ticketKey} ${artifact.title} ${artifact.summary} ${artifact.technicalDescription} ${artifact.comments
        .slice(0, 12)
        .map((comment) => comment.body)
        .join(" ")}`,
    );
  }
  return normalizeWhitespace(
    `${artifact.title} ${artifact.author} ${artifact.sections.map((section) => `${section.heading} ${section.body}`).join(" ")}`,
  );
}

function toCitation(artifact: KnowledgeArtifact): string {
  if (artifact.type === "slack") {
    const source = artifact.messages[0] ?? artifact.messages[artifact.messages.length - 1];
    if (!source) {
      return `Slack #${artifact.channel}`;
    }
    return `Slack #${artifact.channel}, ${source.sender}, ${isoDate(source.timestamp)}`;
  }
  if (artifact.type === "jira") {
    return `${artifact.ticketKey} (${isoDate(artifact.resolvedAt || artifact.createdAt)})`;
  }
  return `Post-mortem "${artifact.title}" (${isoDate(artifact.publishedAt)})`;
}

function toHref(artifact: KnowledgeArtifact): string {
  if (artifact.type === "slack") {
    const messageId = artifact.messages[0]?.id;
    return messageId
      ? `/knowledge-base?artifact=${artifact.id}&message=${messageId}#${messageId}`
      : `/knowledge-base?artifact=${artifact.id}#${artifact.id}`;
  }
  return `/knowledge-base?artifact=${artifact.id}#${artifact.id}`;
}

function artifactTitle(artifact: KnowledgeArtifact): string {
  if (artifact.type === "jira") {
    return artifact.ticketKey;
  }
  if (artifact.type === "slack") {
    return `#${artifact.channel}`;
  }
  return artifact.title;
}

function buildArtifactDocuments(): ArtifactDocument[] {
  return listKnowledgeArtifacts().map((artifact) => ({
    id: artifact.id,
    artifact,
    kind: artifact.type,
    title: artifactTitle(artifact),
    searchText: snippet(toSearchText(artifact), 4_500),
    citation: toCitation(artifact),
    href: toHref(artifact),
    systems: extractSystems(toSearchText(artifact)),
  }));
}

async function readCachedEmbeddings(): Promise<{
  model: string;
  rows: Array<{ id: string; vector: number[] }>;
} | null> {
  try {
    const raw = await fs.readFile(EMBEDDING_FILE, "utf8");
    const parsed = JSON.parse(raw) as {
      model: string;
      rows: Array<{ id: string; vector: number[] }>;
    };
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedEmbeddings(payload: {
  model: string;
  rows: Array<{ id: string; vector: number[] }>;
}): Promise<void> {
  await fs.mkdir(path.dirname(EMBEDDING_FILE), { recursive: true });
  await fs.writeFile(EMBEDDING_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length >= 3 && !LEXICAL_STOPWORDS.has(token));
}

function lexicalScore(query: string, text: string): number {
  const q = new Set(tokenize(query));
  const t = new Set(tokenize(text));
  if (q.size === 0 || t.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of q) {
    if (t.has(token)) {
      overlap += 1;
    }
  }
  return overlap / q.size;
}

async function embedTexts(inputs: string[]): Promise<number[][] | null> {
  const client = getOpenAIClient();
  if (!client || !hasOpenAIKey()) {
    return null;
  }

  const vectors: number[][] = [];
  const batchSize = 64;

  for (let offset = 0; offset < inputs.length; offset += batchSize) {
    const slice = inputs.slice(offset, offset + batchSize);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: slice,
    });
    for (const item of response.data) {
      vectors.push(normalizeVector(item.embedding));
    }
  }

  return vectors;
}

async function getArtifactIndex(): Promise<ArtifactIndex> {
  if (indexPromise) {
    return indexPromise;
  }

  indexPromise = (async () => {
    const docs = buildArtifactDocuments();
    const cached = await readCachedEmbeddings();
    if (cached && cached.model === EMBEDDING_MODEL) {
      const byId = new Map(cached.rows.map((row) => [row.id, row.vector]));
      const records: VectorRecord<ArtifactDocument>[] = docs
        .map((doc) => {
          const vector = byId.get(doc.id);
          if (!vector) {
            return null;
          }
          return {
            id: doc.id,
            vector,
            payload: doc,
          };
        })
        .filter((row): row is VectorRecord<ArtifactDocument> => row !== null);
      if (records.length === docs.length) {
        return {
          docs,
          vectors: records,
          model: EMBEDDING_MODEL,
        };
      }
    }

    const vectors = await embedTexts(docs.map((doc) => doc.searchText));
    if (!vectors) {
      return {
        docs,
        vectors: null,
        model: EMBEDDING_MODEL,
      };
    }

    const rows = docs.map((doc, index) => ({
      id: doc.id,
      vector: vectors[index] ?? [],
    }));
    await writeCachedEmbeddings({
      model: EMBEDDING_MODEL,
      rows,
    });

    return {
      docs,
      vectors: rows.map((row, index) => ({
        id: row.id,
        vector: row.vector,
        payload: docs[index]!,
      })),
      model: EMBEDDING_MODEL,
    };
  })();

  return indexPromise;
}

function retrievalQueries(input: InferencePipelineInput): RetrievalQuery[] {
  const contextText = contextToText(input);
  const systems = extractSystems(
    `${input.rawError} ${contextText} ${input.accountType ?? ""} ${input.product ?? ""}`,
  );

  return [
    {
      intent: "symptom",
      text: `${input.rawError} stage ${input.context.pipelineStage} action ${input.context.attemptedAction} last_state ${input.context.lastSuccessfulState}`,
      weight: 0.3,
      threshold: 0.2,
    },
    {
      intent: "system",
      text: `${systems.join(" ")} ${input.product ?? ""} ${input.accountType ?? ""} source ${input.context.sourceInstitution}`,
      weight: 0.25,
      threshold: 0.18,
    },
    {
      intent: "resolution",
      text: `fix remediation ${input.rawError} stage ${input.context.pipelineStage} action ${input.context.attemptedAction} aml ${input.context.existingFlags.amlStatus} reviews ${input.context.existingFlags.pendingReviews.join(" ")}`,
      weight: 0.45,
      threshold: 0.16,
    },
  ];
}

function intentToConnectionType(intent: RetrievalIntent, doc: ArtifactDocument): ConnectionType {
  if (intent === "resolution") {
    return "same resolution path";
  }
  if (intent === "system") {
    if (doc.systems.includes("compliance")) {
      return "regulatory overlap";
    }
    return "same system component";
  }
  return "semantic similarity";
}

async function retrieveArtifacts(
  input: InferencePipelineInput,
): Promise<{
  merged: RetrievedArtifact[];
  rawByIntent: RetrievedArtifact[];
}> {
  const index = await getArtifactIndex();
  const queries = retrievalQueries(input);
  const byId = new Map<string, RetrievedArtifact>();
  const rawByIntent: RetrievedArtifact[] = [];

  for (const query of queries) {
    if (index.vectors) {
      const queryEmbeddingBatch = await embedTexts([query.text]);
      const queryEmbedding = queryEmbeddingBatch?.[0];
      if (!queryEmbedding) {
        continue;
      }
      const vectorResults = searchVectorIndex(queryEmbedding, index.vectors, {
        topK: 8,
        threshold: query.threshold,
      });
      for (const result of vectorResults) {
        const weightedScore = result.score * query.weight;
        const candidate: RetrievedArtifact = {
          document: result.payload,
          score: weightedScore,
          intent: query.intent,
          connectionType: intentToConnectionType(query.intent, result.payload),
        };
        rawByIntent.push(candidate);
        const existing = byId.get(result.id);
        if (!existing || existing.score < weightedScore) {
          byId.set(result.id, candidate);
        } else {
          existing.score = clamp01(existing.score + weightedScore * 0.25);
        }
      }
      continue;
    }

    for (const doc of index.docs) {
      const score = lexicalScore(query.text, doc.searchText);
      if (score < query.threshold) {
        continue;
      }
      const weightedScore = clamp01(score * query.weight);
      const candidate: RetrievedArtifact = {
        document: doc,
        score: weightedScore,
        intent: query.intent,
        connectionType: intentToConnectionType(query.intent, doc),
      };
      rawByIntent.push(candidate);
      const existing = byId.get(doc.id);
      if (!existing || existing.score < weightedScore) {
        byId.set(doc.id, candidate);
      } else {
        existing.score = clamp01(existing.score + weightedScore * 0.25);
      }
    }
  }

  const merged = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, 8);
  return { merged, rawByIntent };
}

function citationBundle(retrieved: RetrievedArtifact[]): EvidenceCitation[] {
  return retrieved.slice(0, 8).map((item) => ({
    artifactId: item.document.id,
    label: item.document.title,
    citation: item.document.citation,
    connectionType: item.connectionType,
    score: clamp01(item.score),
    href: item.document.href,
  }));
}

function buildSimilarityRationale(
  input: InferencePipelineInput,
  citations: EvidenceCitation[],
  retrieved: RetrievedArtifact[],
): string[] {
  if (citations.length === 0 || retrieved.length === 0) {
    return [];
  }

  const sharedSystems = Array.from(
    new Set(retrieved.flatMap((item) => item.document.systems)),
  ).slice(0, 4);
  const top = citations[0];
  const reasons: string[] = [
    `Failure location matches prior evidence: current stage "${input.context.pipelineStage}" aligns with incidents cited in ${top.citation}.`,
    `Current attempted action "${input.context.attemptedAction}" and last successful state "${input.context.lastSuccessfulState}" mirror the transition pattern seen in retrieved artifacts.`,
  ];
  if (sharedSystems.length > 0) {
    reasons.push(
      `Shared system footprint detected across ${sharedSystems.join(", ")} components, which increases match reliability beyond raw error code overlap.`,
    );
  }
  return reasons;
}

function ensureDiagnosisSpecificity(
  diagnosis: string,
  input: InferencePipelineInput,
  citations: EvidenceCitation[],
): string {
  if (!diagnosis) {
    return diagnosis;
  }
  const hasSpecificMarkers =
    diagnosis.toLowerCase().includes("pipeline") ||
    diagnosis.toLowerCase().includes("stage") ||
    diagnosis.toLowerCase().includes("last successful") ||
    diagnosis.toLowerCase().includes("attempt");

  if (hasSpecificMarkers) {
    return diagnosis;
  }

  const citation = citations[0]?.citation ?? "retrieved incident evidence";
  return `${diagnosis} The match is specific because failure occurred at stage "${input.context.pipelineStage}" while attempting "${input.context.attemptedAction}" after last successful state "${input.context.lastSuccessfulState}" (${citation}).`;
}

function buildFallbackDraftMessage(
  input: InferencePipelineInput,
  team: SMEReference[],
  solutionSummary?: string | null,
): string {
  const recipients = team.map((member) => member.name).join(", ") || "ops and infra reviewers";
  const formatArtifactRef = (artifactId: string): string => {
    const artifact = listKnowledgeArtifacts().find((entry) => entry.id === artifactId);
    if (!artifact) {
      return artifactId;
    }
    if (artifact.type === "jira") {
      return artifact.ticketKey;
    }
    if (artifact.type === "slack") {
      const monthYear = artifact.messages[0]
        ? new Date(artifact.messages[0].timestamp).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })
        : "unknown date";
      return `Slack #${artifact.channel} (${monthYear})`;
    }
    return `post-mortem "${artifact.title}"`;
  };
  const priorInvolvement = team
    .slice(0, 2)
    .map((member) => {
      const refs = member.citationArtifactIds.slice(0, 2).map(formatArtifactRef);
      if (refs.length === 0) {
        return `${member.name} helped on earlier transfer incidents`;
      }
      return `${member.name} worked on ${refs.join(" and ")}`;
    })
    .join("; ");
  const resolutionContext = solutionSummary
    ? `That prior case was resolved as follows: ${solutionSummary.split(".")[0]?.trim()}.`
    : "";
  const involvementLine = priorInvolvement
    ? `I am reaching out because ${priorInvolvement}.`
    : "";
  return `Hi ${recipients}, ticket ${input.ticketId} failed at ${input.context.pipelineStage} while ${input.context.attemptedAction}, after last successful state ${input.context.lastSuccessfulState}. Context Guardian diagnosed a likely normalization issue in the bridge/validator path. ${involvementLine} ${resolutionContext}Could you review the normalization logic and confirm whether we should authorize the current remediation path today?`;
}

function parseSeverity(input: string | undefined): OpsTicket["severity"] {
  if (input === "Low" || input === "Medium" || input === "High" || input === "Critical") {
    return input;
  }
  return "High";
}

function buildFallbackSteps(input: InferencePipelineInput, unknownPattern: boolean): ResolutionStep[] {
  if (unknownPattern) {
    return [
      {
        id: "step-route-1",
        title: "Capture enriched triage context",
        details:
          "Validate the raw error packet, systems touched, and account context before any retried transfer action.",
        status: "Pending",
        reviewed: false,
      },
      {
        id: "step-route-2",
        title: "Route to broad-domain SMEs",
        details:
          "Escalate simultaneously to transfer infra and compliance routing owners with all known context and timestamps.",
        status: "Pending",
        reviewed: false,
      },
      {
        id: "step-route-3",
        title: "Prepare authorizable containment payload",
        details: "Apply a scoped queue hold on the transfer to prevent duplicate or unsafe retries.",
        status: "Pending",
        reviewed: false,
        payloadJson: JSON.stringify(
          {
            tool: "queue.applyHold",
            ticketId: input.ticketId,
            reason: "unknown_pattern_triage",
            holdScope: "single_ticket",
            note: "No organizational precedent found. Await SME triage.",
          },
          null,
          2,
        ),
      },
      {
        id: "step-route-4",
        title: "Record memory handoff note",
        details: "Capture final resolution notes; this incident will seed a new organizational pattern.",
        status: "Pending",
        reviewed: false,
      },
    ];
  }

  return [
    {
      id: "step-1",
      title: "Validate primary mismatch context",
      details: "Confirm transfer payload, account metadata, and affected system pair before any retry.",
      status: "Pending",
      reviewed: false,
    },
    {
      id: "step-2",
      title: "Apply controlled remediation payload",
      details: "Execute scoped corrective action and annotate compliance rationale where required.",
      status: "Pending",
      reviewed: false,
      payloadJson: JSON.stringify(
        {
          tool: "ledger.updateHoldingReference",
          ticketId: input.ticketId,
          accountId: "PENDING_LOOKUP",
          updates: [{ field: "reference", previous: "legacy", next: "canonical" }],
          complianceNote: "Generated from Context Guardian inference pipeline.",
        },
        null,
        2,
      ),
    },
    {
      id: "step-3",
      title: "Re-run transfer path",
      details: "Re-submit through ATON/bridge path and confirm acceptance at receiving side.",
      status: "Pending",
      reviewed: false,
    },
  ];
}

function mapArtifactToNodeSource(
  artifact: KnowledgeArtifact,
): "jira" | "slack" | "confluence" | "regulatory" | "ticket" {
  if (artifact.type === "jira") {
    return "jira";
  }
  if (artifact.type === "slack") {
    return "slack";
  }
  return "confluence";
}

function edgeLabelFromConnection(connectionType: ConnectionType): "Same error class" | "Referenced in resolution" | "Regulatory overlap" {
  if (connectionType === "same resolution path" || connectionType === "explicit reference") {
    return "Referenced in resolution";
  }
  if (connectionType === "regulatory overlap") {
    return "Regulatory overlap";
  }
  return "Same error class";
}

function buildEvidenceGraph(
  ticketId: string,
  rawError: string,
  citations: EvidenceCitation[],
): Pick<BlueprintType, "evidenceNodes" | "evidenceEdges"> {
  const ticketNodeId = "node-ticket-current";
  const nodes: BlueprintType["evidenceNodes"] = [
    {
      id: ticketNodeId,
      sourceType: "ticket",
      label: ticketId,
      snippet: `${rawError} incoming ticket`,
      documentRef: "Current ticket",
      position: { x: 60, y: 120 },
    },
  ];
  const edges: BlueprintType["evidenceEdges"] = [];

  citations.slice(0, 6).forEach((citation, index) => {
    const sourceArtifact = listKnowledgeArtifacts().find((artifact) => artifact.id === citation.artifactId);
    if (!sourceArtifact) {
      return;
    }
    const nodeId = `node-${slugify(citation.artifactId)}-${index + 1}`;
    nodes.push({
      id: nodeId,
      sourceType: mapArtifactToNodeSource(sourceArtifact),
      label: citation.label,
      snippet: citation.citation,
      documentRef: citation.href,
      position: {
        x: 250 + index * 180,
        y: 80 + (index % 2) * 110,
      },
    });
    edges.push({
      id: `edge-${index + 1}`,
      source: index === 0 ? ticketNodeId : nodes[index].id,
      target: nodeId,
      label: edgeLabelFromConnection(citation.connectionType),
    });
  });

  return { evidenceNodes: nodes, evidenceEdges: edges };
}

function formatCurrentSmes(
  synth: SynthesizedKnowledgeState,
  routedSmeIds: string[],
): TicketBlueprint["smes"] {
  const routed = synth.smeRoutingTable.filter((entry) => routedSmeIds.includes(entry.personId)).slice(0, 3);
  if (routed.length > 0) {
    return routed.map((entry) => ({
      id: entry.personId,
      name: entry.name,
      role: entry.role,
      status: entry.status,
    }));
  }
  return synth.smeRoutingTable
    .filter((entry) => entry.status === "Active")
    .slice(0, 3)
    .map((entry) => ({
      id: entry.personId,
      name: entry.name,
      role: entry.role,
      status: entry.status,
    }));
}

function normalizePersonName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function namesMatch(left: string, right: string): boolean {
  const l = normalizePersonName(left);
  const r = normalizePersonName(right);
  if (l === r) {
    return true;
  }
  if (l.includes("marcus t") && r.includes("marcus thibodeau")) {
    return true;
  }
  if (r.includes("marcus t") && l.includes("marcus thibodeau")) {
    return true;
  }
  return false;
}

function artifactInvolvesPerson(artifact: KnowledgeArtifact, personName: string): boolean {
  if (artifact.type === "slack") {
    return artifact.messages.some((message) => namesMatch(message.sender, personName));
  }
  if (artifact.type === "jira") {
    if (namesMatch(artifact.owner, personName)) {
      return true;
    }
    return artifact.comments.some((comment) => namesMatch(comment.author, personName));
  }
  return namesMatch(artifact.author, personName);
}

function buildPriorResolutionTeam(
  synth: SynthesizedKnowledgeState,
  retrieved: RetrievedArtifact[],
  preferredIds: string[],
): SMEReference[] {
  const citationByPerson = new Map<string, string[]>();
  for (const item of retrieved) {
    const artifact = item.document.artifact;
    for (const entry of synth.smeRoutingTable) {
      if (artifactInvolvesPerson(artifact, entry.name)) {
        const current = citationByPerson.get(entry.personId) ?? [];
        if (!current.includes(artifact.id)) {
          current.push(artifact.id);
        }
        citationByPerson.set(entry.personId, current);
      }
    }
  }

  const orderedIds = [
    ...preferredIds,
    ...Array.from(citationByPerson.keys()).filter((personId) => !preferredIds.includes(personId)),
  ];

  return orderedIds
    .map((personId) => synth.smeRoutingTable.find((entry) => entry.personId === personId))
    .filter((entry): entry is SynthesizedKnowledgeState["smeRoutingTable"][number] => Boolean(entry))
    .filter((entry) => (citationByPerson.get(entry.personId) ?? []).length > 0)
    .slice(0, 4)
    .map((entry) => ({
      id: entry.personId,
      name: entry.name,
      role: entry.role,
      status: entry.status,
      citationArtifactIds: citationByPerson.get(entry.personId) ?? [],
    }));
}

function confidenceCaveat(
  synth: SynthesizedKnowledgeState,
  routedSmeIds: string[],
  patternScore: number,
  resolutionScore: number,
): string {
  const routed = synth.smeRoutingTable.filter((entry) => routedSmeIds.includes(entry.personId));
  const departed = routed.find((entry) => entry.status === "Departed");
  if (departed?.replacedBy) {
    const replacement = synth.smeRoutingTable.find((entry) => entry.personId === departed.replacedBy);
    return `Resolution path confidence is moderate because the closest historical owner (${departed.name}) has departed. ${replacement?.name ?? "Replacement SME"} has been routed with partial domain history.`;
  }
  if (patternScore < 0.4) {
    return "Pattern confidence is limited because retrieved precedent is sparse and weakly aligned.";
  }
  if (resolutionScore < 0.45) {
    return "Resolution path confidence is moderate because matches were symptom-heavy and remediation evidence was limited.";
  }
  return "Confidence is high because pattern, system, and resolution matches converged across recent artifacts.";
}

type LlmSynthesisResponse = {
  diagnosis: string;
  solutionSummary?: string | null;
  draftMessage?: string;
  priorResolutionTeamIds?: string[];
  resolutionSteps: Array<{
    title: string;
    details: string;
    requiresPayload?: boolean;
    payload?: Record<string, unknown>;
  }>;
  unknownPattern: boolean;
  accountType?: string;
  product?: string;
  severity?: "Low" | "Medium" | "High" | "Critical";
  routedSmeIds?: string[];
};

async function synthesizeWithLlm(
  input: InferencePipelineInput,
  synthResult: Awaited<ReturnType<typeof querySynthesizedKnowledge>>,
  retrieved: RetrievedArtifact[],
  synthState: SynthesizedKnowledgeState,
  unknownByRetrieval: boolean,
): Promise<LlmSynthesisResponse | null> {
  const client = getOpenAIClient();
  if (!client || !hasOpenAIKey()) {
    return null;
  }

  const directTeamCandidates = buildPriorResolutionTeam(
    synthState,
    retrieved,
    synthResult.smeRecommendations.map((entry) => entry.personId),
  );

  const context = {
    ticket: {
      id: input.ticketId,
      rawError: input.rawError,
      pipelineStage: input.context.pipelineStage,
      attemptedAction: input.context.attemptedAction,
      lastSuccessfulState: input.context.lastSuccessfulState,
      sourceInstitution: input.context.sourceInstitution,
      existingFlags: input.context.existingFlags,
      additionalSignals: input.context.additionalSignals ?? [],
      operatorNarrative: input.context.operatorNarrative ?? "",
      accountType: input.accountType ?? "",
      product: input.product ?? "",
      severity: input.severity ?? "",
    },
    synthesizedMatches: synthResult.patterns,
    synthesizedCorrelations: synthResult.correlations.map((correlation) => ({
      correlationId: correlation.correlationId,
      description: correlation.description,
      confidenceScore: correlation.confidenceScore,
      systems: [correlation.systemA, correlation.systemB],
    })),
    smeRecommendations: synthResult.smeRecommendations,
    retrievedArtifacts: retrieved.map((item) => ({
      artifactId: item.document.id,
      title: item.document.title,
      citation: item.document.citation,
      connectionType: item.connectionType,
      score: item.score,
      text: item.document.searchText.slice(0, 800),
    })),
    candidateSmes: synthState.smeRoutingTable.map((entry) => ({
      personId: entry.personId,
      name: entry.name,
      status: entry.status,
      replacedBy: entry.replacedBy,
      confidenceByDomain: entry.confidenceByDomain,
    })),
    directTeamCandidates: directTeamCandidates.map((member) => ({
      personId: member.id,
      name: member.name,
      role: member.role,
      status: member.status,
      citationArtifactIds: member.citationArtifactIds,
    })),
    unknownByRetrieval,
  };

  try {
    const completion = await client.chat.completions.create({
      model: SYNTHESIS_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You generate fintech operations blueprints. Return strict JSON with keys: diagnosis, solutionSummary, priorResolutionTeamIds, draftMessage, resolutionSteps, unknownPattern, accountType, product, severity, routedSmeIds. Rules: diagnosis is one paragraph plain English with no jargon and no hedging. If this matches precedent, explain exactly why: include pipeline stage, attempted action, and last successful state alignment. For every diagnosis claim include explicit citation labels in parentheses. solutionSummary must be 3-5 sentences, past tense, and fully grounded; if any sentence cannot be grounded in retrieved artifacts, omit it. If grounding is insufficient return solutionSummary as null. priorResolutionTeamIds must only contain IDs from directTeamCandidates. draftMessage must read as a friendly request for help: include ticket ID, concise situation summary, what the system already diagnosed, recipient-specific ask to review normalization logic, and reference prior involvement naturally. If prior resolution context is available, mention what they did to solve it; if not, omit that part. End with a clear action request. Each resolution step is one sentence and exactly one step requiresPayload=true with valid JSON payload. If context is weak or precedent is weak, set unknownPattern=true and do not fabricate.",
        },
        {
          role: "user",
          content: JSON.stringify(context),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LlmSynthesisResponse;
    if (!parsed.diagnosis || !Array.isArray(parsed.resolutionSteps)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function toBlueprintFromSynthesis(
  input: InferencePipelineInput,
  synthState: SynthesizedKnowledgeState,
  synthResult: Awaited<ReturnType<typeof querySynthesizedKnowledge>>,
  retrieved: RetrievedArtifact[],
  citations: EvidenceCitation[],
  llm: LlmSynthesisResponse | null,
  unknownPattern: boolean,
): {
  blueprint: TicketBlueprint;
  routedSmeIds: string[];
  resolutionPathConfidence: number;
  priorResolutionTeam: SMEReference[];
} {
  const routedSmeIds =
    llm?.routedSmeIds?.filter((id) => synthState.smeRoutingTable.some((entry) => entry.personId === id)).slice(0, 3) ??
    synthResult.smeRecommendations.map((entry) => entry.personId).slice(0, 3);
  const priorResolutionTeam = buildPriorResolutionTeam(
    synthState,
    retrieved,
    llm?.priorResolutionTeamIds ?? routedSmeIds,
  );

  const diagnosis =
    llm?.diagnosis ??
    (unknownPattern
      ? UNKNOWN_DIAGNOSIS
      : `This ticket most closely matches prior incidents tied to ${citations
          .slice(0, 2)
          .map((citation) => citation.citation)
          .join(" and ")}, which indicate the same operational failure pattern.`);
  const diagnosisWithSpecificity = unknownPattern
    ? diagnosis
    : ensureDiagnosisSpecificity(diagnosis, input, citations);

  const fallbackSteps = buildFallbackSteps(input, unknownPattern);
  const llmSteps = llm?.resolutionSteps?.slice(0, 6).map((step, index) => ({
    id: `step-${index + 1}`,
    title: step.title || `Step ${index + 1}`,
    details: step.details || step.title || "Review inferred remediation path.",
    status: "Pending" as const,
    reviewed: false,
    payloadJson: step.requiresPayload
      ? JSON.stringify(
          step.payload ?? {
            tool: "queue.applyManualCorrection",
            ticketId: input.ticketId,
            note: "Generated payload missing; fallback payload used.",
          },
          null,
          2,
        )
      : undefined,
  }));

  const resolutionSteps = llmSteps && llmSteps.length > 0 ? llmSteps : fallbackSteps;
  if (!resolutionSteps.some((step) => Boolean(step.payloadJson))) {
    const injection = buildFallbackSteps(input, unknownPattern).find((step) => Boolean(step.payloadJson));
    if (injection) {
      resolutionSteps.splice(Math.min(1, resolutionSteps.length), 0, injection);
    }
  }

  const resolutionEvidenceHits = citations.filter((citation) => citation.connectionType === "same resolution path").length;
  const resolutionPathConfidence = clamp01(Math.min(1, 0.35 + resolutionEvidenceHits * 0.2));

  const graph = buildEvidenceGraph(input.ticketId, input.rawError, citations);

  return {
    blueprint: {
      diagnosis: diagnosisWithSpecificity,
      severity: llm?.severity ? parseSeverity(llm.severity) : parseSeverity(input.severity),
      accountType: llm?.accountType ?? input.accountType ?? "Registered - TFSA",
      product: llm?.product ?? input.product ?? "ATON Transfer",
      confidenceScore: 0.5,
      solutionSummary: llm?.solutionSummary ?? null,
      priorResolutionTeam,
      draftMessage:
        llm?.draftMessage ??
        buildFallbackDraftMessage(input, priorResolutionTeam, llm?.solutionSummary ?? null),
      resolutionSteps,
      evidenceNodes: graph.evidenceNodes,
      evidenceEdges: graph.evidenceEdges,
      smes: formatCurrentSmes(synthState, routedSmeIds),
    },
    routedSmeIds,
    resolutionPathConfidence,
    priorResolutionTeam,
  };
}

export async function runBlueprintInference(
  input: InferencePipelineInput,
): Promise<InferencePipelineResult> {
  const fallbackStart = Date.now();
  try {
    const contextText = contextToText(input);
    const ticketText = normalizeWhitespace(
      [
        input.rawError,
        contextText,
        input.accountType ?? "",
        input.product ?? "",
        input.severity ?? "",
      ].join(" "),
    );

    // Step 1: Embed incoming ticket (transient for this request).
    const ticketEmbedding = await embedTexts([ticketText]);
    void ticketEmbedding;

    // Step 2: Consult synthesized knowledge first (fast path).
    const [synthState, synthResult] = await Promise.all([
      loadSynthesizedKnowledge(),
      querySynthesizedKnowledge({
        rawError: input.rawError,
        description: contextText,
        accountType: input.accountType,
        product: input.product,
        severity: input.severity,
      }),
    ]);

    // Step 3 + 4: semantic retrieval with multi-intent queries.
    const retrieval = await retrieveArtifacts(input);
    const retrieved = retrieval.merged;
    const topRetrievedScore = retrieved[0]?.score ?? 0;
    const topPatternScore = synthResult.patterns[0]?.score ?? 0;
    const errorClass = rawErrorClass(input.rawError);
    const recognizedRawErrorSignal = [
      "cusip",
      "aton",
      "validator",
      "aml",
      "fhsa",
      "tfsa",
      "rrsp",
      "w8ben",
      "ledger",
      "cas",
      "queue",
      "drip",
    ].some((token) => input.rawError.toLowerCase().includes(token));
    const errorClassReferenced = retrieved.some((item) => {
      const text = item.document.searchText.toUpperCase();
      return text.includes(input.rawError.toUpperCase()) || text.includes(errorClass);
    });
    const noPrecedent =
      (retrieved.length === 0 && synthResult.patterns.length === 0) ||
      (((topRetrievedScore < 0.18 && topPatternScore < 0.35 && !recognizedRawErrorSignal) ||
        (!recognizedRawErrorSignal &&
          !errorClassReferenced &&
          topPatternScore < 0.3 &&
          topRetrievedScore < 0.28)));

    // Step 5: LLM synthesis (or deterministic fallback).
    const llm = await synthesizeWithLlm(
      input,
      synthResult,
      retrieved,
      synthState,
      noPrecedent,
    );

    const unknownPattern = noPrecedent || Boolean(llm?.unknownPattern);
    const citations = citationBundle(retrieved);
    const similarityRationale = buildSimilarityRationale(input, citations, retrieved);
    const assembled = toBlueprintFromSynthesis(
      input,
      synthState,
      synthResult,
      retrieved,
      citations,
      llm,
      unknownPattern,
    );

    const patternMatchConfidence = clamp01(
      synthResult.patterns[0]?.score ?? (retrieved[0]?.score ? retrieved[0].score * 0.85 : 0.08),
    );
    const smeRoutingConfidence = clamp01(
      synthResult.smeRecommendations.length > 0
        ? synthResult.smeRecommendations
            .slice(0, 3)
            .reduce((sum, item) => sum + item.score, 0) / Math.min(3, synthResult.smeRecommendations.length)
        : 0.22,
    );
    const resolutionPathConfidence = assembled.resolutionPathConfidence;
    const overallConfidence = clamp01(
      unknownPattern
        ? Math.max(0.12, 0.45 * patternMatchConfidence + 0.25 * smeRoutingConfidence + 0.3 * resolutionPathConfidence - 0.28)
        : 0.45 * patternMatchConfidence + 0.2 * smeRoutingConfidence + 0.35 * resolutionPathConfidence,
    );

    const caveat = confidenceCaveat(
      synthState,
      assembled.routedSmeIds,
      patternMatchConfidence,
      resolutionPathConfidence,
    );

    const confidence: ConfidenceBreakdown = {
      overallConfidence,
      patternMatchConfidence,
      smeRoutingConfidence,
      resolutionPathConfidence,
      humanReadableCaveat: caveat,
    };

    const hasGroundedSolutionSummary =
      !unknownPattern &&
      overallConfidence >= 0.58 &&
      Boolean(assembled.blueprint.solutionSummary) &&
      assembled.priorResolutionTeam.length > 0;

    const blueprint: TicketBlueprint = {
      ...assembled.blueprint,
      confidenceScore: overallConfidence,
      solutionSummary: hasGroundedSolutionSummary ? assembled.blueprint.solutionSummary : null,
      priorResolutionTeam: hasGroundedSolutionSummary ? assembled.priorResolutionTeam : [],
      diagnosis: unknownPattern
        ? `${UNKNOWN_DIAGNOSIS} This resolution will be added to organizational memory once completed.`
        : assembled.blueprint.diagnosis,
    };

    return {
      blueprint,
      metadata: {
        unknownPattern,
        contextSummary: {
          pipelineStage: input.context.pipelineStage,
          attemptedAction: input.context.attemptedAction,
          lastSuccessfulState: input.context.lastSuccessfulState,
          sourceInstitution: input.context.sourceInstitution,
          existingFlags: input.context.existingFlags,
          additionalSignals: input.context.additionalSignals ?? [],
          operatorNarrative: input.context.operatorNarrative,
        },
        confidence,
        evidenceCitations: citations,
        patternIds: synthResult.patterns.map((item) => item.patternId),
        correlationIds: synthResult.correlations.map((item) => item.correlationId),
        routedSmeIds: assembled.routedSmeIds,
        similarityRationale,
      },
      blueprintGeneratedAt: new Date().toISOString(),
    };
  } catch (error) {
    const degradedReason = error instanceof Error ? error.message : "Inference pipeline failure.";
    const generatedAt = new Date().toISOString();
    const unknown = true;
    const fallbackSteps = buildFallbackSteps(input, true);

    return {
      blueprint: {
        diagnosis: `${UNKNOWN_DIAGNOSIS} This resolution will be added to organizational memory once completed.`,
        severity: parseSeverity(input.severity),
        accountType: input.accountType ?? "Unknown",
        product: input.product ?? "Unknown Transfer",
        confidenceScore: 0.12,
        solutionSummary: null,
        priorResolutionTeam: [],
        draftMessage: buildFallbackDraftMessage(input, []),
        resolutionSteps: fallbackSteps,
        evidenceNodes: [
          {
            id: "node-ticket-current",
            sourceType: "ticket",
            label: input.ticketId,
            snippet: input.rawError,
            documentRef: "Current ticket",
            position: { x: 60, y: 120 },
          },
        ],
        evidenceEdges: [],
        smes: [
          {
            id: "sarah-jenkins",
            name: "Sarah Jenkins",
            role: "Senior Ops Analyst",
            status: "Active",
          },
          {
            id: "dev-chatterjee",
            name: "Dev Chatterjee",
            role: "Platform Engineer",
            status: "Active",
          },
          {
            id: "marcus-thibodeau",
            name: "Marcus T.",
            role: "Compliance Analyst",
            status: "Active",
          },
        ],
      },
      metadata: {
        unknownPattern: unknown,
        contextSummary: {
          pipelineStage: input.context.pipelineStage,
          attemptedAction: input.context.attemptedAction,
          lastSuccessfulState: input.context.lastSuccessfulState,
          sourceInstitution: input.context.sourceInstitution,
          existingFlags: input.context.existingFlags,
          additionalSignals: input.context.additionalSignals ?? [],
          operatorNarrative: input.context.operatorNarrative,
        },
        confidence: {
          overallConfidence: 0.12,
          patternMatchConfidence: 0.08,
          smeRoutingConfidence: 0.32,
          resolutionPathConfidence: 0.14,
          humanReadableCaveat:
            "Inference degraded due to retrieval or model failure, so a conservative unknown-pattern routing path was generated.",
        },
        evidenceCitations: [],
        patternIds: [],
        correlationIds: [],
        routedSmeIds: ["sarah-jenkins", "dev-chatterjee", "marcus-thibodeau"],
        similarityRationale: [],
        degradedReason,
      },
      blueprintGeneratedAt: generatedAt,
    };
  } finally {
    void fallbackStart;
  }
}
