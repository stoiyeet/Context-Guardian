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
  confidence: ConfidenceBreakdown;
  evidenceCitations: EvidenceCitation[];
  patternIds: string[];
  correlationIds: string[];
  routedSmeIds: string[];
  degradedReason?: string;
};
