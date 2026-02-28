// PHASE 2: LLM INTEGRATION POINT
import { promises as fs } from "node:fs";
import path from "node:path";
import { listKnowledgeArtifacts, type KnowledgeArtifact } from "@/lib/knowledgeBase";
import { getOpenAIClient, hasOpenAIKey } from "@/lib/openaiClient";
import type { OpsTicket, TicketBlueprint } from "@/lib/types";

export type PatternLibraryEntry = {
  patternId: string;
  name: string;
  description: string;
  triggerConditions: string[];
  typicalResolutionPath: string[];
  averageResolutionTime: string;
  occurrenceCount: number;
  lastSeen: string;
  confidenceScore: number;
  involvedSystems: string[];
  regulatoryRelevance: boolean;
  relatedPatternIds: string[];
};

export type SmeRoutingEntry = {
  personId: string;
  name: string;
  role: string;
  status: "Active" | "Departed";
  expertiseDomains: string[];
  recentInvolvements: string[];
  confidenceByDomain: Record<string, number>;
  replacedBy?: string;
  lastActiveDate: string;
};

export type CorrelationMapEntry = {
  correlationId: string;
  systemA: string;
  systemB: string;
  correlationType: string;
  observedCount: number;
  description: string;
  supportingTicketIds: string[];
  confidenceScore: number;
};

export type RecencyIndexEntry = {
  entryId: string;
  entryType: "pattern" | "sme";
  lastSeen: string;
  relevanceScore: number;
};

export type SynthesizedKnowledgeState = {
  version: number;
  builtAt: string;
  lastUpdatedAt: string;
  sourceArtifactCount: number;
  patterns: PatternLibraryEntry[];
  smeRoutingTable: SmeRoutingEntry[];
  correlationMap: CorrelationMapEntry[];
  recencyIndex: RecencyIndexEntry[];
};

export type SynthesizedPatternMatch = {
  patternId: string;
  score: number;
  reason: string;
};

export type SynthesizedSmeRecommendation = {
  personId: string;
  score: number;
  reason: string;
};

export type SynthesizedQueryResult = {
  patterns: SynthesizedPatternMatch[];
  correlations: CorrelationMapEntry[];
  smeRecommendations: SynthesizedSmeRecommendation[];
  fastPathConfidence: number;
};

type QueryContext = {
  rawError: string;
  description: string;
  accountType?: string;
  product?: string;
  severity?: string;
};

const SYNTH_DIR = path.join(process.cwd(), "data");
const SYNTH_FILE = path.join(SYNTH_DIR, "synthesizedKnowledge.json");
const SYNTHESIS_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";
const SYNTH_STATE_VERSION = 2;

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  corporate_actions: ["cusip", "merger", "split", "delist", "corporate action", "drip"],
  custodian_bridge: ["cas", "bridge", "schema", "timeout", "503"],
  compliance_regulatory: ["aml", "cra", "w-8ben", "iiroc", "reg flags", "compliance"],
  ledger_reconciliation: ["ledger", "recon", "rounding", "audit", "manual update"],
  validator_reliability: ["validator", "whitelist", "regex", "timeout", "positions"],
  ops_process: ["runbook", "documentation", "fhsa", "tfsa", "rrsp", "queue"],
};

const SME_SPECIALIZATION_BOOSTS: Record<
  string,
  {
    systems?: string[];
    domains?: string[];
    tokens?: string[];
    bonus: number;
  }
> = {
  "chloe-park": {
    systems: ["bridge", "CAS", "validator"],
    domains: ["custodian_bridge", "validator_reliability"],
    tokens: ["parser", "schema", "normalization", "bridge transform"],
    bonus: 0.22,
  },
  "mateo-ruiz": {
    systems: ["CAS", "queue"],
    domains: ["custodian_bridge"],
    tokens: ["503", "timeout", "latency", "retry", "backlog"],
    bonus: 0.22,
  },
  "nina-patel": {
    systems: ["ledger"],
    domains: ["ledger_reconciliation"],
    tokens: ["recon", "audit", "rounding", "discrepancy", "tie-out"],
    bonus: 0.21,
  },
  "aisha-rahman": {
    systems: ["compliance"],
    domains: ["compliance_regulatory"],
    tokens: ["cra", "w-8ben", "iiroc", "reg flags", "regulatory"],
    bonus: 0.22,
  },
  "liam-oconnell": {
    systems: ["ATON", "queue"],
    domains: ["ops_process"],
    tokens: ["triage", "handoff", "manual review", "sla", "ops queue"],
    bonus: 0.18,
  },
};

function specialistBoost(
  personId: string,
  systems: string[],
  domains: string[],
  joined: string,
): number {
  const profile = SME_SPECIALIZATION_BOOSTS[personId];
  if (!profile) {
    return 0;
  }
  let score = 0;
  if (profile.systems?.some((system) => systems.includes(system))) {
    score += profile.bonus * 0.45;
  }
  if (profile.domains?.some((domain) => domains.includes(domain))) {
    score += profile.bonus * 0.35;
  }
  if (profile.tokens?.some((token) => joined.toLowerCase().includes(token.toLowerCase()))) {
    score += profile.bonus * 0.25;
  }
  return Math.min(profile.bonus, score);
}

const CAST: Array<{
  personId: string;
  name: string;
  role: string;
  status: "Active" | "Departed";
  replacedBy?: string;
}> = [
  {
    personId: "sarah-jenkins",
    name: "Sarah Jenkins",
    role: "Senior Ops Analyst",
    status: "Active",
  },
  {
    personId: "dan-smith",
    name: "Dan Smith",
    role: "Backend Engineer",
    status: "Departed",
    replacedBy: "dev-chatterjee",
  },
  {
    personId: "marcus-thibodeau",
    name: "Marcus T.",
    role: "Compliance Analyst",
    status: "Active",
  },
  {
    personId: "priya-nair",
    name: "Priya Nair",
    role: "Junior Ops Analyst",
    status: "Active",
  },
  {
    personId: "raj-khoury",
    name: "Raj Khoury",
    role: "Engineering Manager",
    status: "Active",
  },
  {
    personId: "elena-vasquez",
    name: "Elena Vasquez",
    role: "Head of Compliance",
    status: "Active",
  },
  {
    personId: "dev-chatterjee",
    name: "Dev Chatterjee",
    role: "Platform Engineer",
    status: "Active",
  },
  {
    personId: "liam-oconnell",
    name: "Liam O'Connell",
    role: "Transfer Operations Specialist",
    status: "Active",
  },
  {
    personId: "chloe-park",
    name: "Chloe Park",
    role: "Staff Software Engineer",
    status: "Active",
  },
  {
    personId: "nina-patel",
    name: "Nina Patel",
    role: "Reconciliation Analyst",
    status: "Active",
  },
  {
    personId: "mateo-ruiz",
    name: "Mateo Ruiz",
    role: "Site Reliability Engineer",
    status: "Active",
  },
  {
    personId: "aisha-rahman",
    name: "Aisha Rahman",
    role: "Regulatory Counsel",
    status: "Active",
  },
];

let cachedState: SynthesizedKnowledgeState | null = null;
let loadingPromise: Promise<SynthesizedKnowledgeState> | null = null;

function toLower(text: string): string {
  return text.toLowerCase();
}

function safeDate(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function artifactDate(artifact: KnowledgeArtifact): string {
  if (artifact.type === "slack") {
    return artifact.messages[artifact.messages.length - 1]?.timestamp ?? "2024-01-01T00:00:00.000Z";
  }
  if (artifact.type === "jira") {
    return artifact.resolvedAt || artifact.createdAt;
  }
  return artifact.publishedAt;
}

function artifactText(artifact: KnowledgeArtifact): string {
  if (artifact.type === "slack") {
    return [artifact.title, artifact.channel, ...artifact.messages.map((message) => message.body)].join(" ");
  }
  if (artifact.type === "jira") {
    return [
      artifact.title,
      artifact.ticketKey,
      artifact.summary,
      artifact.technicalDescription,
      ...artifact.comments.map((comment) => comment.body),
    ].join(" ");
  }
  return [artifact.title, ...artifact.sections.map((section) => `${section.heading} ${section.body}`)].join(" ");
}

function extractSystems(text: string): string[] {
  const lower = toLower(text);
  const systems: string[] = [];
  const add = (system: string, ...tokens: string[]) => {
    if (tokens.some((token) => lower.includes(token)) && !systems.includes(system)) {
      systems.push(system);
    }
  };

  add("ATON", "aton");
  add("CAS", "cas", "custodian api");
  add("bridge", "bridge");
  add("queue", "queue", "retry");
  add("validator", "validator");
  add("ledger", "ledger", "recon");
  add("OMS", "oms");
  add("compliance", "compliance", "aml", "cra", "w-8ben", "reg");
  return systems;
}

function overlapScore(text: string, tokens: string[]): number {
  const lower = toLower(text);
  const hits = tokens.filter((token) => lower.includes(token.toLowerCase())).length;
  if (tokens.length === 0) {
    return 0;
  }
  return hits / tokens.length;
}

function computeAverageResolutionHours(patternId: string, artifacts: KnowledgeArtifact[]): string {
  const jira = artifacts.filter((artifact): artifact is Extract<KnowledgeArtifact, { type: "jira" }> => artifact.type === "jira");
  const relevant = jira.filter((item) => item.ticketKey.toLowerCase().includes(patternId.split("-")[1] ?? ""));
  const source = relevant.length > 0 ? relevant : jira;
  const durations = source
    .map((item) => safeDate(item.resolvedAt) - safeDate(item.createdAt))
    .filter((value) => value > 0)
    .map((value) => value / (1000 * 60 * 60));
  if (durations.length === 0) {
    return "6.0h";
  }
  const avg = durations.reduce((sum, current) => sum + current, 0) / durations.length;
  return `${avg.toFixed(1)}h`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildBasePatterns(artifacts: KnowledgeArtifact[]): PatternLibraryEntry[] {
  const patternSeeds = [
    {
      patternId: "pat-corporate-action-cusip",
      name: "Corporate Action CUSIP Reassignment Failures",
      description:
        "Transfers fail mid-flight when identifier mappings lag corporate-action updates, especially merger and split windows.",
      triggerConditions: [
        "ERR_739 style CUSIP mismatch errors",
        "Recent merger, split, delisting, or DRIP adjustment",
        "Validator accepts intake but bridge/CAS rejects completion",
      ],
      typicalResolutionPath: [
        "Confirm canonical post-action CUSIP in reference source.",
        "Apply controlled remap in the ledger with compliance rationale.",
        "Re-submit ATON transfer and attach citation trail.",
      ],
      involvedSystems: ["ATON", "validator", "bridge", "CAS", "ledger"],
      regulatoryRelevance: true,
      keywords: ["cusip", "merger", "split", "corporate action", "drip", "delist"],
    },
    {
      patternId: "pat-cas-degradation-queue",
      name: "Custodian API Degradation Cascading To Queue Backlog",
      description:
        "CAS latency or 503 bursts manifest as scattered ticket failures while the underlying issue is queue-wide saturation.",
      triggerConditions: [
        "CAS 503 or timeout increase",
        "Rapid growth in queue retry volume",
        "High transfer season volume (RRSP or quarter close)",
      ],
      typicalResolutionPath: [
        "Switch triage from ticket-local to queue-level diagnostics.",
        "Reduce retry fanout and tune timeout profile for current load.",
        "Enable dedupe guardrails before reprocessing pending transfers.",
      ],
      involvedSystems: ["CAS", "queue", "bridge", "ATON"],
      regulatoryRelevance: false,
      keywords: ["cas", "503", "timeout", "retry", "queue", "duplicate"],
    },
    {
      patternId: "pat-validator-stale-config",
      name: "Validator Rejecting Valid Transfers Due To Stale Configuration",
      description:
        "Validator path rejects legitimate data after whitelist drift, regex assumptions, or outdated security snapshots.",
      triggerConditions: [
        "Generic validator rejection despite valid holdings",
        "Recent securities refresh or parser deployment",
        "Inconsistent behavior by account shape or symbol class",
      ],
      typicalResolutionPath: [
        "Verify whitelist freshness and parser version alignment.",
        "Patch validator rule path and add explicit error reason codes.",
        "Bulk requeue affected items with preserved submission metadata.",
      ],
      involvedSystems: ["validator", "queue", "CAS", "OMS"],
      regulatoryRelevance: false,
      keywords: ["validator", "whitelist", "regex", "refresh", "positions"],
    },
    {
      patternId: "pat-compliance-ownership-loop",
      name: "Compliance Hold Loop Without Clear Owner",
      description:
        "Transfers with AML or over-contribution flags bounce between ops and compliance when terminal ownership is undefined.",
      triggerConditions: [
        "AML or CRA regulatory stop discovered mid-flow",
        "Repeated handoff between ops and compliance queues",
        "No explicit terminal owner at T+2",
      ],
      typicalResolutionPath: [
        "Assign terminal owner and escalation deadline.",
        "Record policy citation for the hold or release decision.",
        "Update queue state model to prevent reassignment loops.",
      ],
      involvedSystems: ["compliance", "queue", "ATON"],
      regulatoryRelevance: true,
      keywords: ["aml", "cra", "compliance", "loop", "hold", "reg flags"],
    },
    {
      patternId: "pat-ledger-manual-error",
      name: "Manual Ledger Update Errors With Audit Remediation",
      description:
        "Manual correction paths create secondary incidents when updates are applied to the wrong account or at the wrong time.",
      triggerConditions: [
        "Manual ledger intervention during backlog handling",
        "Audit discrepancy appears 1-3 days later",
        "Transfer status diverges from ledger status",
      ],
      typicalResolutionPath: [
        "Restore correct ledger state with full before/after audit trail.",
        "Validate downstream transfer and reconciliation outcomes.",
        "Introduce guardrails in operator tooling for account targeting.",
      ],
      involvedSystems: ["ledger", "queue", "compliance"],
      regulatoryRelevance: true,
      keywords: ["ledger", "manual", "audit", "fat finger", "recon"],
    },
    {
      patternId: "pat-account-type-reg-mismatch",
      name: "RRSP/TFSA/FHSA Regulatory Handling Mismatch",
      description:
        "Operators apply the wrong regulatory pathway when account classification and runbook guidance are misaligned.",
      triggerConditions: [
        "FHSA or TFSA account path ambiguity",
        "CAS account type schema drift or stale docs",
        "Escalations citing conflicting procedural guidance",
      ],
      typicalResolutionPath: [
        "Confirm account type from authoritative source and compliance rules.",
        "Apply correct transfer path with explicit rationale in the ticket.",
        "Update canonical runbook and retire stale procedural references.",
      ],
      involvedSystems: ["CAS", "ops process", "compliance", "queue"],
      regulatoryRelevance: true,
      keywords: ["fhsa", "tfsa", "rrsp", "runbook", "w-8ben", "documentation"],
    },
  ];

  const patterns = patternSeeds.map((seed) => {
    const matches = artifacts.filter((artifact) => overlapScore(artifactText(artifact), seed.keywords) >= 0.35);
    const lastSeen = matches
      .map((artifact) => artifactDate(artifact))
      .sort((a, b) => safeDate(b) - safeDate(a))[0] ?? "2024-01-01T00:00:00.000Z";
    const occurrenceCount = Math.max(matches.length, 1);
    const confidenceScore = Math.min(0.96, 0.45 + occurrenceCount / 20);
    return {
      patternId: seed.patternId,
      name: seed.name,
      description: seed.description,
      triggerConditions: seed.triggerConditions,
      typicalResolutionPath: seed.typicalResolutionPath,
      averageResolutionTime: computeAverageResolutionHours(seed.patternId, matches.length > 0 ? matches : artifacts),
      occurrenceCount,
      lastSeen,
      confidenceScore,
      involvedSystems: seed.involvedSystems,
      regulatoryRelevance: seed.regulatoryRelevance,
      relatedPatternIds: [] as string[],
    };
  });

  for (const pattern of patterns) {
    pattern.relatedPatternIds = patterns
      .filter(
        (candidate) =>
          candidate.patternId !== pattern.patternId &&
          candidate.involvedSystems.some((system) => pattern.involvedSystems.includes(system)),
      )
      .map((candidate) => candidate.patternId)
      .slice(0, 4);
  }

  return patterns;
}

function deriveDomainsFromText(text: string): string[] {
  const lower = toLower(text);
  const domains: string[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      domains.push(domain);
    }
  }
  return domains;
}

function buildSmeRoutingTable(artifacts: KnowledgeArtifact[]): SmeRoutingEntry[] {
  const activityByPerson = new Map<string, Array<{ id: string; at: string; text: string }>>();
  for (const artifact of artifacts) {
    if (artifact.type === "slack") {
      for (const message of artifact.messages) {
        const list = activityByPerson.get(message.sender) ?? [];
        list.push({ id: artifact.id, at: message.timestamp, text: message.body });
        activityByPerson.set(message.sender, list);
      }
      continue;
    }
    if (artifact.type === "jira") {
      const ownerList = activityByPerson.get(artifact.owner) ?? [];
      ownerList.push({ id: artifact.ticketKey, at: artifact.resolvedAt, text: artifact.summary });
      activityByPerson.set(artifact.owner, ownerList);
      for (const comment of artifact.comments) {
        const list = activityByPerson.get(comment.author) ?? [];
        list.push({ id: artifact.ticketKey, at: comment.timestamp, text: comment.body });
        activityByPerson.set(comment.author, list);
      }
      continue;
    }
    const list = activityByPerson.get(artifact.author) ?? [];
    list.push({ id: artifact.id, at: artifact.publishedAt, text: artifact.title });
    activityByPerson.set(artifact.author, list);
  }

  return CAST.map((person) => {
    const personActivities = activityByPerson.get(person.name) ?? [];
    const sortedActivities = [...personActivities].sort((a, b) => safeDate(b.at) - safeDate(a.at));
    const recentInvolvements = Array.from(new Set(sortedActivities.map((item) => item.id))).slice(0, 10);
    const allText = sortedActivities.map((item) => item.text).join(" ");
    const domains = deriveDomainsFromText(allText);
    const confidenceByDomain: Record<string, number> = {};
    for (const domain of domains) {
      const domainHits = sortedActivities.filter((item) => deriveDomainsFromText(item.text).includes(domain)).length;
      let score = Math.min(0.96, 0.2 + domainHits / 10);
      if (person.name === "Dev Chatterjee" && ["validator_reliability", "corporate_actions"].includes(domain)) {
        score = Math.min(score, 0.62);
      }
      confidenceByDomain[domain] = Number(score.toFixed(2));
    }
    const lastActiveDate = sortedActivities[0]?.at ?? "2024-01-01T00:00:00.000Z";

    return {
      personId: person.personId,
      name: person.name,
      role: person.role,
      status: person.status,
      expertiseDomains: domains.length > 0 ? domains : ["ops_process"],
      recentInvolvements,
      confidenceByDomain,
      replacedBy: person.replacedBy,
      lastActiveDate,
    };
  });
}

function buildCorrelations(patterns: PatternLibraryEntry[]): CorrelationMapEntry[] {
  const correlations: CorrelationMapEntry[] = [
    {
      correlationId: "corr-cas-queue-15m",
      systemA: "CAS",
      systemB: "queue",
      correlationType: "degradation_cascade",
      observedCount: 7,
      description: "CAS degradation correlates with queue backup within a short operational window.",
      supportingTicketIds: ["INFRA-511", "INFRA-588", "INFRA-392"],
      confidenceScore: 0.88,
    },
    {
      correlationId: "corr-validator-refresh",
      systemA: "validator",
      systemB: "CAS",
      correlationType: "stale_reference_data",
      observedCount: 6,
      description: "Validator failures increase immediately after securities refresh or schema drift periods.",
      supportingTicketIds: ["VAL-233", "OPS-8492", "INFRA-566"],
      confidenceScore: 0.83,
    },
    {
      correlationId: "corr-fhsa-hold-rate",
      systemA: "compliance",
      systemB: "queue",
      correlationType: "account_type_regulatory_load",
      observedCount: 4,
      description: "FHSA handling uncertainty correlates with elevated compliance hold and reroute rates.",
      supportingTicketIds: ["OPS-620", "OPS-673", "DOC-114"],
      confidenceScore: 0.72,
    },
    {
      correlationId: "corr-corporate-action-cusip",
      systemA: "ATON",
      systemB: "validator",
      correlationType: "corporate_action_identifier_drift",
      observedCount: 8,
      description: "Corporate action windows strongly correlate with CUSIP mismatch probability.",
      supportingTicketIds: ["OPS-8492", "OPS-7711", "OPS-7826"],
      confidenceScore: 0.9,
    },
    {
      correlationId: "corr-validator-peak-volume",
      systemA: "validator",
      systemB: "queue",
      correlationType: "peak_window_failure_risk",
      observedCount: 5,
      description: "Legacy validator logic fails more frequently during seasonal peak transfer windows.",
      supportingTicketIds: ["VAL-267", "INFRA-588", "OPS-940"],
      confidenceScore: 0.79,
    },
  ];

  for (const pattern of patterns) {
    const systems = pattern.involvedSystems;
    if (systems.length >= 2) {
      const existing = correlations.find(
        (item) => item.systemA === systems[0] && item.systemB === systems[1],
      );
      if (!existing) {
        correlations.push({
          correlationId: `corr-${slugify(pattern.patternId)}`,
          systemA: systems[0],
          systemB: systems[1],
          correlationType: "pattern_cooccurrence",
          observedCount: pattern.occurrenceCount,
          description: `Observed relationship inferred from ${pattern.name}.`,
          supportingTicketIds: [],
          confidenceScore: Number(Math.min(0.74, 0.45 + pattern.occurrenceCount / 20).toFixed(2)),
        });
      }
    }
  }

  return correlations;
}

/**
 * Recency index uses an exponential time-decay:
 * relevance = exp(-ln(2) * daysSinceLastSeen / 180)
 * Half-life is 180 days so recent signals outrank older historical context.
 */
function buildRecencyIndex(state: Omit<SynthesizedKnowledgeState, "recencyIndex">): RecencyIndexEntry[] {
  const now = Date.now();
  const halfLifeDays = 180;
  const lambda = Math.log(2) / halfLifeDays;
  const entries: RecencyIndexEntry[] = [];

  for (const pattern of state.patterns) {
    const days = Math.max(0, (now - safeDate(pattern.lastSeen)) / (1000 * 60 * 60 * 24));
    const relevanceScore = Number(Math.exp(-lambda * days).toFixed(4));
    entries.push({
      entryId: pattern.patternId,
      entryType: "pattern",
      lastSeen: pattern.lastSeen,
      relevanceScore,
    });
  }

  for (const sme of state.smeRoutingTable) {
    const days = Math.max(0, (now - safeDate(sme.lastActiveDate)) / (1000 * 60 * 60 * 24));
    const relevanceScore = Number(Math.exp(-lambda * days).toFixed(4));
    entries.push({
      entryId: sme.personId,
      entryType: "sme",
      lastSeen: sme.lastActiveDate,
      relevanceScore,
    });
  }

  return entries;
}

async function maybeRefineWithLlm(
  artifacts: KnowledgeArtifact[],
  base: Omit<SynthesizedKnowledgeState, "recencyIndex">,
): Promise<Omit<SynthesizedKnowledgeState, "recencyIndex">> {
  const client = getOpenAIClient();
  if (!client || !hasOpenAIKey()) {
    return base;
  }

  const digest = artifacts.slice(0, 50).map((artifact) => ({
    id: artifact.id,
    type: artifact.type,
    title: artifact.type === "jira" ? `${artifact.ticketKey}: ${artifact.title}` : artifact.title,
    date: artifactDate(artifact),
    systems: extractSystems(artifactText(artifact)),
    summary: artifactText(artifact).slice(0, 450),
  }));

  try {
    const completion = await client.chat.completions.create({
      model: SYNTHESIS_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You refine incident knowledge bases. Return strict JSON with keys: patternOverrides, correlationOverrides. Keep same ids if present, and include rationale in prose fields.",
        },
        {
          role: "user",
          content: JSON.stringify({
            digest,
            patterns: base.patterns,
            correlations: base.correlationMap,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return base;
    }
    const parsed = JSON.parse(raw) as {
      patternOverrides?: PatternLibraryEntry[];
      correlationOverrides?: CorrelationMapEntry[];
    };

    return {
      ...base,
      patterns: parsed.patternOverrides?.length ? parsed.patternOverrides : base.patterns,
      correlationMap:
        parsed.correlationOverrides?.length ? parsed.correlationOverrides : base.correlationMap,
    };
  } catch {
    return base;
  }
}

async function persistState(state: SynthesizedKnowledgeState): Promise<void> {
  await fs.mkdir(SYNTH_DIR, { recursive: true });
  await fs.writeFile(SYNTH_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function buildSynthesizedKnowledge(): Promise<SynthesizedKnowledgeState> {
  const artifacts = listKnowledgeArtifacts();
  const now = new Date().toISOString();
  const baseNoRecency: Omit<SynthesizedKnowledgeState, "recencyIndex"> = {
    version: SYNTH_STATE_VERSION,
    builtAt: now,
    lastUpdatedAt: now,
    sourceArtifactCount: artifacts.length,
    patterns: buildBasePatterns(artifacts),
    smeRoutingTable: buildSmeRoutingTable(artifacts),
    correlationMap: buildCorrelations(buildBasePatterns(artifacts)),
  };

  const refined = await maybeRefineWithLlm(artifacts, baseNoRecency);
  const state: SynthesizedKnowledgeState = {
    ...refined,
    recencyIndex: buildRecencyIndex(refined),
  };

  await persistState(state);
  console.info(`Synthesized knowledge layer built from ${artifacts.length} artifacts.`);
  cachedState = state;
  return state;
}

export async function loadSynthesizedKnowledge(): Promise<SynthesizedKnowledgeState> {
  if (cachedState && cachedState.version === SYNTH_STATE_VERSION) {
    return cachedState;
  }
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const raw = await fs.readFile(SYNTH_FILE, "utf8");
      const parsed = JSON.parse(raw) as SynthesizedKnowledgeState;
      if (parsed.version !== SYNTH_STATE_VERSION) {
        return buildSynthesizedKnowledge();
      }
      cachedState = parsed;
      return parsed;
    } catch {
      return buildSynthesizedKnowledge();
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

export async function querySynthesizedKnowledge(
  context: QueryContext,
): Promise<SynthesizedQueryResult> {
  const state = await loadSynthesizedKnowledge();
  const joined = [
    context.rawError,
    context.description,
    context.accountType ?? "",
    context.product ?? "",
    context.severity ?? "",
  ].join(" ");
  const systems = extractSystems(joined);
  const domains = deriveDomainsFromText(joined);

  const recencyById = new Map(state.recencyIndex.map((item) => [item.entryId, item.relevanceScore]));

  const patternScores = state.patterns
    .map((pattern) => {
      const keywordScore = overlapScore(
        joined,
        [
          ...pattern.triggerConditions,
          ...pattern.involvedSystems,
          pattern.name,
          ...pattern.typicalResolutionPath,
        ],
      );
      const systemScore =
        systems.length === 0
          ? 0
          : pattern.involvedSystems.filter((system) => systems.includes(system)).length /
            pattern.involvedSystems.length;
      const recencyScore = recencyById.get(pattern.patternId) ?? 0.1;
      const score = 0.5 * keywordScore + 0.25 * systemScore + 0.15 * pattern.confidenceScore + 0.1 * recencyScore;
      return {
        patternId: pattern.patternId,
        score: Number(score.toFixed(4)),
        reason: `${pattern.name} matched by system overlap (${systems.join(", ") || "none"}) and trigger language.`,
      };
    })
    .filter((item) => item.score >= 0.33)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const matchedPatternIds = new Set(patternScores.map((item) => item.patternId));
  const matchedPatterns = state.patterns.filter((pattern) => matchedPatternIds.has(pattern.patternId));

  const correlations = state.correlationMap
    .filter((correlation) => systems.includes(correlation.systemA) || systems.includes(correlation.systemB))
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 5);

  const smeRecommendations = state.smeRoutingTable
    .map((sme) => {
      const recency = recencyById.get(sme.personId) ?? 0.1;
      const domainScore =
        domains.length === 0
          ? 0
          : domains.reduce((sum, domain) => sum + (sme.confidenceByDomain[domain] ?? 0), 0) /
            domains.length;
      const patternSystemBoost = matchedPatterns.some((pattern) =>
        pattern.involvedSystems.some((system) =>
          sme.expertiseDomains.some((domain) => domain.includes(system.toLowerCase()) || system === "compliance"),
        ),
      )
        ? 0.15
        : 0;
      const departedPenalty = sme.status === "Departed" ? 0.25 : 0;
      const specialization = specialistBoost(sme.personId, systems, domains, joined);
      const nonCompliancePenalty =
        (sme.personId === "marcus-thibodeau" || sme.personId === "elena-vasquez") &&
        !systems.includes("compliance") &&
        !domains.includes("compliance_regulatory")
          ? 0.08
          : 0;
      const managerPenalty =
        sme.personId === "raj-khoury" &&
        domains.length > 0 &&
        !domains.includes("ops_process")
          ? 0.07
          : 0;
      const broadOpsPenalty =
        sme.personId === "sarah-jenkins" && domains.length > 0 && domains.every((domain) => domain !== "ops_process")
          ? 0.04
          : 0;
      const score = Math.max(
        0,
        Number(
          (
            0.5 * domainScore +
            0.22 * recency +
            patternSystemBoost +
            specialization -
            departedPenalty -
            nonCompliancePenalty -
            managerPenalty -
            broadOpsPenalty
          ).toFixed(4),
        ),
      );
      return {
        personId: sme.personId,
        score,
        reason:
          sme.status === "Departed" && sme.replacedBy
            ? `${sme.name} is historically strong in this domain but departed. Route through replacement ${sme.replacedBy}.`
            : `${sme.name} matches current domains (${domains.join(", ") || "general ops"}) with recent involvement.`,
      };
    })
    .filter((item) => item.score > 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const fastPathConfidence = patternScores[0]?.score ?? 0;
  return {
    patterns: patternScores,
    correlations,
    smeRecommendations,
    fastPathConfidence,
  };
}

function mergeDomainConfidences(
  original: Record<string, number>,
  domains: string[],
  delta: number,
): Record<string, number> {
  const next = { ...original };
  for (const domain of domains) {
    next[domain] = Number(Math.min(0.99, (next[domain] ?? 0.2) + delta).toFixed(2));
  }
  return next;
}

async function classifyPatternUpdateWithLlm(
  state: SynthesizedKnowledgeState,
  resolvedTicket: OpsTicket,
): Promise<{ action: "reinforce" | "new"; patternId?: string; reason: string } | null> {
  const client = getOpenAIClient();
  if (!client || !hasOpenAIKey()) {
    return null;
  }

  try {
    const completion = await client.chat.completions.create({
      model: SYNTHESIS_MODEL,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Classify whether the resolved ticket reinforces an existing pattern or introduces a new one. Return JSON: {action, patternId, reason}.",
        },
        {
          role: "user",
          content: JSON.stringify({
            ticket: {
              id: resolvedTicket.id,
              rawError: resolvedTicket.rawError,
              diagnosis: resolvedTicket.diagnosis,
              resolutionSteps: resolvedTicket.resolutionSteps.map((step) => step.details),
            },
            patterns: state.patterns.map((pattern) => ({
              patternId: pattern.patternId,
              name: pattern.name,
              triggerConditions: pattern.triggerConditions,
              systems: pattern.involvedSystems,
            })),
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      action?: "reinforce" | "new";
      patternId?: string;
      reason?: string;
    };
    if (!parsed.action || !parsed.reason) {
      return null;
    }
    return {
      action: parsed.action,
      patternId: parsed.patternId,
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}

export async function updateSynthesizedKnowledge(
  resolvedTicket: OpsTicket,
  blueprintUsed: TicketBlueprint,
  operatorNotes?: string,
): Promise<void> {
  const state = await loadSynthesizedKnowledge();
  const now = new Date().toISOString();
  const joined = [
    resolvedTicket.rawError,
    resolvedTicket.diagnosis,
    ...resolvedTicket.resolutionSteps.map((step) => step.details),
    operatorNotes ?? "",
  ].join(" ");
  const domains = deriveDomainsFromText(joined);
  const systems = extractSystems(joined);

  const llmUpdate = await classifyPatternUpdateWithLlm(state, resolvedTicket);

  let updatedPatternId: string | null = null;
  if (llmUpdate?.action === "reinforce" && llmUpdate.patternId) {
    const pattern = state.patterns.find((item) => item.patternId === llmUpdate.patternId);
    if (pattern) {
      pattern.occurrenceCount += 1;
      pattern.lastSeen = now;
      pattern.confidenceScore = Number(Math.min(0.99, pattern.confidenceScore + 0.02).toFixed(2));
      updatedPatternId = pattern.patternId;
    }
  }

  if (!updatedPatternId) {
    const scored = state.patterns
      .map((pattern) => ({
        pattern,
        score: overlapScore(
          joined,
          [...pattern.triggerConditions, ...pattern.involvedSystems, pattern.name, pattern.description],
        ),
      }))
      .sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score >= 0.34) {
      scored[0].pattern.occurrenceCount += 1;
      scored[0].pattern.lastSeen = now;
      scored[0].pattern.confidenceScore = Number(
        Math.min(0.99, scored[0].pattern.confidenceScore + 0.02).toFixed(2),
      );
      updatedPatternId = scored[0].pattern.patternId;
    }
  }

  if (!updatedPatternId) {
    const newPatternId = `pat-${slugify(resolvedTicket.rawError)}-${Date.now().toString().slice(-5)}`;
    state.patterns.push({
      patternId: newPatternId,
      name: `Emergent pattern from ${resolvedTicket.rawError}`,
      description: llmUpdate?.reason || `Newly observed incident class from ${resolvedTicket.id}.`,
      triggerConditions: [`rawError=${resolvedTicket.rawError}`, ...systems.slice(0, 2)],
      typicalResolutionPath: blueprintUsed.resolutionSteps.map((step) => step.details).slice(0, 5),
      averageResolutionTime: "pending",
      occurrenceCount: 1,
      lastSeen: now,
      confidenceScore: 0.42,
      involvedSystems: systems.length > 0 ? systems : ["ATON", "queue"],
      regulatoryRelevance: systems.includes("compliance"),
      relatedPatternIds: state.patterns
        .filter((pattern) =>
          pattern.involvedSystems.some((system) => systems.includes(system)),
        )
        .map((pattern) => pattern.patternId)
        .slice(0, 3),
    });
    updatedPatternId = newPatternId;
  }

  for (const sme of blueprintUsed.smes) {
    const routingEntry = state.smeRoutingTable.find((entry) => entry.name === sme.name);
    if (!routingEntry) {
      continue;
    }
    routingEntry.recentInvolvements = [
      resolvedTicket.id,
      ...routingEntry.recentInvolvements.filter((item) => item !== resolvedTicket.id),
    ].slice(0, 10);
    routingEntry.lastActiveDate = now;
    routingEntry.confidenceByDomain = mergeDomainConfidences(
      routingEntry.confidenceByDomain,
      domains.length > 0 ? domains : ["ops_process"],
      routingEntry.status === "Departed" ? 0 : 0.03,
    );
    routingEntry.expertiseDomains = Array.from(
      new Set([
        ...routingEntry.expertiseDomains,
        ...(domains.length > 0 ? domains : ["ops_process"]),
      ]),
    );
  }

  if (systems.length >= 2) {
    const [systemA, systemB] = systems;
    const existing = state.correlationMap.find(
      (entry) =>
        (entry.systemA === systemA && entry.systemB === systemB) ||
        (entry.systemA === systemB && entry.systemB === systemA),
    );
    if (existing) {
      existing.observedCount += 1;
      existing.supportingTicketIds = Array.from(
        new Set([...existing.supportingTicketIds, resolvedTicket.id]),
      ).slice(-10);
      existing.confidenceScore = Number(Math.min(0.99, existing.confidenceScore + 0.01).toFixed(2));
    } else {
      state.correlationMap.push({
        correlationId: `corr-${slugify(systemA)}-${slugify(systemB)}-${Date.now().toString().slice(-4)}`,
        systemA,
        systemB,
        correlationType: "new_observed_relationship",
        observedCount: 1,
        description: `Observed together while resolving ${resolvedTicket.id}.`,
        supportingTicketIds: [resolvedTicket.id],
        confidenceScore: 0.48,
      });
    }
  }

  state.lastUpdatedAt = now;
  state.recencyIndex = buildRecencyIndex({
    version: state.version,
    builtAt: state.builtAt,
    lastUpdatedAt: state.lastUpdatedAt,
    sourceArtifactCount: state.sourceArtifactCount,
    patterns: state.patterns,
    smeRoutingTable: state.smeRoutingTable,
    correlationMap: state.correlationMap,
  });

  await persistState(state);
  cachedState = state;
  console.info(
    `[synthesized-knowledge] updated ticket=${resolvedTicket.id} pattern=${updatedPatternId} reason=${llmUpdate?.reason ?? "heuristic update"}`,
  );
  // PHASE 2: This is where the system compounds. Every resolution makes
  // the next diagnosis faster and more accurate.
  // PHASE 3 SWAP POINT: push this job into SQS/Inngest instead of direct invocation.
}

// PHASE 3 SWAP POINT: pattern relationships should move to a graph DB (Neo4j)
// for richer traversal than this flat JSON representation.
