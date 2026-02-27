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

  const readSnapshot = async () => {
    try {
      const snapshot = await fetchEventSnapshot();
      if (active) {
        onSnapshot(snapshot);
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
