"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subscribeToEventStream,
  type EventSnapshot,
  type TicketSnapshot,
} from "@/lib/eventStreamClient";
import type { OpsTicket } from "@/lib/types";

type TicketUiState = {
  reviewedStepIds: Record<string, boolean>;
  authorized: boolean;
};

type EvidenceLink = {
  id: string;
  label: string;
};

const EVIDENCE_LINKS: EvidenceLink[] = [
  {
    id: "slack-nov-2024",
    label: "Slack thread Nov 2024",
  },
  {
    id: "jira-ops-8492",
    label: "OPS-8492",
  },
  {
    id: "postmortem-cusip-2024-11",
    label: "post-mortem",
  },
];

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatBlueprintLag(ticket: OpsTicket): string {
  const lagMs = Math.max(0, Date.parse(ticket.blueprintGeneratedAt) - Date.parse(ticket.ingestedAt));
  return `${(lagMs / 1000).toFixed(1)}s`;
}

function initializeUiState(ticket: OpsTicket): TicketUiState {
  return {
    reviewedStepIds: ticket.resolutionSteps.reduce<Record<string, boolean>>((acc, step) => {
      acc[step.id] = step.reviewed;
      return acc;
    }, {}),
    authorized: ticket.status === "Authorized",
  };
}

function firstPayload(ticket: OpsTicket): string | null {
  return ticket.resolutionSteps.find((step) => step.payloadJson)?.payloadJson ?? null;
}

export default function ContextGuardianDashboard() {
  const [tickets, setTickets] = useState<TicketSnapshot[]>([]);
  const [ticketUi, setTicketUi] = useState<Record<string, TicketUiState>>({});
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [incomingIds, setIncomingIds] = useState<string[]>([]);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const applySnapshot = useCallback((snapshot: EventSnapshot) => {
    setTickets((previous) => {
      const previousIds = new Set(previous.map((ticket) => ticket.id));
      const nextNewIds = snapshot.tickets
        .map((ticket) => ticket.id)
        .filter((ticketId) => !previousIds.has(ticketId));

      if (nextNewIds.length > 0) {
        setIncomingIds((current) => Array.from(new Set([...current, ...nextNewIds])));
        window.setTimeout(() => {
          setIncomingIds((current) => current.filter((id) => !nextNewIds.includes(id)));
        }, 1_100);
      }

      return snapshot.tickets;
    });

    setTicketUi((previous) => {
      const nextState = { ...previous };
      for (const ticket of snapshot.tickets) {
        if (!nextState[ticket.id]) {
          nextState[ticket.id] = initializeUiState(ticket);
        }
      }
      return nextState;
    });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToEventStream(applySnapshot, "polling");
    const clockTick = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      unsubscribe();
      window.clearInterval(clockTick);
    };
  }, [applySnapshot]);

  const openTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === openTicketId) ?? null,
    [tickets, openTicketId],
  );

  const openTicketUi = openTicket ? ticketUi[openTicket.id] : undefined;

  const readyToOpen = useCallback(
    (ticket: TicketSnapshot) => Date.parse(ticket.blueprintGeneratedAt) <= nowMs,
    [nowMs],
  );

  const markReviewed = useCallback((ticketId: string, stepId: string, value: boolean) => {
    setTicketUi((previous) => {
      const current = previous[ticketId];
      if (!current) {
        return previous;
      }

      return {
        ...previous,
        [ticketId]: {
          ...current,
          reviewedStepIds: {
            ...current.reviewedStepIds,
            [stepId]: value,
          },
        },
      };
    });
  }, []);

  const authorize = useCallback((ticketId: string) => {
    setTicketUi((previous) => {
      const current = previous[ticketId];
      if (!current) {
        return previous;
      }

      return {
        ...previous,
        [ticketId]: {
          ...current,
          authorized: true,
        },
      };
    });
  }, []);

  const copyPayload = useCallback(async (payload: string) => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1_100);
  }, []);

  return (
    <main className="context-shell">
      <section className="panel panel-left">
        <div className="panel-header">
          <p className="panel-eyebrow">Live Event Stream</p>
        </div>

        <div className="stream-scroll">
          {tickets.length === 0 && (
            <div className="stream-empty">Awaiting HTTP ingest events.</div>
          )}

          {tickets.map((ticket) => {
            const isReady = readyToOpen(ticket);

            return (
              <button
                key={ticket.id}
                type="button"
                className={`event-card ${incomingIds.includes(ticket.id) ? "slide-in-top" : ""} ${
                  isReady ? "event-card-ready" : ""
                }`}
                onClick={() => {
                  if (isReady) {
                    setOpenTicketId(ticket.id);
                  }
                }}
              >
                <p className="event-id">{ticket.id}</p>
                <p className="event-raw">{ticket.rawError}</p>
                <p className="event-ingested">{formatTimestamp(ticket.ingestedAt)}</p>

                <div className="event-status-row">
                  {!isReady ? (
                    <span className="processing-badge">
                      <span className="processing-pulse" aria-hidden />
                      Processing
                    </span>
                  ) : (
                    <span className="ready-badge">Blueprint Ready</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel panel-center">
        <div className="waiting-state">
          <p>Monitoring operational stream</p>
          <span className="heartbeat" aria-hidden />
        </div>
      </section>

      <section className="panel panel-right">
        <div className="waiting-state">
          <p>Monitoring operational stream</p>
          <span className="heartbeat" aria-hidden />
        </div>
      </section>

      {openTicket && openTicketUi && (
        <div className="blueprint-overlay" role="dialog" aria-modal="true">
          <div className="blueprint-modal">
            <header className="blueprint-header">
              <p className="blueprint-title">Inference Blueprint | {openTicket.id}</p>
              <button type="button" className="close-button" onClick={() => setOpenTicketId(null)}>
                Close
              </button>
            </header>

            <section className="blueprint-section timestamp-focus">
              <p className="section-tag">1. Timestamp Differential</p>
              <p className="lag-value">{formatBlueprintLag(openTicket)}</p>
              <div className="timestamp-grid">
                <p>
                  <span>Ingested</span>
                  <strong>{formatTimestamp(openTicket.ingestedAt)}</strong>
                </p>
                <p>
                  <span>Blueprint Ready</span>
                  <strong>{formatTimestamp(openTicket.blueprintGeneratedAt)}</strong>
                </p>
              </div>
              <p className="timestamp-claim">Generated before first human view.</p>
            </section>

            <section className="blueprint-section">
              <p className="section-tag">2. Diagnosis</p>
              <p className="raw-code">{openTicket.rawError}</p>
              <p className="diagnosis-text">{openTicket.diagnosis}</p>
            </section>

            <section className="blueprint-section">
              <p className="section-tag">3. Evidence Summary</p>
              <p className="evidence-sentence">
                This diagnosis draws from 3 sources:{" "}
                {EVIDENCE_LINKS.map((link, index) => (
                  <span key={link.id}>
                    <Link href={`/knowledge-base?artifact=${link.id}#${link.id}`} className="evidence-link">
                      [{link.label}]
                    </Link>
                    {index < EVIDENCE_LINKS.length - 1 ? ", " : "."}
                  </span>
                ))}
              </p>

              <div className="node-chain" aria-hidden>
                <span>Ticket</span>
                <i />
                <span>Slack</span>
                <i />
                <span>OPS-8492</span>
                <i />
                <span>Post-Mortem</span>
              </div>
            </section>

            <section className="blueprint-section">
              <p className="section-tag">4. Resolution Pathway</p>
              <ol className="resolution-steps">
                {openTicket.resolutionSteps.map((step) => {
                  const checked = openTicketUi.reviewedStepIds[step.id] ?? false;
                  return (
                    <li key={step.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            markReviewed(openTicket.id, step.id, event.currentTarget.checked)
                          }
                        />
                        <span>{step.details}</span>
                      </label>
                    </li>
                  );
                })}
              </ol>

              {firstPayload(openTicket) && (
                <div className="payload-wrap">
                  <div className="payload-header">
                    <span>JSON payload</span>
                    <button
                      type="button"
                      onClick={() => {
                        const payload = firstPayload(openTicket);
                        if (payload) {
                          void copyPayload(payload);
                        }
                      }}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre>{firstPayload(openTicket)}</pre>
                </div>
              )}

              <button
                type="button"
                className="authorize-button"
                disabled={
                  openTicketUi.authorized ||
                  !openTicket.resolutionSteps.every((step) => openTicketUi.reviewedStepIds[step.id])
                }
                onClick={() => authorize(openTicket.id)}
              >
                {openTicketUi.authorized ? "Resolution Authorized" : "Authorize Resolution"}
              </button>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
