// PHASE 2: LLM INTEGRATION POINT
import {
  buildGenericBlueprint,
  cloneBlueprintFromTicket,
} from "@/lib/dummyData";
import type {
  EvidenceEdge,
  EvidenceNode,
  IngestPayload,
  OpsTicket,
  ResolutionStep,
  TicketBlueprint,
} from "@/lib/types";

const DEFAULT_PROCESSING_DELAY_MS = 2_500;

let tickets: OpsTicket[] = [];
let nextTicketNumber =
  tickets
    .map((ticket) => Number.parseInt(ticket.id.replace("OPS-", ""), 10))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 9_000) + 1;

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

function getTemplateBlueprint(rawError: string): TicketBlueprint {
  return buildGenericBlueprint(rawError);

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

function findNodeIndexById(blueprint: TicketBlueprint, nodeId: string): number {
  const nodeIndex = blueprint.evidenceNodes.findIndex((node) => node.id === nodeId);
  return nodeIndex >= 0 ? nodeIndex : 0;
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

function applyPayloadOverrides(
  blueprint: TicketBlueprint,
  payload: IngestPayload,
): TicketBlueprint {
  return {
    ...blueprint,
    accountType: payload.accountType ?? blueprint.accountType,
    product: payload.product ?? blueprint.product,
    severity: payload.severity ?? blueprint.severity,
  };
}

export function listTickets(): OpsTicket[] {
  return tickets
    .map(cloneTicket)
    .sort((a, b) => Date.parse(b.ingestedAt) - Date.parse(a.ingestedAt));
}

export function ingestTicket(payload: IngestPayload): OpsTicket {
  const ticketId = nextId(payload.ticketId);
  const ingestedAt = new Date().toISOString();
  const processingDelay = DEFAULT_PROCESSING_DELAY_MS + Math.floor(Math.random() * 900);
  const blueprintGeneratedAt = new Date(Date.now() + processingDelay).toISOString();

  const blueprint = applyPayloadOverrides(getTemplateBlueprint(payload.rawError), payload);
  const ticketScopedBlueprint = withTicketScopedIds(ticketId, blueprint);

  const newTicket: OpsTicket = {
    id: ticketId,
    rawError: payload.rawError,
    ingestedAt,
    blueprintGeneratedAt,
    unread: true,
    status: "Open",
    ...ticketScopedBlueprint,
  };

  tickets = [newTicket, ...tickets];
  return cloneTicket(newTicket);
}

export function isBlueprintReady(ticket: OpsTicket): boolean {
  return Date.now() >= Date.parse(ticket.blueprintGeneratedAt);
}

export function resetTicketStore(): void {
  tickets = []
  nextTicketNumber =
    tickets
      .map((ticket) => Number.parseInt(ticket.id.replace("OPS-", ""), 10))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 9_000) + 1;
}

// PHASE 2: replace with semantic/vector retrieval from a vector database.
export async function getSemanticNeighbors(ticketId: string): Promise<string[]> {
  void ticketId;
  return [];
}
