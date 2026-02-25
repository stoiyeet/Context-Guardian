export type IncidentCategory =
  | "dependency_registry_auth"
  | "ci_cache_corruption"
  | "build_toolchain_version_drift"
  | "database_migration_lock"
  | "kubernetes_config_drift"
  | "permissions_access_policy"
  | "tls_proxy_certificate";

export type ExecutionSurface = "terminal" | "ci" | "deploy" | "manual";
export type EnvironmentType = "local" | "staging" | "production" | "shared-ci";

export interface PersonRef {
  id: string;
  name: string;
  handle: string;
  team: string;
  role: string;
  lastWorkedOn: string;
}

export interface ResolutionArtifact {
  id: string;
  type: "pr" | "ticket" | "config_change" | "doc" | "runbook";
  label: string;
  url: string;
  summary: string;
  timestamp: string;
}

export interface ResolutionStep {
  at: string;
  actorId?: string;
  action: string;
}

export interface MemoryIncident {
  id: string;
  title: string;
  category: IncidentCategory;
  component: string;
  environment: EnvironmentType;
  surface: ExecutionSurface;
  signatureTerms: string[];
  errorExamples: string[];
  summary: string;
  observedPattern: string;
  resolutionOutcome: string;
  timeToResolveMinutes: number;
  recurrenceCount: number;
  lastSeenAt: string;
  linkedPeople: string[];
  linkedArtifacts: string[];
  storyline: ResolutionStep[];
}

export interface MemoryGraph {
  people: PersonRef[];
  artifacts: ResolutionArtifact[];
  incidents: MemoryIncident[];
}

export interface IncidentInput {
  errorText: string;
  component: string;
  environment: EnvironmentType;
  surface: ExecutionSurface;
  userDescription?: string;
  terminalHistory?: string[];
  workerId?: string;
  workerContextNotes?: string[];
}

export interface IncidentClassification {
  category: IncidentCategory;
  label: string;
  confidence: number;
  rationale: string;
  keySignals: string[];
  inferredComponent?: string;
}

export interface SimilarIncidentMatch {
  incidentId: string;
  score: number;
  similarityReasons: string[];
}

export interface ResolverRecommendation {
  person: PersonRef;
  relevanceScore: number;
  reasons: string[];
  linkedIncidentIds: string[];
}

export interface StorylineItem {
  title: string;
  summary: string;
  incidentId: string;
  incidentTitle: string;
  artifacts: ResolutionArtifact[];
  people: PersonRef[];
  steps: ResolutionStep[];
  teamOwners: string[];
  resolvedAt: string;
}

export interface AnalysisResponse {
  requestId: string;
  analyzedAt: string;
  mode: "openai" | "heuristic";
  classification: IncidentClassification;
  topMatches: Array<SimilarIncidentMatch & { incident: MemoryIncident }>;
  recommendedPeople: ResolverRecommendation[];
  storyline: StorylineItem[];
  capturedContext: {
    component: string;
    environment: EnvironmentType;
    surface: ExecutionSurface;
    terminalHistory: string[];
    userDescription?: string;
    workerId?: string;
    workerContextNotes?: string[];
  };
}
