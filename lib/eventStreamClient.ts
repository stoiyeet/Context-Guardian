import type { OpsTicket } from "@/lib/types";
import type { InferenceMetadata } from "@/lib/inferenceTypes";

export type TicketSnapshot = OpsTicket & {
  blueprintReady: boolean;
};

export type EventSnapshot = {
  tickets: TicketSnapshot[];
  inferenceByTicketId?: Record<string, InferenceMetadata>;
  auditLogByTicketId?: Record<
    string,
    Array<{
      id: string;
      message: string;
      at: string;
    }>
  >;
  serverTime: string;
};

export type StreamMode = "polling" | "sse" | "websocket";

const SNAPSHOT_STORAGE_KEY = "context-guardian:event-snapshot:v1";

function hasSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readPersistedSnapshot(): EventSnapshot | null {
  if (!hasSessionStorage()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as EventSnapshot;
  } catch {
    return null;
  }
}

function writePersistedSnapshot(snapshot: EventSnapshot): void {
  if (!hasSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore session storage write failures to avoid breaking the stream loop.
  }
}

export function clearPersistedEventSnapshot(): void {
  if (!hasSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(SNAPSHOT_STORAGE_KEY);
  } catch {
    // Ignore session storage failures.
  }
}

function mergeTickets(live: TicketSnapshot[], persisted: TicketSnapshot[]): TicketSnapshot[] {
  const byId = new Map<string, TicketSnapshot>();

  for (const ticket of persisted) {
    byId.set(ticket.id, ticket);
  }
  for (const ticket of live) {
    byId.set(ticket.id, ticket);
  }

  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(b.ingestedAt) - Date.parse(a.ingestedAt),
  );
}

function mergeInference(
  live: EventSnapshot["inferenceByTicketId"],
  persisted: EventSnapshot["inferenceByTicketId"],
): EventSnapshot["inferenceByTicketId"] {
  if (!live && !persisted) {
    return undefined;
  }
  return {
    ...(persisted ?? {}),
    ...(live ?? {}),
  };
}

function mergeAuditLog(
  live: EventSnapshot["auditLogByTicketId"],
  persisted: EventSnapshot["auditLogByTicketId"],
): EventSnapshot["auditLogByTicketId"] {
  if (!live && !persisted) {
    return undefined;
  }

  const ticketIds = new Set([
    ...Object.keys(persisted ?? {}),
    ...Object.keys(live ?? {}),
  ]);
  const merged: NonNullable<EventSnapshot["auditLogByTicketId"]> = {};

  for (const ticketId of ticketIds) {
    const combined = [...(persisted?.[ticketId] ?? []), ...(live?.[ticketId] ?? [])];
    const byId = new Map<string, (typeof combined)[number]>();
    for (const entry of combined) {
      byId.set(entry.id, entry);
    }
    merged[ticketId] = Array.from(byId.values()).sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at),
    );
  }

  return merged;
}

function mergeWithPersisted(
  live: EventSnapshot,
  persisted: EventSnapshot | null,
): EventSnapshot {
  if (!persisted) {
    return live;
  }

  return {
    tickets: mergeTickets(live.tickets, persisted.tickets),
    inferenceByTicketId: mergeInference(live.inferenceByTicketId, persisted.inferenceByTicketId),
    auditLogByTicketId: mergeAuditLog(live.auditLogByTicketId, persisted.auditLogByTicketId),
    serverTime: live.serverTime,
  };
}

function isTicketReady(ticket: TicketSnapshot, nowMs: number): boolean {
  if (typeof ticket.blueprintReady === "boolean") {
    return ticket.blueprintReady;
  }
  return Date.parse(ticket.blueprintGeneratedAt) <= nowMs;
}

type TicketInferenceApiResponse = {
  diagnosis?: string;
  severity?: OpsTicket["severity"];
  accountType?: string;
  product?: string;
  confidenceScore?: number;
  solutionSummary?: string | null;
  priorResolutionTeam?: OpsTicket["priorResolutionTeam"];
  draftMessage?: string;
  resolutionSteps?: OpsTicket["resolutionSteps"];
  evidenceNodes?: OpsTicket["evidenceNodes"];
  evidenceEdges?: OpsTicket["evidenceEdges"];
  smes?: OpsTicket["smes"];
  inferenceMeta?: InferenceMetadata;
  blueprintGeneratedAt?: string;
};

function buildInferenceRecoveryParams(
  ticket: TicketSnapshot,
  meta?: InferenceMetadata,
): URLSearchParams {
  const contextSummary = meta?.contextSummary;
  const params = new URLSearchParams();
  params.set("ticketId", ticket.id);
  params.set("rawError", ticket.rawError);
  params.set("description", contextSummary?.operatorNarrative ?? ticket.diagnosis ?? "");
  params.set("pipelineStage", contextSummary?.pipelineStage ?? "intake-stage-unknown");
  params.set(
    "attemptedAction",
    contextSummary?.attemptedAction ?? "processing transfer action with incomplete inference context",
  );
  params.set(
    "lastSuccessfulState",
    contextSummary?.lastSuccessfulState ?? "payload accepted prior to failing step",
  );
  params.set("sourceInstitution", contextSummary?.sourceInstitution ?? "Unknown Institution");
  params.set(
    "overContributionHistory",
    contextSummary?.existingFlags.overContributionHistory ?? "unknown",
  );
  params.set("amlStatus", contextSummary?.existingFlags.amlStatus ?? "unknown");
  params.set("pendingReviews", contextSummary?.existingFlags.pendingReviews.join(",") ?? "");
  params.set("additionalSignals", contextSummary?.additionalSignals.join(",") ?? "");
  params.set("accountType", ticket.accountType);
  params.set("product", ticket.product);
  params.set("severity", ticket.severity);
  return params;
}

async function recoverInterruptedTicket(
  ticket: TicketSnapshot,
  meta?: InferenceMetadata,
): Promise<{ ticket: TicketSnapshot; inferenceMeta?: InferenceMetadata } | null> {
  const params = buildInferenceRecoveryParams(ticket, meta);
  const response = await fetch(`/api/tickets?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as TicketInferenceApiResponse;
  const recovered: TicketSnapshot = {
    ...ticket,
    diagnosis: payload.diagnosis ?? ticket.diagnosis,
    severity: payload.severity ?? ticket.severity,
    accountType: payload.accountType ?? ticket.accountType,
    product: payload.product ?? ticket.product,
    confidenceScore:
      typeof payload.confidenceScore === "number"
        ? payload.confidenceScore
        : ticket.confidenceScore,
    solutionSummary:
      payload.solutionSummary === undefined
        ? ticket.solutionSummary
        : payload.solutionSummary,
    priorResolutionTeam: Array.isArray(payload.priorResolutionTeam)
      ? payload.priorResolutionTeam
      : ticket.priorResolutionTeam,
    draftMessage:
      typeof payload.draftMessage === "string"
        ? payload.draftMessage
        : ticket.draftMessage,
    resolutionSteps: Array.isArray(payload.resolutionSteps)
      ? payload.resolutionSteps
      : ticket.resolutionSteps,
    evidenceNodes: Array.isArray(payload.evidenceNodes)
      ? payload.evidenceNodes
      : ticket.evidenceNodes,
    evidenceEdges: Array.isArray(payload.evidenceEdges)
      ? payload.evidenceEdges
      : ticket.evidenceEdges,
    smes: Array.isArray(payload.smes) ? payload.smes : ticket.smes,
    blueprintGeneratedAt:
      typeof payload.blueprintGeneratedAt === "string"
        ? payload.blueprintGeneratedAt
        : new Date().toISOString(),
    blueprintReady: true,
  };

  return {
    ticket: recovered,
    inferenceMeta: payload.inferenceMeta,
  };
}

export async function fetchEventSnapshot(): Promise<EventSnapshot> {
  const response = await fetch("/api/events", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status}`);
  }

  return (await response.json()) as EventSnapshot;
}

export function subscribeToEventStream(
  onSnapshot: (snapshot: EventSnapshot) => void,
  mode: StreamMode = "polling",
): () => void {
  if (mode !== "polling") {
    // PHASE 2: replace polling with SSE or WebSocket transport.
    throw new Error(`Stream mode not implemented in Phase 1: ${mode}`);
  }

  let active = true;
  const recoveringTicketIds = new Set<string>();
  const recoverRetryAfterMs = new Map<string, number>();
  const persisted = readPersistedSnapshot();
  if (persisted) {
    onSnapshot(persisted);
  }

  const readSnapshot = async () => {
    try {
      const snapshot = await fetchEventSnapshot();
      const merged = mergeWithPersisted(snapshot, readPersistedSnapshot());
      const liveIds = new Set(snapshot.tickets.map((ticket) => ticket.id));
      const now = Date.now();
      const recoverable = merged.tickets.filter((ticket) => {
        if (liveIds.has(ticket.id)) {
          return false;
        }
        if (isTicketReady(ticket, now)) {
          return false;
        }
        const retryAfter = recoverRetryAfterMs.get(ticket.id) ?? 0;
        if (retryAfter > now || recoveringTicketIds.has(ticket.id)) {
          return false;
        }
        return true;
      });

      if (recoverable.length > 0) {
        const recoveredResults = await Promise.all(
          recoverable.map(async (ticket) => {
            const meta = merged.inferenceByTicketId?.[ticket.id];
            recoveringTicketIds.add(ticket.id);
            try {
              const recovered = await recoverInterruptedTicket(ticket, meta);
              if (!recovered) {
                recoverRetryAfterMs.set(ticket.id, Date.now() + 10_000);
              } else {
                recoverRetryAfterMs.delete(ticket.id);
              }
              return recovered ? { id: ticket.id, ...recovered } : null;
            } catch {
              recoverRetryAfterMs.set(ticket.id, Date.now() + 10_000);
              return null;
            } finally {
              recoveringTicketIds.delete(ticket.id);
            }
          }),
        );

        for (const recovered of recoveredResults) {
          if (!recovered) {
            continue;
          }
          merged.tickets = merged.tickets.map((ticket) =>
            ticket.id === recovered.id ? recovered.ticket : ticket,
          );
          if (recovered.inferenceMeta) {
            merged.inferenceByTicketId = {
              ...(merged.inferenceByTicketId ?? {}),
              [recovered.id]: recovered.inferenceMeta,
            };
          }
        }
      }

      writePersistedSnapshot(merged);
      if (active) {
        onSnapshot(merged);
      }
    } catch {
      // Keep silent in UI polling loop for prototype resilience.
    }
  };

  void readSnapshot();
  const interval = window.setInterval(() => {
    void readSnapshot();
  }, 2_000);

  return () => {
    active = false;
    window.clearInterval(interval);
  };
}
