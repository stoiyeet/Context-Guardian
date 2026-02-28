"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import EvidenceGraph from "@/components/context-guardian/evidence-graph";
import {
  subscribeToEventStream,
  type EventSnapshot,
  type TicketSnapshot,
} from "@/lib/eventStreamClient";
import type { InferenceMetadata } from "@/lib/inferenceTypes";
import type { MessageRecipient } from "@/lib/messageTypes";
import type { AuditLogEntry, OpsTicket } from "@/lib/types";

type TicketUiState = {
  reviewedStepIds: Record<string, boolean>;
  authorized: boolean;
};

const SOLUTION_CONFIDENCE_THRESHOLD = 0.58;

function confidencePercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function canRenderSolutionSummary(ticket: OpsTicket | null, meta?: InferenceMetadata): boolean {
  if (!ticket || !meta) {
    return false;
  }
  if (meta.unknownPattern) {
    return false;
  }
  if (meta.confidence.overallConfidence < SOLUTION_CONFIDENCE_THRESHOLD) {
    return false;
  }
  return Boolean(ticket.solutionSummary && ticket.priorResolutionTeam.length > 0);
}

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

function composeGreetingFromRecipients(recipients: MessageRecipient[]): string {
  if (recipients.length >= 3) {
    return "Hi team,";
  }
  return `Hi ${recipients.map((recipient) => recipient.name.split(" ")[0]).join(" and ")},`;
}

function withProgrammaticGreeting(
  draft: string,
  recipients: MessageRecipient[],
): string {
  const greeting = composeGreetingFromRecipients(recipients);
  const trimmed = draft.trim();
  const withoutGreeting = trimmed.replace(/^(hi|hello)\s+[^\n,.!]*[,.!]\s*/i, "");
  const body = withoutGreeting || trimmed || "Could you please review the normalization logic and advise.";
  return `${greeting} ${body}`.trim();
}

export default function ContextGuardianDashboard() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketSnapshot[]>([]);
  const [ticketUi, setTicketUi] = useState<Record<string, TicketUiState>>({});
  const [inferenceByTicketId, setInferenceByTicketId] = useState<
    Record<string, InferenceMetadata>
  >({});
  const [auditLogByTicketId, setAuditLogByTicketId] = useState<
    Record<string, AuditLogEntry[]>
  >({});
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [incomingIds, setIncomingIds] = useState<string[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [intakeModalTicketId, setIntakeModalTicketId] = useState<string | null>(null);
  const [modalTicketId, setModalTicketId] = useState<string | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipients, setComposeRecipients] = useState<MessageRecipient[]>([]);
  const [composeBody, setComposeBody] = useState("");
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

    if (snapshot.inferenceByTicketId) {
      setInferenceByTicketId(snapshot.inferenceByTicketId);
    }
    if (snapshot.auditLogByTicketId) {
      setAuditLogByTicketId(snapshot.auditLogByTicketId);
    }

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
  const intakeTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === intakeModalTicketId) ?? null,
    [tickets, intakeModalTicketId],
  );

  const selectedTicketUi = selectedTicket ? ticketUi[selectedTicket.id] : undefined;
  const modalTicketUi = modalTicket ? ticketUi[modalTicket.id] : undefined;
  const selectedInference = selectedTicket ? inferenceByTicketId[selectedTicket.id] : undefined;
  const modalInference = modalTicket ? inferenceByTicketId[modalTicket.id] : undefined;
  const intakeInference = intakeTicket ? inferenceByTicketId[intakeTicket.id] : undefined;
  const selectedAuditLog = selectedTicket ? auditLogByTicketId[selectedTicket.id] ?? [] : [];

  const isReady = useCallback(
    (ticket: TicketSnapshot) => Date.parse(ticket.blueprintGeneratedAt) <= nowMs,
    [nowMs],
  );

  const selectedReady = Boolean(selectedTicket && isReady(selectedTicket));
  const selectedPayload = selectedTicket ? getPayload(selectedTicket) : null;
  const modalPayload = modalTicket ? getPayload(modalTicket) : null;
  const selectedContributors = selectedTicket ? activeContributors(selectedTicket) : [];
  const modalContributors = modalTicket ? activeContributors(modalTicket) : [];
  const modalCanRenderSolution = canRenderSolutionSummary(modalTicket, modalInference);
  const modalPriorTeam = modalTicket?.priorResolutionTeam ?? [];
  const intakeReady = intakeTicket ? isReady(intakeTicket) : false;

  useEffect(() => {
    setSelectedTeamIds([]);
    setComposeOpen(false);
  }, [modalTicketId]);

  useEffect(() => {
    if (modalTicketId) {
      setIntakeModalTicketId(null);
    }
  }, [modalTicketId]);

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

  const authorize = useCallback(async (ticketId: string) => {
    const snapshot = tickets.find((ticket) => ticket.id === ticketId) ?? null;
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
    setTickets((previous) =>
      previous.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: "Authorized" as const } : ticket,
      ),
    );

    try {
      await fetch(`/api/tickets/${ticketId}/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operatorNotes: "Authorized from dashboard.",
          ticketSnapshot: snapshot,
        }),
      });
    } catch {
      // Keep optimistic UI state if authorization endpoint fails.
    }
  }, [tickets]);

  const copyPayload = useCallback(async (payload: string) => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1_100);
  }, []);

  const toggleTeamSelection = useCallback((personId: string, checked: boolean) => {
    setSelectedTeamIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, personId]));
      }
      return current.filter((id) => id !== personId);
    });
  }, []);

  const openComposeForRecipients = useCallback(
    (recipients: MessageRecipient[], draft: string) => {
      setComposeRecipients(recipients);
      setComposeBody(withProgrammaticGreeting(draft, recipients));
      setComposeOpen(true);
    },
    [],
  );

  const sendComposeMessage = useCallback(async () => {
    if (composeRecipients.length === 0 || !composeBody.trim()) {
      return;
    }
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: composeRecipients,
          body: composeBody.trim(),
          senderName: "You",
        }),
      });
      setComposeOpen(false);
      setSelectedTeamIds([]);
      setModalTicketId(null);
      router.push("/messages");
    } catch {
      // Keep compose modal open on send failure.
    }
  }, [composeRecipients, composeBody, router]);

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

  const selectedTeamRecipients: MessageRecipient[] = modalPriorTeam
    .filter((person) => selectedTeamIds.includes(person.id))
    .map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      status: person.status,
    }));

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
                onClick={() => {
                  setSelectedTicketId(ticket.id);
                  setIntakeModalTicketId(ticket.id);
                }}
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
            <p className="waiting-subtle">{selectedTicket.id} blueprint inference is still running.</p>
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
              {selectedInference?.unknownPattern && (
                <p className="waiting-subtle">
                  This resolution will be added to organizational memory once completed.
                </p>
              )}
            </section>

            {selectedInference?.contextSummary && (
              <section className="summary-block">
                <p className="section-tag">Operational Context</p>
                <div className="summary-time-grid">
                  <p>
                    <span>Pipeline Stage</span>
                    <strong>{selectedInference.contextSummary.pipelineStage}</strong>
                  </p>
                  <p>
                    <span>Attempted Action</span>
                    <strong>{selectedInference.contextSummary.attemptedAction}</strong>
                  </p>
                  <p>
                    <span>Last Successful State</span>
                    <strong>{selectedInference.contextSummary.lastSuccessfulState}</strong>
                  </p>
                  <p>
                    <span>Source Institution</span>
                    <strong>{selectedInference.contextSummary.sourceInstitution}</strong>
                  </p>
                </div>
                <p className="waiting-subtle">
                  Flags: over-contribution={selectedInference.contextSummary.existingFlags.overContributionHistory}; aml={selectedInference.contextSummary.existingFlags.amlStatus}; pending reviews=
                  {selectedInference.contextSummary.existingFlags.pendingReviews.join(", ") || "none"}.
                </p>
                {selectedInference.contextSummary.additionalSignals.length > 0 && (
                  <p className="waiting-subtle">
                    Additional signals: {selectedInference.contextSummary.additionalSignals.join(", ")}.
                  </p>
                )}
              </section>
            )}

            <section className="summary-block">
              <p className="section-tag">Evidence Graph</p>
              <p className="evidence-graph-hint">
                Click a node to open the linked Slack thread, infra ticket, or post-mortem.
              </p>
              <EvidenceGraph ticket={selectedTicket} height={250} />
              {selectedInference?.similarityRationale.length ? (
                <ol className="resolution-steps">
                  {selectedInference.similarityRationale.map((reason, index) => (
                    <li key={`${selectedTicket.id}-reason-${index + 1}`}>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ol>
              ) : null}

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
              <p className="section-tag">
                {selectedInference?.unknownPattern
                  ? "Intelligent Routing Pathway"
                  : "Resolution Pathway"}
              </p>
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
              {selectedInference?.unknownPattern && (
                <p className="active-contributors">
                  No organizational precedent was found. This resolution will be added to memory when completed.
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
                {confidencePercent(selectedInference?.confidence.overallConfidence ?? selectedTicket.confidenceScore)}{" "}
                inference confidence
              </p>
              <div className="confidence-track">
                <div
                  className="confidence-value"
                  style={{
                    width: confidencePercent(
                      selectedInference?.confidence.overallConfidence ??
                        selectedTicket.confidenceScore,
                    ),
                  }}
                />
              </div>
              {selectedInference && (
                <>
                  <p className="waiting-subtle">
                    Pattern match: {confidencePercent(selectedInference.confidence.patternMatchConfidence)}
                  </p>
                  <p className="waiting-subtle">
                    SME routing: {confidencePercent(selectedInference.confidence.smeRoutingConfidence)}
                  </p>
                  <p className="waiting-subtle">
                    Resolution path: {confidencePercent(selectedInference.confidence.resolutionPathConfidence)}
                  </p>
                  <p className="waiting-subtle">{selectedInference.confidence.humanReadableCaveat}</p>
                </>
              )}
            </section>

            {selectedAuditLog.length > 0 && (
              <section className="summary-block">
                <p className="section-tag">Audit Log</p>
                <ol className="resolution-steps">
                  {selectedAuditLog.slice(0, 6).map((entry) => (
                    <li key={entry.id}>
                      <span>
                        {formatTimestamp(entry.at)} — {entry.message}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {selectedInference?.degradedReason && (
              <section className="summary-block">
                <p className="section-tag">Inference Status</p>
                <p className="waiting-subtle">{selectedInference.degradedReason}</p>
              </section>
            )}
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
              {modalInference?.contextSummary && (
                <div className="summary-time-grid">
                  <p>
                    <span>Pipeline Stage</span>
                    <strong>{modalInference.contextSummary.pipelineStage}</strong>
                  </p>
                  <p>
                    <span>Attempted Action</span>
                    <strong>{modalInference.contextSummary.attemptedAction}</strong>
                  </p>
                  <p>
                    <span>Last Successful State</span>
                    <strong>{modalInference.contextSummary.lastSuccessfulState}</strong>
                  </p>
                  <p>
                    <span>Source Institution</span>
                    <strong>{modalInference.contextSummary.sourceInstitution}</strong>
                  </p>
                </div>
              )}
            </section>

            <section className="blueprint-section">
              <p className="section-tag">3. Evidence Graph</p>
              <p className="evidence-graph-hint">
                Click a node to open the linked evidence instance.
              </p>
              <EvidenceGraph ticket={modalTicket} height={300} />
              {modalInference?.similarityRationale.length ? (
                <ol className="resolution-steps">
                  {modalInference.similarityRationale.map((reason, index) => (
                    <li key={`${modalTicket.id}-reason-${index + 1}`}>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>

            {modalCanRenderSolution && modalTicket && (
              <section className="blueprint-section">
                <p className="section-tag">4. Solution Summary</p>
                <p className="diagnosis-text">{modalTicket.solutionSummary}</p>

                <div className="summary-block">
                  <p className="section-tag">Prior Resolution Team</p>
                  <div className="prior-team-list">
                    {modalPriorTeam.map((person) => (
                      <article key={person.id} className="prior-team-row">
                        <div>
                          <p>
                            <span
                              className={`status-dot ${
                                person.status === "Active" ? "active" : "departed"
                              }`}
                              aria-hidden
                            />
                            {person.name}
                          </p>
                          <span>
                            {person.role} • {person.status}
                          </span>
                        </div>
                        <div className="prior-team-actions">
                          <button
                            type="button"
                            onClick={() =>
                              openComposeForRecipients(
                                [
                                  {
                                    id: person.id,
                                    name: person.name,
                                    role: person.role,
                                    status: person.status,
                                  },
                                ],
                                modalTicket.draftMessage,
                              )
                            }
                          >
                            Contact
                          </button>
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedTeamIds.includes(person.id)}
                              onChange={(event) =>
                                toggleTeamSelection(person.id, event.currentTarget.checked)
                              }
                            />
                            <span>Select</span>
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                  {selectedTeamRecipients.length > 0 && (
                    <button
                      type="button"
                      className="open-modal-button"
                      onClick={() =>
                        openComposeForRecipients(selectedTeamRecipients, modalTicket.draftMessage)
                      }
                    >
                      Create Group Message
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="blueprint-section">
              <p className="section-tag">
                {modalCanRenderSolution ? "5. Resolution Pathway" : "4. Resolution Pathway"}
              </p>
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
              {modalInference?.unknownPattern && (
                <p className="active-contributors">
                  No organizational precedent was found for this error pattern.
                </p>
              )}
              {modalInference && (
                <p className="waiting-subtle">{modalInference.confidence.humanReadableCaveat}</p>
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

          {composeOpen && (
            <div className="compose-overlay" role="dialog" aria-modal="true">
              <div className="compose-modal">
                <header className="blueprint-header">
                  <p className="blueprint-title">Compose Message</p>
                  <button type="button" className="close-button" onClick={() => setComposeOpen(false)}>
                    Close
                  </button>
                </header>

                <section className="blueprint-section">
                  <p className="section-tag">To</p>
                  <div className="recipient-chip-wrap">
                    {composeRecipients.map((recipient) => (
                      <button
                        type="button"
                        key={recipient.id}
                        className="recipient-chip"
                        onClick={() =>
                          setComposeRecipients((current) =>
                            current.filter((entry) => entry.id !== recipient.id),
                          )
                        }
                      >
                        {recipient.name}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="blueprint-section">
                  <p className="section-tag">Message</p>
                  <textarea
                    className="compose-textarea"
                    value={composeBody}
                    onChange={(event) => setComposeBody(event.currentTarget.value)}
                  />
                </section>

                <section className="blueprint-section">
                  <button
                    type="button"
                    className="authorize-button"
                    disabled={composeRecipients.length === 0 || !composeBody.trim()}
                    onClick={() => void sendComposeMessage()}
                  >
                    Send Message
                  </button>
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      {intakeTicket && (
        <div className="intake-overlay" role="dialog" aria-modal="true">
          <div className="intake-modal">
            <header className="blueprint-header">
              <p className="blueprint-title">Event Intake Snapshot | {intakeTicket.id}</p>
              <button
                type="button"
                className="close-button"
                onClick={() => setIntakeModalTicketId(null)}
              >
                Close
              </button>
            </header>

            <section className="blueprint-section">
              <p className="section-tag">Input Summary</p>
              <div className="summary-time-grid">
                <p>
                  <span>Raw Error</span>
                  <strong>{intakeTicket.rawError}</strong>
                </p>
                <p>
                  <span>Severity</span>
                  <strong>{intakeTicket.severity}</strong>
                </p>
                <p>
                  <span>Account Type</span>
                  <strong>{intakeTicket.accountType}</strong>
                </p>
                <p>
                  <span>Product</span>
                  <strong>{intakeTicket.product}</strong>
                </p>
                <p>
                  <span>Ingested At</span>
                  <strong>{formatTimestamp(intakeTicket.ingestedAt)}</strong>
                </p>
                <p>
                  <span>Status</span>
                  <strong>{intakeReady ? "Blueprint Ready" : "Inference Processing"}</strong>
                </p>
              </div>
            </section>

            {intakeInference?.contextSummary && (
              <section className="blueprint-section">
                <p className="section-tag">Process Context (Pre-LLM)</p>
                <div className="summary-time-grid">
                  <p>
                    <span>Pipeline Stage</span>
                    <strong>{intakeInference.contextSummary.pipelineStage}</strong>
                  </p>
                  <p>
                    <span>Attempted Action</span>
                    <strong>{intakeInference.contextSummary.attemptedAction}</strong>
                  </p>
                  <p>
                    <span>Last Successful State</span>
                    <strong>{intakeInference.contextSummary.lastSuccessfulState}</strong>
                  </p>
                  <p>
                    <span>Source Institution</span>
                    <strong>{intakeInference.contextSummary.sourceInstitution}</strong>
                  </p>
                </div>
                <p className="waiting-subtle">
                  Flags: over-contribution=
                  {intakeInference.contextSummary.existingFlags.overContributionHistory}; aml=
                  {intakeInference.contextSummary.existingFlags.amlStatus}; pending reviews=
                  {intakeInference.contextSummary.existingFlags.pendingReviews.join(", ") || "none"}.
                </p>
                {intakeInference.contextSummary.additionalSignals.length > 0 && (
                  <p className="waiting-subtle">
                    Additional signals: {intakeInference.contextSummary.additionalSignals.join(", ")}.
                  </p>
                )}
                {intakeInference.contextSummary.operatorNarrative && (
                  <p className="waiting-subtle">
                    Operator narrative: {intakeInference.contextSummary.operatorNarrative}
                  </p>
                )}
              </section>
            )}

            <section className="blueprint-section">
              <div className="intake-actions">
                {intakeReady && (
                  <button
                    type="button"
                    className="open-modal-button"
                    onClick={() => {
                      setIntakeModalTicketId(null);
                      setModalTicketId(intakeTicket.id);
                    }}
                  >
                    Open Inference Blueprint
                  </button>
                )}
                {!intakeReady && (
                  <p className="waiting-subtle">
                    Context has been captured. Blueprint will open once synthesis completes.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
