export type ConnectionType =
  | "semantic similarity"
  | "explicit reference"
  | "same resolution path"
  | "same system component"
  | "regulatory overlap";

export type ConfidenceBreakdown = {
  overallConfidence: number;
  patternMatchConfidence: number;
  smeRoutingConfidence: number;
  resolutionPathConfidence: number;
  humanReadableCaveat: string;
};

export type EvidenceCitation = {
  artifactId: string;
  label: string;
  citation: string;
  connectionType: ConnectionType;
  score: number;
  href: string;
};

export type InferenceMetadata = {
  unknownPattern: boolean;
  contextSummary: {
    pipelineStage: string;
    attemptedAction: string;
    lastSuccessfulState: string;
    sourceInstitution: string;
    existingFlags: {
      overContributionHistory: string;
      amlStatus: string;
      pendingReviews: string[];
    };
    additionalSignals: string[];
    operatorNarrative?: string;
  };
  confidence: ConfidenceBreakdown;
  evidenceCitations: EvidenceCitation[];
  patternIds: string[];
  correlationIds: string[];
  routedSmeIds: string[];
  similarityRationale: string[];
  degradedReason?: string;
};
