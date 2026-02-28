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
  const persisted = readPersistedSnapshot();
  if (persisted) {
    onSnapshot(persisted);
  }

  const readSnapshot = async () => {
    try {
      const snapshot = await fetchEventSnapshot();
      const merged = mergeWithPersisted(snapshot, readPersistedSnapshot());
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
