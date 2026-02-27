export type Severity = "Low" | "Medium" | "High" | "Critical";

export type TicketStatus = "Open" | "Flagged for Human Review" | "Authorized";

export type ResolutionStepStatus = "Pending" | "In Progress" | "Complete";

export type EvidenceSourceType =
  | "ticket"
  | "jira"
  | "slack"
  | "confluence"
  | "regulatory";

export type SmeStatus = "Active" | "Departed";

export interface ResolutionStep {
  id: string;
  title: string;
  details: string;
  status: ResolutionStepStatus;
  reviewed: boolean;
  payloadJson?: string;
}

export interface EvidenceNode {
  id: string;
  sourceType: EvidenceSourceType;
  label: string;
  snippet: string;
  documentRef: string;
  position: {
    x: number;
    y: number;
  };
}

export interface EvidenceEdge {
  id: string;
  source: string;
  target: string;
  label: "Same error class" | "Referenced in resolution" | "Regulatory overlap";
}

export interface Sme {
  id: string;
  name: string;
  role: string;
  status: SmeStatus;
}

export interface SMEReference {
  id: string;
  name: string;
  role: string;
  status: SmeStatus;
  citationArtifactIds: string[];
}

export interface TicketBlueprint {
  diagnosis: string;
  severity: Severity;
  accountType: string;
  product: string;
  confidenceScore: number;
  solutionSummary: string | null;
  priorResolutionTeam: SMEReference[];
  draftMessage: string;
  resolutionSteps: ResolutionStep[];
  evidenceNodes: EvidenceNode[];
  evidenceEdges: EvidenceEdge[];
  smes: Sme[];
}

export type BlueprintType = TicketBlueprint;

export interface OpsTicket extends TicketBlueprint {
  id: string;
  rawError: string;
  ingestedAt: string;
  blueprintGeneratedAt: string;
  unread: boolean;
  status: TicketStatus;
}

export interface IngestPayload {
  ticketId?: string;
  rawError: string;
  accountType?: string;
  product?: string;
  severity?: Severity;
  context: {
    pipelineStage: string;
    attemptedAction: string;
    lastSuccessfulState: string;
    sourceInstitution: string;
    existingFlags: {
      overContributionHistory: string;
      amlStatus: string;
      pendingReviews: string[];
    };
    additionalSignals?: string[];
    operatorNarrative?: string;
  };
}

export interface AuditLogEntry {
  id: string;
  message: string;
  at: string;
}
