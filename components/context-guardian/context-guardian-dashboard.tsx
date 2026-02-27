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
  href: string;
  label: string;
};

const EVIDENCE_LINKS: EvidenceLink[] = [
  {
    href: "/knowledge-base?artifact=slack-nov-2024&message=m5#m5",
    label: "Slack thread Nov 2024",
  },
  {
    href: "/knowledge-base?artifact=jira-ops-8492#jira-ops-8492",
    label: "OPS-8492",
  },
  {
    href: "/knowledge-base?artifact=postmortem-cusip-2024-11#postmortem-cusip-2024-11",
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

function getPayload(ticket: OpsTicket): string | null {
  return ticket.resolutionSteps.find((step) => step.payloadJson)?.payloadJson ?? null;
}

function activeContributors(ticket: OpsTicket): string[] {
  return ticket.smes
    .filter((sme) => sme.status === "Active")
    .map((sme) => `${sme.name} (${sme.role})`);
}

export default function ContextGuardianDashboard() {
  const [tickets, setTickets] = useState<TicketSnapshot[]>([]);
  const [ticketUi, setTicketUi] = useState<Record<string, TicketUiState>>({});
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [incomingIds, setIncomingIds] = useState<string[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [modalTicketId, setModalTicketId] = useState<string | null>(null);
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

    setSelectedTicketId((current) => current ?? snapshot.tickets[0]?.id ?? null);
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

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const modalTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === modalTicketId) ?? null,
    [tickets, modalTicketId],
  );

  const selectedTicketUi = selectedTicket ? ticketUi[selectedTicket.id] : undefined;
  const modalTicketUi = modalTicket ? ticketUi[modalTicket.id] : undefined;

  const isReady = useCallback(
    (ticket: TicketSnapshot) => Date.parse(ticket.blueprintGeneratedAt) <= nowMs,
    [nowMs],
  );

  const selectedReady = Boolean(selectedTicket && isReady(selectedTicket));
  const selectedPayload = selectedTicket ? getPayload(selectedTicket) : null;
  const modalPayload = modalTicket ? getPayload(modalTicket) : null;
  const selectedContributors = selectedTicket ? activeContributors(selectedTicket) : [];
  const modalContributors = modalTicket ? activeContributors(modalTicket) : [];

  const setStepReviewed = useCallback((ticketId: string, stepId: string, value: boolean) => {
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

  const canAuthorizeSelected = Boolean(
    selectedTicket &&
      selectedTicketUi &&
      !selectedTicketUi.authorized &&
      selectedTicket.resolutionSteps.every((step) => selectedTicketUi.reviewedStepIds[step.id]),
  );

  const canAuthorizeModal = Boolean(
    modalTicket &&
      modalTicketUi &&
      !modalTicketUi.authorized &&
      modalTicket.resolutionSteps.every((step) => modalTicketUi.reviewedStepIds[step.id]),
  );

  return (
    <main className="context-shell">
      <section className="panel panel-left">
        <div className="panel-header">
          <p className="panel-eyebrow">Live Event Stream</p>
        </div>

        <div className="stream-scroll">
          {tickets.length === 0 && <div className="stream-empty">Awaiting HTTP ingest events.</div>}

          {tickets.map((ticket) => {
            const ready = isReady(ticket);

            return (
              <button
                key={ticket.id}
                type="button"
                className={`event-card ${incomingIds.includes(ticket.id) ? "slide-in-top" : ""} ${
                  ready ? "event-card-ready" : ""
                } ${selectedTicket?.id === ticket.id ? "event-card-selected" : ""}`}
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <p className="event-id">{ticket.id}</p>
                <p className="event-raw">{ticket.rawError}</p>
                <p className="event-ingested">{formatTimestamp(ticket.ingestedAt)}</p>

                <div className="event-status-row">
                  {!ready ? (
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
        {!selectedTicket ? (
          <div className="waiting-state">
            <p>Monitoring operational stream</p>
            <span className="heartbeat" aria-hidden />
          </div>
        ) : !selectedReady ? (
          <div className="waiting-state">
            <p>Monitoring operational stream</p>
            <p className="waiting-subtle">
              {selectedTicket.id} blueprint is still processing ({formatBlueprintLag(selectedTicket)} target).
            </p>
            <span className="heartbeat" aria-hidden />
          </div>
        ) : (
          <div className="panel-content">
            <section className="summary-block">
              <p className="section-tag">Blueprint Summary</p>
              <p className="summary-metric">{formatBlueprintLag(selectedTicket)}</p>
              <p className="summary-claim">Generated before first human view.</p>
              <div className="summary-time-grid">
                <p>
                  <span>Ingested</span>
                  <strong>{formatTimestamp(selectedTicket.ingestedAt)}</strong>
                </p>
                <p>
                  <span>Blueprint Ready</span>
                  <strong>{formatTimestamp(selectedTicket.blueprintGeneratedAt)}</strong>
                </p>
              </div>
            </section>

            <section className="summary-block">
              <p className="section-tag">Diagnosis</p>
              <p className="raw-code">{selectedTicket.rawError}</p>
              <p className="diagnosis-text-inline">{selectedTicket.diagnosis}</p>
            </section>

            <section className="summary-block">
              <p className="section-tag">Evidence Summary</p>
              <p className="evidence-sentence">
                This diagnosis draws from 3 sources:{" "}
                {EVIDENCE_LINKS.map((link, index) => (
                  <span key={link.href}>
                    <Link href={link.href} className="evidence-link">
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

              <button
                type="button"
                className="open-modal-button"
                onClick={() => setModalTicketId(selectedTicket.id)}
              >
                Open Full Blueprint View
              </button>
            </section>
          </div>
        )}
      </section>

      <section className="panel panel-right">
        {!selectedTicket ? (
          <div className="waiting-state">
            <p>Monitoring operational stream</p>
            <span className="heartbeat" aria-hidden />
          </div>
        ) : !selectedReady || !selectedTicketUi ? (
          <div className="waiting-state">
            <p>Resolution pathway will appear when blueprint is ready.</p>
            <span className="heartbeat" aria-hidden />
          </div>
        ) : (
          <div className="panel-content">
            <section className="summary-block">
              <p className="section-tag">Resolution Pathway</p>
              <ol className="resolution-steps">
                {selectedTicket.resolutionSteps.map((step) => {
                  const checked = selectedTicketUi.reviewedStepIds[step.id] ?? false;
                  return (
                    <li key={step.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setStepReviewed(
                              selectedTicket.id,
                              step.id,
                              event.currentTarget.checked,
                            )
                          }
                        />
                        <span>{step.details}</span>
                      </label>
                    </li>
                  );
                })}
              </ol>

              {selectedPayload && (
                <div className="payload-wrap">
                  <div className="payload-header">
                    <span>JSON payload</span>
                    <button type="button" onClick={() => void copyPayload(selectedPayload)}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre>{selectedPayload}</pre>
                </div>
              )}

              {selectedContributors.length > 0 && (
                <p className="active-contributors">
                  Prior active contributors: {selectedContributors.join(", ")}.
                </p>
              )}

              <button
                type="button"
                className="authorize-button"
                disabled={!canAuthorizeSelected}
                onClick={() => authorize(selectedTicket.id)}
              >
                {selectedTicketUi.authorized ? "Resolution Authorized" : "Authorize Resolution"}
              </button>
            </section>

            <section className="summary-block confidence-block">
              <p className="section-tag">Confidence Summary</p>
              <p className="confidence-label">
                {(selectedTicket.confidenceScore * 100).toFixed(0)}% inference confidence
              </p>
              <div className="confidence-track">
                <div
                  className="confidence-value"
                  style={{ width: `${Math.round(selectedTicket.confidenceScore * 100)}%` }}
                />
              </div>
            </section>
          </div>
        )}
      </section>

      {modalTicket && modalTicketUi && isReady(modalTicket) && (
        <div className="blueprint-overlay" role="dialog" aria-modal="true">
          <div className="blueprint-modal">
            <header className="blueprint-header">
              <p className="blueprint-title">Inference Blueprint | {modalTicket.id}</p>
              <button type="button" className="close-button" onClick={() => setModalTicketId(null)}>
                Close
              </button>
            </header>

            <section className="blueprint-section timestamp-focus">
              <p className="section-tag">1. Timestamp Differential</p>
              <p className="lag-value">{formatBlueprintLag(modalTicket)}</p>
              <div className="timestamp-grid">
                <p>
                  <span>Ingested</span>
                  <strong>{formatTimestamp(modalTicket.ingestedAt)}</strong>
                </p>
                <p>
                  <span>Blueprint Ready</span>
                  <strong>{formatTimestamp(modalTicket.blueprintGeneratedAt)}</strong>
                </p>
              </div>
              <p className="timestamp-claim">Generated before first human view.</p>
            </section>

            <section className="blueprint-section">
              <p className="section-tag">2. Diagnosis</p>
              <p className="raw-code">{modalTicket.rawError}</p>
              <p className="diagnosis-text">{modalTicket.diagnosis}</p>
            </section>

            <section className="blueprint-section">
              <p className="section-tag">3. Evidence Summary</p>
              <p className="evidence-sentence">
                This diagnosis draws from 3 sources:{" "}
                {EVIDENCE_LINKS.map((link, index) => (
                  <span key={link.href}>
                    <Link href={link.href} className="evidence-link">
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
                {modalTicket.resolutionSteps.map((step) => {
                  const checked = modalTicketUi.reviewedStepIds[step.id] ?? false;
                  return (
                    <li key={step.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setStepReviewed(modalTicket.id, step.id, event.currentTarget.checked)
                          }
                        />
                        <span>{step.details}</span>
                      </label>
                    </li>
                  );
                })}
              </ol>

              {modalPayload && (
                <div className="payload-wrap">
                  <div className="payload-header">
                    <span>JSON payload</span>
                    <button type="button" onClick={() => void copyPayload(modalPayload)}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre>{modalPayload}</pre>
                </div>
              )}

              {modalContributors.length > 0 && (
                <p className="active-contributors">
                  Prior active contributors: {modalContributors.join(", ")}.
                </p>
              )}

              <button
                type="button"
                className="authorize-button"
                disabled={!canAuthorizeModal}
                onClick={() => authorize(modalTicket.id)}
              >
                {modalTicketUi.authorized ? "Resolution Authorized" : "Authorize Resolution"}
              </button>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
