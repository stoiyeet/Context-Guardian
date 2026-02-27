// PHASE 2: LLM INTEGRATION POINT
import { cloneBlueprintFromTicket } from "@/lib/dummyData";
import { runBlueprintInference } from "@/lib/inferencePipeline";
import type { InferenceMetadata } from "@/lib/inferenceTypes";
import { updateSynthesizedKnowledge } from "@/lib/synthesizedKnowledge";
import type {
  AuditLogEntry,
  EvidenceEdge,
  EvidenceNode,
  IngestPayload,
  OpsTicket,
  ResolutionStep,
  TicketBlueprint,
} from "@/lib/types";

let tickets: OpsTicket[] = [];
let inferenceMetaByTicketId: Record<string, InferenceMetadata> = {};
let auditLogByTicketId: Record<string, AuditLogEntry[]> = {};
let nextTicketNumber = 9_001;

function nextId(providedTicketId?: string): string {
  if (providedTicketId) {
    const numeric = Number.parseInt(providedTicketId.replace("OPS-", ""), 10);
    if (Number.isFinite(numeric) && numeric >= nextTicketNumber) {
      nextTicketNumber = numeric + 1;
    }
    return providedTicketId;
  }

  const generated = `OPS-${nextTicketNumber}`;
  nextTicketNumber += 1;
  return generated;
}

function cloneStep(step: ResolutionStep): ResolutionStep {
  return { ...step };
}

function cloneNode(node: EvidenceNode): EvidenceNode {
  return {
    ...node,
    position: { ...node.position },
  };
}

function cloneEdge(edge: EvidenceEdge): EvidenceEdge {
  return { ...edge };
}

function cloneTicket(ticket: OpsTicket): OpsTicket {
  return {
    ...ticket,
    resolutionSteps: ticket.resolutionSteps.map(cloneStep),
    evidenceNodes: ticket.evidenceNodes.map(cloneNode),
    evidenceEdges: ticket.evidenceEdges.map(cloneEdge),
    smes: ticket.smes.map((sme) => ({ ...sme })),
  };
}

function rewritePayloadTicketId(ticketId: string, payloadJson?: string): string | undefined {
  if (!payloadJson) {
    return payloadJson;
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    parsed.ticketId = ticketId;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return payloadJson;
  }
}

function findNodeIndexById(blueprint: TicketBlueprint, nodeId: string): number {
  const nodeIndex = blueprint.evidenceNodes.findIndex((node) => node.id === nodeId);
  return nodeIndex >= 0 ? nodeIndex : 0;
}

function withTicketScopedIds(ticketId: string, blueprint: TicketBlueprint): TicketBlueprint {
  return {
    ...blueprint,
    resolutionSteps: blueprint.resolutionSteps.map((step, index) => ({
      ...step,
      id: `${ticketId.toLowerCase()}-step-${index + 1}`,
      payloadJson: rewritePayloadTicketId(ticketId, step.payloadJson),
    })),
    evidenceNodes: blueprint.evidenceNodes.map((node, index) => ({
      ...node,
      id: `${ticketId.toLowerCase()}-node-${index + 1}`,
    })),
    evidenceEdges: blueprint.evidenceEdges.map((edge, index) => ({
      ...edge,
      id: `${ticketId.toLowerCase()}-edge-${index + 1}`,
      source: `${ticketId.toLowerCase()}-node-${findNodeIndexById(blueprint, edge.source) + 1}`,
      target: `${ticketId.toLowerCase()}-node-${findNodeIndexById(blueprint, edge.target) + 1}`,
    })),
  };
}

function applyPayloadOverrides(blueprint: TicketBlueprint, payload: IngestPayload): TicketBlueprint {
  return {
    ...blueprint,
    accountType: payload.accountType ?? blueprint.accountType,
    product: payload.product ?? blueprint.product,
    severity: payload.severity ?? blueprint.severity,
  };
}

function addAuditLog(ticketId: string, message: string): void {
  const current = auditLogByTicketId[ticketId] ?? [];
  auditLogByTicketId[ticketId] = [
    {
      id: `${ticketId.toLowerCase()}-audit-${current.length + 1}`,
      message,
      at: new Date().toISOString(),
    },
    ...current,
  ];
}

export function listTickets(): OpsTicket[] {
  return tickets
    .map(cloneTicket)
    .sort((a, b) => Date.parse(b.ingestedAt) - Date.parse(a.ingestedAt));
}

export function getInferenceMetadata(): Record<string, InferenceMetadata> {
  return { ...inferenceMetaByTicketId };
}

export function getAuditLogByTicketId(): Record<string, AuditLogEntry[]> {
  return Object.fromEntries(
    Object.entries(auditLogByTicketId).map(([ticketId, entries]) => [
      ticketId,
      entries.map((entry) => ({ ...entry })),
    ]),
  );
}

export async function ingestTicket(payload: IngestPayload): Promise<OpsTicket> {
  const ticketId = nextId(payload.ticketId);
  const ingestedAt = new Date().toISOString();

  const inferred = await runBlueprintInference({
    ...payload,
    ticketId,
    ingestedAt,
  });

  const blueprint = applyPayloadOverrides(inferred.blueprint, payload);
  const ticketScopedBlueprint = withTicketScopedIds(ticketId, blueprint);

  const newTicket: OpsTicket = {
    id: ticketId,
    rawError: payload.rawError,
    ingestedAt,
    blueprintGeneratedAt: inferred.blueprintGeneratedAt,
    unread: true,
    status: "Open",
    ...ticketScopedBlueprint,
  };

  tickets = [newTicket, ...tickets];
  inferenceMetaByTicketId = {
    ...inferenceMetaByTicketId,
    [ticketId]: inferred.metadata,
  };
  addAuditLog(ticketId, "Ticket ingested and inference blueprint generated.");
  if (inferred.metadata.unknownPattern) {
    addAuditLog(ticketId, "Unknown pattern state flagged. Routed for broad SME triage.");
  }
  return cloneTicket(newTicket);
}

export async function authorizeTicket(
  ticketId: string,
  options?: { operatorNotes?: string },
): Promise<OpsTicket | null> {
  const target = tickets.find((ticket) => ticket.id === ticketId);
  if (!target) {
    return null;
  }
  target.status = "Authorized";
  target.unread = false;
  addAuditLog(ticketId, "Resolution authorized by operator.");

  const blueprint = cloneBlueprintFromTicket(target);
  // PHASE 2: This runs asynchronously so operators are not blocked.
  // PHASE 3 SWAP POINT: emit this into an event queue (SQS/Inngest) for durable processing.
  void updateSynthesizedKnowledge(target, blueprint, options?.operatorNotes).catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown synthesized update error";
    addAuditLog(ticketId, `Synthesized knowledge update failed: ${message}`);
  });

  return cloneTicket(target);
}

export function isBlueprintReady(ticket: OpsTicket): boolean {
  return Date.now() >= Date.parse(ticket.blueprintGeneratedAt);
}

export function resetTicketStore(): void {
  tickets = [];
  inferenceMetaByTicketId = {};
  auditLogByTicketId = {};
  nextTicketNumber = 9_001;
}

// PHASE 2: replace with semantic/vector retrieval from a vector database.
export async function getSemanticNeighbors(ticketId: string): Promise<string[]> {
  void ticketId;
  return [];
}
