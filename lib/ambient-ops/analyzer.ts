import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  getArtifactsByIds,
  getPeopleByIds,
  memoryGraph,
} from "@/lib/ambient-ops/memory";
import type {
  AnalysisResponse,
  IncidentCategory,
  IncidentClassification,
  IncidentInput,
  MemoryIncident,
  ResolverRecommendation,
  SimilarIncidentMatch,
  StorylineItem,
} from "@/lib/ambient-ops/types";

const MAX_TERMINAL_HISTORY = 25;

type KeywordRule = {
  category: IncidentCategory;
  keywords: string[];
  negativeKeywords?: string[];
  weight?: number;
};

const KEYWORD_RULES: KeywordRule[] = [
  {
    category: "dependency_registry_auth",
    keywords: [
      "e401",
      "401",
      "unauthorized",
      "registry",
      ".npmrc",
      "npm",
      "artifactory",
      "bearer realm",
      "token",
      "private package",
    ],
    negativeKeywords: ["certificate", "issuer"],
    weight: 1.2,
  },
  {
    category: "ci_cache_corruption",
    keywords: [
      "cache",
      "remote cache",
      "stale",
      "artifact",
      "turbo",
      "cache hit",
      "lockfile hash",
      "restored cache",
      "ts2307",
    ],
    weight: 1.15,
  },
  {
    category: "build_toolchain_version_drift",
    keywords: [
      "unsupported engine",
      "pnpm",
      "corepack",
      "node version",
      "lockfile breaking change",
      "err_pnpm",
      "nvmrc",
      "toolchain",
      "version mismatch",
    ],
    weight: 1.15,
  },
  {
    category: "database_migration_lock",
    keywords: [
      "migration",
      "schema_migrations",
      "lock timeout",
      "another migration is already running",
      "deadlock",
      "advisory lock",
      "relation",
    ],
    weight: 1.2,
  },
  {
    category: "kubernetes_config_drift",
    keywords: [
      "helm",
      "kubernetes",
      "values-prod",
      "configmap",
      "secret reference",
      "crashloopbackoff",
      "missing key",
      "manifest",
    ],
    weight: 1.15,
  },
  {
    category: "permissions_access_policy",
    keywords: [
      "accessdenied",
      "access denied",
      "403 forbidden",
      "not authorized",
      "assumerole",
      "kms:decrypt",
      "iam",
      "policy",
      "permission",
    ],
    weight: 1.25,
  },
  {
    category: "tls_proxy_certificate",
    keywords: [
      "certificate",
      "ssl",
      "tls",
      "local issuer",
      "unknown authority",
      "self signed certificate",
      "x509",
      "ca bundle",
      "proxy",
    ],
    weight: 1.2,
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9:@._/-]+/g, " ")
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function uniqueTokens(text: string): Set<string> {
  return new Set(tokenize(text));
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const denominator = Math.max(a.size, b.size);
  return intersection / denominator;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function recentnessScore(iso: string): number {
  const now = Date.now();
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  const days = Math.max(0, (now - then) / (1000 * 60 * 60 * 24));
  if (days <= 14) return 1;
  if (days <= 45) return 0.75;
  if (days <= 120) return 0.45;
  return 0.2;
}

function parseJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // try to extract the first JSON object if the model wraps text around it
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitizedInput(input: IncidentInput): IncidentInput {
  return {
    ...input,
    errorText: input.errorText.trim(),
    userDescription: input.userDescription?.trim() || undefined,
    terminalHistory: (input.terminalHistory ?? [])
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-MAX_TERMINAL_HISTORY),
  };
}

function buildCombinedInputText(input: IncidentInput): string {
  return [
    `error: ${input.errorText}`,
    input.userDescription ? `description: ${input.userDescription}` : "",
    `component: ${input.component}`,
    `environment: ${input.environment}`,
    `surface: ${input.surface}`,
    ...(input.terminalHistory ?? []).map((line) => `history: ${line}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function classifyHeuristically(input: IncidentInput): IncidentClassification {
  const combinedText = normalize(buildCombinedInputText(input));
  const scoreByCategory = new Map<IncidentCategory, number>();
  const signalsByCategory = new Map<IncidentCategory, Set<string>>();

  for (const category of CATEGORY_VALUES) {
    scoreByCategory.set(category, 0);
    signalsByCategory.set(category, new Set<string>());
  }

  for (const rule of KEYWORD_RULES) {
    const weight = rule.weight ?? 1;
    for (const keyword of rule.keywords) {
      if (combinedText.includes(normalize(keyword))) {
        scoreByCategory.set(
          rule.category,
          (scoreByCategory.get(rule.category) ?? 0) + weight,
        );
        signalsByCategory.get(rule.category)?.add(keyword);
      }
    }
    for (const negative of rule.negativeKeywords ?? []) {
      if (combinedText.includes(normalize(negative))) {
        scoreByCategory.set(
          rule.category,
          (scoreByCategory.get(rule.category) ?? 0) - weight * 0.45,
        );
      }
    }
  }

  if (input.surface === "ci") {
    scoreByCategory.set(
      "ci_cache_corruption",
      (scoreByCategory.get("ci_cache_corruption") ?? 0) + 0.25,
    );
    scoreByCategory.set(
      "dependency_registry_auth",
      (scoreByCategory.get("dependency_registry_auth") ?? 0) + 0.15,
    );
    scoreByCategory.set(
      "permissions_access_policy",
      (scoreByCategory.get("permissions_access_policy") ?? 0) + 0.15,
    );
  }

  if (input.surface === "deploy") {
    scoreByCategory.set(
      "kubernetes_config_drift",
      (scoreByCategory.get("kubernetes_config_drift") ?? 0) + 0.2,
    );
    scoreByCategory.set(
      "database_migration_lock",
      (scoreByCategory.get("database_migration_lock") ?? 0) + 0.2,
    );
  }

  if (input.environment === "local") {
    scoreByCategory.set(
      "tls_proxy_certificate",
      (scoreByCategory.get("tls_proxy_certificate") ?? 0) + 0.1,
    );
    scoreByCategory.set(
      "build_toolchain_version_drift",
      (scoreByCategory.get("build_toolchain_version_drift") ?? 0) + 0.1,
    );
  }

  const ranked = [...scoreByCategory.entries()].sort((a, b) => b[1] - a[1]);
  const [bestCategory, bestScoreRaw] = ranked[0] ?? [
    "ci_cache_corruption" as IncidentCategory,
    0,
  ];
  const secondScore = ranked[1]?.[1] ?? 0;
  const bestScore = Math.max(0, bestScoreRaw);
  const margin = bestScore - secondScore;
  const confidence = clamp(0.42 + bestScore * 0.08 + margin * 0.1, 0.35, 0.96);
  const keySignals = [...(signalsByCategory.get(bestCategory) ?? new Set<string>())].slice(
    0,
    6,
  );

  const rationaleParts = [
    keySignals.length > 0 ? `Matched signals: ${keySignals.join(", ")}` : "Few explicit keyword matches; using context fields and surface/environment priors.",
    `Surface=${input.surface}, environment=${input.environment}, component=${input.component}.`,
  ];

  return {
    category: bestCategory,
    label: CATEGORY_LABELS[bestCategory],
    confidence: Number(confidence.toFixed(2)),
    rationale: rationaleParts.join(" "),
    keySignals,
    inferredComponent: input.component,
  };
}

type OpenAIClassification = {
  category: IncidentCategory;
  confidence?: number;
  rationale?: string;
  keySignals?: string[];
  inferredComponent?: string;
};

async function classifyWithOpenAI(input: IncidentInput): Promise<IncidentClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const categorySpec = CATEGORY_VALUES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    description: CATEGORY_DESCRIPTIONS[category],
  }));

  const prompt = [
    "Classify the engineering incident into exactly one category.",
    "Use the provided context fields (error text, component, environment, surface, terminal history).",
    "Return strict JSON with keys: category, confidence, rationale, keySignals, inferredComponent.",
    "confidence must be a number 0..1.",
    `Allowed categories: ${CATEGORY_VALUES.join(", ")}`,
  ].join("\n");

  const body = {
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            categoryDefinitions: categorySpec,
            incident: input,
          },
          null,
          2,
        ),
      },
    ],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = parseJsonObject(content) as OpenAIClassification | null;
    if (!parsed || !parsed.category || !CATEGORY_VALUES.includes(parsed.category)) {
      return null;
    }

    return {
      category: parsed.category,
      label: CATEGORY_LABELS[parsed.category],
      confidence: Number(clamp(parsed.confidence ?? 0.7, 0.3, 0.99).toFixed(2)),
      rationale:
        parsed.rationale?.trim() ||
        "OpenAI classified the incident using the provided error text and execution context.",
      keySignals: (parsed.keySignals ?? []).slice(0, 8),
      inferredComponent: parsed.inferredComponent?.trim() || input.component,
    };
  } catch {
    return null;
  }
}

function incidentTextCorpus(incident: MemoryIncident): string {
  return [
    incident.title,
    incident.summary,
    incident.observedPattern,
    incident.resolutionOutcome,
    incident.component,
    incident.environment,
    incident.surface,
    ...incident.signatureTerms,
    ...incident.errorExamples,
  ].join(" ");
}

function retrieveSimilarIncidents(
  input: IncidentInput,
  classification: IncidentClassification,
): SimilarIncidentMatch[] {
  const queryTokens = uniqueTokens(buildCombinedInputText(input));
  const queryComponentTokens = uniqueTokens(input.component);

  return memoryGraph.incidents
    .map((incident) => {
      const reasons: string[] = [];
      let score = 0;

      if (incident.category === classification.category) {
        score += 0.42;
        reasons.push(`same category (${CATEGORY_LABELS[incident.category]})`);
      }

      if (normalize(incident.environment) === normalize(input.environment)) {
        score += 0.1;
        reasons.push(`same environment (${input.environment})`);
      }

      if (incident.surface === input.surface) {
        score += 0.08;
        reasons.push(`same surface (${input.surface})`);
      }

      const componentOverlap = tokenOverlap(queryComponentTokens, uniqueTokens(incident.component));
      if (componentOverlap > 0) {
        score += componentOverlap * 0.16;
        reasons.push(`component overlap ${Math.round(componentOverlap * 100)}%`);
      }

      const textOverlap = tokenOverlap(queryTokens, uniqueTokens(incidentTextCorpus(incident)));
      if (textOverlap > 0) {
        score += textOverlap * 0.32;
        reasons.push(`error/context token overlap ${Math.round(textOverlap * 100)}%`);
      }

      const recency = recentnessScore(incident.lastSeenAt);
      score += recency * 0.07;
      if (recency >= 0.75) {
        reasons.push("recent recurrence");
      }

      // Favor incidents with concrete linked artifacts/people for operational usefulness.
      score += Math.min(incident.linkedArtifacts.length, 4) * 0.01;
      score += Math.min(incident.linkedPeople.length, 3) * 0.008;

      return {
        incidentId: incident.id,
        score: Number(clamp(score, 0, 1.5).toFixed(3)),
        similarityReasons: reasons.slice(0, 5),
      } satisfies SimilarIncidentMatch;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function recommendResolvers(
  matches: Array<SimilarIncidentMatch & { incident: MemoryIncident }>,
): ResolverRecommendation[] {
  const aggregate = new Map<
    string,
    {
      relevanceScore: number;
      reasons: Set<string>;
      linkedIncidentIds: Set<string>;
    }
  >();

  for (const match of matches) {
    const people = getPeopleByIds(match.incident.linkedPeople);
    const base = clamp(match.score, 0, 1.5);
    for (const person of people) {
      const recency = recentnessScore(person.lastWorkedOn);
      const roleBoost =
        /staff|senior|sre|reliability/i.test(person.role) ? 0.08 : 0.04;
      const score = base * 0.6 + recency * 0.2 + roleBoost;

      const existing = aggregate.get(person.id) ?? {
        relevanceScore: 0,
        reasons: new Set<string>(),
        linkedIncidentIds: new Set<string>(),
      };

      existing.relevanceScore += score;
      existing.reasons.add(`worked on ${match.incident.title}`);
      if (recency >= 0.75) existing.reasons.add("recently active on similar incidents");
      existing.reasons.add(`${person.team} owner context`);
      existing.linkedIncidentIds.add(match.incident.id);
      aggregate.set(person.id, existing);
    }
  }

  return [...aggregate.entries()]
    .map(([personId, value]) => {
      const person = getPeopleByIds([personId])[0];
      return {
        person,
        relevanceScore: Number(clamp(value.relevanceScore / 2.5, 0, 1).toFixed(2)),
        reasons: [...value.reasons].slice(0, 3),
        linkedIncidentIds: [...value.linkedIncidentIds],
      };
    })
    .filter((entry): entry is ResolverRecommendation => Boolean(entry.person))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);
}

function buildStoryline(
  matches: Array<SimilarIncidentMatch & { incident: MemoryIncident }>,
): StorylineItem[] {
  return matches.slice(0, 3).map((match) => {
    const incident = match.incident;
    const people = getPeopleByIds(incident.linkedPeople);
    const artifacts = getArtifactsByIds(incident.linkedArtifacts).sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
    );
    const teamOwners = [...new Set(people.map((person) => person.team))];

    return {
      title: `${incident.title} (${Math.round(match.score * 100)} similarity)`,
      summary: `${incident.summary} Resolution: ${incident.resolutionOutcome}`,
      incidentId: incident.id,
      incidentTitle: incident.title,
      artifacts,
      people,
      steps: incident.storyline,
      teamOwners,
      resolvedAt: incident.lastSeenAt,
    };
  });
}

export async function analyzeIncident(input: IncidentInput): Promise<AnalysisResponse> {
  const cleanedInput = sanitizedInput(input);
  const openAIClassification = await classifyWithOpenAI(cleanedInput);
  const classification = openAIClassification ?? classifyHeuristically(cleanedInput);
  const mode = openAIClassification ? "openai" : "heuristic";

  const matchShells = retrieveSimilarIncidents(cleanedInput, classification);
  const topMatches = matchShells.map((match) => {
    const incident = memoryGraph.incidents.find((entry) => entry.id === match.incidentId);
    if (!incident) {
      throw new Error(`Incident ${match.incidentId} not found in memory graph`);
    }
    return { ...match, incident };
  });

  return {
    requestId: `req_${Math.random().toString(36).slice(2, 10)}`,
    analyzedAt: new Date().toISOString(),
    mode,
    classification,
    topMatches,
    recommendedPeople: recommendResolvers(topMatches),
    storyline: buildStoryline(topMatches),
    capturedContext: {
      component: cleanedInput.component,
      environment: cleanedInput.environment,
      surface: cleanedInput.surface,
      terminalHistory: cleanedInput.terminalHistory ?? [],
      userDescription: cleanedInput.userDescription,
    },
  };
}

