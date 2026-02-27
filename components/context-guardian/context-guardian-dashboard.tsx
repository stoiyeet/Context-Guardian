"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";
import ReactFlow, { Background, BackgroundVariant, Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import {
  subscribeToEventStream,
  type EventSnapshot,
  type TicketSnapshot,
} from "@/lib/eventStreamClient";
import type {
  AuditLogEntry,
  EvidenceNode,
  OpsTicket,
  ResolutionStep,
  ResolutionStepStatus,
  Sme,
  TicketStatus,
} from "@/lib/types";

type TicketFromApi = TicketSnapshot;

type TicketUiState = {
  unread: boolean;
  status: TicketStatus;
  steps: ResolutionStep[];
  audit: AuditLogEntry[];
};

const STATUS_FLOW: ResolutionStepStatus[] = ["Pending", "In Progress", "Complete"];

const sourceStyles: Record<EvidenceNode["sourceType"], { border: string; bg: string }> = {
  ticket: { border: "#f0a500", bg: "rgba(240, 165, 0, 0.12)" },
  jira: { border: "#00a4ff", bg: "rgba(0, 164, 255, 0.12)" },
  slack: { border: "#52d273", bg: "rgba(82, 210, 115, 0.12)" },
  confluence: { border: "#f97316", bg: "rgba(249, 115, 22, 0.12)" },
  regulatory: { border: "#ff5b5b", bg: "rgba(255, 91, 91, 0.12)" },
};

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const sec = Math.max(1, Math.floor(ms / 1000));
  if (sec < 60) {
    return `${sec}s ago`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
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

function createAudit(message: string, at?: string): AuditLogEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    message,
    at: at ?? new Date().toISOString(),
  };
}

function initializeUiState(ticket: OpsTicket): TicketUiState {
  return {
    unread: ticket.unread,
    status: ticket.status,
    steps: ticket.resolutionSteps.map((step) => ({ ...step })),
    audit: [
      createAudit(
        `Ticket ingested. Blueprint produced ${formatBlueprintLag(ticket)} after ingestion.`,
        ticket.ingestedAt,
      ),
    ],
  };
}

function jsonSyntaxHighlight(input: string): string {
  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(
      /(\"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\\"])*\")(?=\s*:)/g,
      '<span class="json-key">$1</span>',
    )
    .replace(
      /(:\s*)(\"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\\"])*\")/g,
      '$1<span class="json-string">$2</span>',
    )
    .replace(/\b(true|false|null)\b/g, '<span class="json-bool">$1</span>')
    .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="json-number">$1</span>');
}

function buildDmDraft(ticket: OpsTicket, sme: Sme): string {
  return [
    `Hey ${sme.name.split(" ")[0]} - looking for a quick assist on ${ticket.id}.`,
    `Blueprint diagnosis: ${ticket.diagnosis}`,
    `Raw code: ${ticket.rawError}`,
    `Product: ${ticket.product}`,
    `Fast context: ${ticket.evidenceNodes[1]?.documentRef ?? "Historical references attached"}.`,
    "Can you sanity-check the pathway before we authorize?",
  ].join("\n");
}

function parseStepIndex(stepId: string): number {
  const parts = stepId.split("-");
  const maybeIndex = Number.parseInt(parts[parts.length - 1], 10);
  return Number.isFinite(maybeIndex) ? maybeIndex : 0;
}

export default function ContextGuardianDashboard() {
  const [tickets, setTickets] = useState<TicketFromApi[]>([]);
  const [ticketUi, setTicketUi] = useState<Record<string, TicketUiState>>({});
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [incomingIds, setIncomingIds] = useState<string[]>([]);
  const [selectedGraphNode, setSelectedGraphNode] = useState<EvidenceNode | null>(null);
  const [dmTarget, setDmTarget] = useState<Sme | null>(null);
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null);

  const applySnapshot = useCallback((snapshot: EventSnapshot) => {
    setTickets((previous) => {
      const previousIds = new Set(previous.map((ticket) => ticket.id));
      const newIds = snapshot.tickets
        .map((ticket) => ticket.id)
        .filter((ticketId) => !previousIds.has(ticketId));

      if (newIds.length > 0) {
        setIncomingIds((current) => Array.from(new Set([...current, ...newIds])));
        setTimeout(() => {
          setIncomingIds((current) => current.filter((id) => !newIds.includes(id)));
        }, 1_400);
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

    setSelectedTicketId((current) => {
      if (current) {
        return current;
      }
      return snapshot.tickets[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToEventStream(applySnapshot, "polling");

    const ticker = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      unsubscribe();
      window.clearInterval(ticker);
    };
  }, [applySnapshot]);

  useEffect(() => {
    setSelectedGraphNode(null);
  }, [selectedTicketId]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0] ?? null,
    [tickets, selectedTicketId],
  );

  const selectedUi = selectedTicket ? ticketUi[selectedTicket.id] : undefined;

  const isSelectedReady = Boolean(
    selectedTicket && Date.parse(selectedTicket.blueprintGeneratedAt) <= nowMs,
  );

  const canAuthorize = Boolean(
    selectedUi && selectedUi.steps.length > 0 && selectedUi.steps.every((step) => step.reviewed),
  );

  const flowNodes: Node[] = useMemo(() => {
    if (!selectedTicket) {
      return [];
    }

    return selectedTicket.evidenceNodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: {
        label: `${node.label}\n${node.documentRef}`,
      },
      style: {
        border: `1px solid ${sourceStyles[node.sourceType].border}`,
        background: sourceStyles[node.sourceType].bg,
        color: "#e8eaed",
        fontFamily: "var(--font-data)",
        fontSize: 11,
        borderRadius: 0,
        lineHeight: 1.4,
        whiteSpace: "pre-line",
        padding: "8px 10px",
        width: 220,
      },
    }));
  }, [selectedTicket]);

  const flowEdges: Edge[] = useMemo(() => {
    if (!selectedTicket) {
      return [];
    }

    return selectedTicket.evidenceEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#7a818a",
      },
      style: {
        stroke: "#6c737c",
        strokeWidth: 1.4,
      },
      labelStyle: {
        fill: "#b4bbc3",
        fontFamily: "var(--font-ui)",
        fontSize: 10,
      },
      labelBgPadding: [6, 4],
      labelBgStyle: {
        fill: "#1a1f24",
        stroke: "#353c45",
      },
    }));
  }, [selectedTicket]);

  const onSelectTicket = useCallback((ticketId: string) => {
    setSelectedTicketId(ticketId);
    setTicketUi((previous) => {
      const current = previous[ticketId];
      if (!current) {
        return previous;
      }

      if (!current.unread) {
        return previous;
      }

      return {
        ...previous,
        [ticketId]: {
          ...current,
          unread: false,
          audit: [createAudit("Operator opened blueprint context."), ...current.audit],
        },
      };
    });
  }, []);

  const updateSelectedTicket = useCallback(
    (mutate: (current: TicketUiState) => TicketUiState) => {
      if (!selectedTicket) {
        return;
      }

      setTicketUi((previous) => {
        const current = previous[selectedTicket.id];
        if (!current) {
          return previous;
        }

        return {
          ...previous,
          [selectedTicket.id]: mutate(current),
        };
      });
    },
    [selectedTicket],
  );

  const cycleStepStatus = useCallback(
    (stepId: string) => {
      updateSelectedTicket((current) => {
        const nextSteps = current.steps.map((step) => {
          if (step.id !== stepId) {
            return step;
          }
          const index = STATUS_FLOW.indexOf(step.status);
          const nextStatus = STATUS_FLOW[(index + 1) % STATUS_FLOW.length];
          return {
            ...step,
            status: nextStatus,
          };
        });

        const changedStep = nextSteps.find((step) => step.id === stepId);
        return {
          ...current,
          steps: nextSteps,
          audit: [
            createAudit(
              `Resolution step ${parseStepIndex(stepId)} status set to ${changedStep?.status ?? "Pending"}.`,
            ),
            ...current.audit,
          ],
        };
      });
    },
    [updateSelectedTicket],
  );

  const toggleStepReview = useCallback(
    (stepId: string) => {
      updateSelectedTicket((current) => {
        const nextSteps = current.steps.map((step) =>
          step.id === stepId ? { ...step, reviewed: !step.reviewed } : step,
        );

        const changedStep = nextSteps.find((step) => step.id === stepId);
        return {
          ...current,
          steps: nextSteps,
          audit: [
            createAudit(
              `Resolution step ${parseStepIndex(stepId)} review ${changedStep?.reviewed ? "confirmed" : "removed"}.`,
            ),
            ...current.audit,
          ],
        };
      });
    },
    [updateSelectedTicket],
  );

  const onAuthorize = useCallback(() => {
    updateSelectedTicket((current) => ({
      ...current,
      status: "Authorized",
      audit: [createAudit("Resolution authorized."), ...current.audit],
    }));
  }, [updateSelectedTicket]);

  const onFlagForReview = useCallback(() => {
    updateSelectedTicket((current) => ({
      ...current,
      status: "Flagged for Human Review",
      audit: [createAudit("Ticket flagged for human review."), ...current.audit],
    }));
  }, [updateSelectedTicket]);

  const onCopyPayload = useCallback(async (step: ResolutionStep) => {
    if (!step.payloadJson) {
      return;
    }

    await navigator.clipboard.writeText(step.payloadJson);
    setCopiedStepId(step.id);
    window.setTimeout(() => {
      setCopiedStepId((current) => (current === step.id ? null : current));
    }, 1_500);
  }, []);

  return (
    <main className="context-shell">
      <div className="panel panel-left">
        <div className="panel-header">
          <p className="panel-eyebrow">Live Event Stream</p>
        </div>

        <div className="stream-scroll">
          {tickets.map((ticket) => {
            const ready = Date.parse(ticket.blueprintGeneratedAt) <= nowMs;
            const isSelected = selectedTicket?.id === ticket.id;
            const uiState = ticketUi[ticket.id];

            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => onSelectTicket(ticket.id)}
                className={`event-card ${isSelected ? "event-card-selected" : ""} ${incomingIds.includes(ticket.id) ? "slide-in-top" : ""}`}
              >
                <div className="event-card-top">
                  <span className="event-id">{ticket.id}</span>
                  {uiState?.unread && <span className="unread-dot" aria-hidden />}
                </div>

                <p className="event-raw">{ticket.rawError}</p>

                <div className="event-times">
                  <span>Ingested {formatClock(ticket.ingestedAt)}</span>
                  <span>Blueprint +{formatBlueprintLag(ticket)}</span>
                </div>

                <div className="event-bottom-row">
                  {!ready ? (
                    <span className="processing-badge">
                      <span className="processing-pulse" /> Processing
                    </span>
                  ) : (
                    <span className="ready-badge">Blueprint Ready</span>
                  )}
                  <span className="muted">{relativeTime(ticket.ingestedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel panel-center">
        {!selectedTicket ? (
          <div className="empty-state">No tickets yet.</div>
        ) : (
          <>
            {!isSelectedReady ? (
              <section className="processing-state">
                <p className="panel-eyebrow">Inference Blueprint</p>
                <h2>{selectedTicket.id} is being pre-diagnosed</h2>
                <p>
                  Ingested at {formatClock(selectedTicket.ingestedAt)}. Blueprint expected at{" "}
                  {formatClock(selectedTicket.blueprintGeneratedAt)} ({formatBlueprintLag(selectedTicket)}
                  after ingest).
                </p>
              </section>
            ) : (
              <>
                <section className="diagnosis-header">
                  <p className="panel-eyebrow">Diagnosis Header</p>
                  <h1>{selectedTicket.diagnosis}</h1>
                  <div className="metadata-row">
                    <span
                      className={`meta-badge severity-${selectedTicket.severity.toLowerCase()}`}
                    >
                      {selectedTicket.severity}
                    </span>
                    <span className="meta-badge">{selectedTicket.accountType}</span>
                    <span className="meta-badge">{selectedTicket.product}</span>
                    <span className="meta-badge">
                      Blueprint gap: {formatBlueprintLag(selectedTicket)}
                    </span>
                  </div>
                </section>

                <section className="resolution-section">
                  <div className="section-title-row">
                    <p className="panel-eyebrow">Resolution Pathway</p>
                  </div>

                  <ol className="steps-list">
                    {(selectedUi?.steps ?? []).map((step) => (
                      <li key={step.id} className="step-row">
                        <div className="step-main">
                          <div className="step-title-row">
                            <p className="step-title">{step.title}</p>
                            <button
                              type="button"
                              className="status-toggle"
                              onClick={() => cycleStepStatus(step.id)}
                            >
                              {step.status}
                            </button>
                          </div>
                          <p className="step-details">{step.details}</p>

                          <div className="step-controls">
                            <button
                              type="button"
                              className={`review-toggle ${step.reviewed ? "reviewed" : ""}`}
                              onClick={() => toggleStepReview(step.id)}
                            >
                              {step.reviewed ? "Reviewed" : "Mark Reviewed"}
                            </button>
                          </div>
                        </div>

                        {step.payloadJson && (
                          <div className="payload-block-wrap">
                            <div className="payload-header">
                              <span>Pre-drafted payload</span>
                              <button type="button" onClick={() => onCopyPayload(step)}>
                                {copiedStepId === step.id ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <pre
                              className="payload-block"
                              dangerouslySetInnerHTML={{
                                __html: jsonSyntaxHighlight(step.payloadJson),
                              }}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="evidence-section">
                  <p className="panel-eyebrow">Evidence Graph</p>
                  <div className="graph-panel">
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges}
                      fitView
                      minZoom={0.5}
                      maxZoom={1.6}
                      onNodeClick={(_, node) => {
                        const evidence = selectedTicket.evidenceNodes.find(
                          (candidate) => candidate.id === node.id,
                        );
                        setSelectedGraphNode(evidence ?? null);
                      }}
                      className="evidence-flow"
                    >
                      <Background
                        gap={14}
                        size={1}
                        color="rgba(138, 148, 158, 0.18)"
                        variant={BackgroundVariant.Dots}
                      />
                      <Controls className="flow-controls" showInteractive={false} />
                    </ReactFlow>

                    {selectedGraphNode && (
                      <div className="node-popover">
                        <p className="node-popover-label">
                          {selectedGraphNode.label} | {selectedGraphNode.documentRef}
                        </p>
                        <p>{selectedGraphNode.snippet}</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="sme-section">
                  <p className="panel-eyebrow">Historical SMEs</p>
                  <div className="sme-list">
                    {selectedTicket.smes.map((sme) => (
                      <div key={sme.id} className="sme-row">
                        <div>
                          <p className="sme-name">{sme.name}</p>
                          <p className="sme-meta">
                            {sme.role} | {sme.status}
                          </p>
                        </div>

                        {sme.status === "Active" ? (
                          <button type="button" onClick={() => setDmTarget(sme)} className="dm-button">
                            Draft Context-Loaded DM
                          </button>
                        ) : (
                          <span className="departed-pill">Departed</span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>

      <div className="panel panel-right">
        <section className="actions-section">
          <p className="panel-eyebrow">Audit & Actions</p>

          {selectedTicket && selectedUi && (
            <>
              <p className="status-line">
                Ticket status: <span className="status-pill">{selectedUi.status}</span>
              </p>

              <button
                type="button"
                className="authorize-button"
                disabled={!canAuthorize}
                onClick={onAuthorize}
              >
                Authorize Resolution
              </button>
              {!canAuthorize && (
                <p className="hint-text">All resolution steps must be marked reviewed first.</p>
              )}

              <button type="button" className="flag-button" onClick={onFlagForReview}>
                Flag for Human Review
              </button>

              <div className="confidence-wrap">
                <p className="confidence-label">
                  Confidence: {(selectedTicket.confidenceScore * 100).toFixed(0)}%
                </p>
                <div className="confidence-track">
                  <div
                    className="confidence-value"
                    style={{ width: `${Math.round(selectedTicket.confidenceScore * 100)}%` }}
                  />
                </div>
              </div>

              <div className="audit-log-wrap">
                <p className="audit-title">Audit log</p>
                <div className="audit-items">
                  {selectedUi.audit.map((entry) => (
                    <div key={entry.id} className="audit-item">
                      <span>{formatClock(entry.at)}</span>
                      <p>{entry.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {selectedTicket && dmTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <p>Draft Context-Loaded DM</p>
              <button type="button" onClick={() => setDmTarget(null)}>
                Close
              </button>
            </div>
            <pre className="modal-message">{buildDmDraft(selectedTicket, dmTarget)}</pre>
          </div>
        </div>
      )}
    </main>
  );
}
