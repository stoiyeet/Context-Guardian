"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Pattern = {
  patternId: string;
  name: string;
  description: string;
  occurrenceCount: number;
  lastSeen: string;
  confidenceScore: number;
  involvedSystems: string[];
};

type Sme = {
  personId: string;
  name: string;
  role: string;
  status: "Active" | "Departed";
  expertiseDomains: string[];
  recentInvolvements: string[];
  confidenceByDomain: Record<string, number>;
  replacedBy?: string;
  lastActiveDate: string;
};

type Correlation = {
  correlationId: string;
  systemA: string;
  systemB: string;
  observedCount: number;
  description: string;
  confidenceScore: number;
  supportingTicketIds: string[];
};

type Recency = {
  entryId: string;
  entryType: "pattern" | "sme";
  relevanceScore: number;
  lastSeen: string;
};

type SynthState = {
  builtAt: string;
  lastUpdatedAt: string;
  sourceArtifactCount: number;
  learnedTicketIds?: string[];
  patterns: Pattern[];
  smeRoutingTable: Sme[];
  correlationMap: Correlation[];
  recencyIndex: Recency[];
};

type SynthHighlightState = {
  active: boolean;
  changedMetrics: {
    artifacts: boolean;
    learned: boolean;
    patterns: boolean;
    correlations: boolean;
    smes: boolean;
  };
  patternIds: string[];
  smeIds: string[];
  correlationIds: string[];
};

const SNAPSHOT_STORAGE_KEY = "context-guardian:synth:snapshot:v1";
const SEEN_UPDATE_STORAGE_KEY = "context-guardian:synth:seen-update:v1";
const EMPTY_HIGHLIGHT: SynthHighlightState = {
  active: false,
  changedMetrics: {
    artifacts: false,
    learned: false,
    patterns: false,
    correlations: false,
    smes: false,
  },
  patternIds: [],
  smeIds: [],
  correlationIds: [],
};

function hasSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readSnapshotFromStorage(): SynthState | null {
  if (!hasSessionStorage()) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SynthState;
  } catch {
    return null;
  }
}

function writeSnapshotToStorage(snapshot: SynthState): void {
  if (!hasSessionStorage()) {
    return;
  }
  try {
    window.sessionStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures in demo mode.
  }
}

function readSeenUpdate(): string | null {
  if (!hasSessionStorage()) {
    return null;
  }
  try {
    return window.sessionStorage.getItem(SEEN_UPDATE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSeenUpdate(lastUpdatedAt: string): void {
  if (!hasSessionStorage()) {
    return;
  }
  try {
    window.sessionStorage.setItem(SEEN_UPDATE_STORAGE_KEY, lastUpdatedAt);
  } catch {
    // Ignore storage failures in demo mode.
  }
}

function confidenceMapChanged(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) {
    return true;
  }
  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (key !== rightKeys[index]) {
      return true;
    }
    if (left[key] !== right[key]) {
      return true;
    }
  }
  return false;
}

function diffSynthState(current: SynthState, previous: SynthState): SynthHighlightState {
  const prevPatterns = new Map(previous.patterns.map((pattern) => [pattern.patternId, pattern]));
  const prevSmes = new Map(previous.smeRoutingTable.map((sme) => [sme.personId, sme]));
  const prevCorrelations = new Map(
    previous.correlationMap.map((correlation) => [correlation.correlationId, correlation]),
  );

  const patternIds = current.patterns
    .filter((pattern) => {
      const prev = prevPatterns.get(pattern.patternId);
      if (!prev) {
        return true;
      }
      return (
        prev.occurrenceCount !== pattern.occurrenceCount ||
        prev.lastSeen !== pattern.lastSeen ||
        prev.confidenceScore !== pattern.confidenceScore
      );
    })
    .map((pattern) => pattern.patternId);

  const smeIds = current.smeRoutingTable
    .filter((sme) => {
      const prev = prevSmes.get(sme.personId);
      if (!prev) {
        return true;
      }
      return (
        prev.lastActiveDate !== sme.lastActiveDate ||
        prev.recentInvolvements[0] !== sme.recentInvolvements[0] ||
        confidenceMapChanged(prev.confidenceByDomain, sme.confidenceByDomain)
      );
    })
    .map((sme) => sme.personId);

  const correlationIds = current.correlationMap
    .filter((correlation) => {
      const prev = prevCorrelations.get(correlation.correlationId);
      if (!prev) {
        return true;
      }
      return (
        prev.observedCount !== correlation.observedCount ||
        prev.confidenceScore !== correlation.confidenceScore ||
        prev.supportingTicketIds.length !== correlation.supportingTicketIds.length
      );
    })
    .map((correlation) => correlation.correlationId);

  const changedMetrics = {
    artifacts: current.sourceArtifactCount !== previous.sourceArtifactCount,
    learned:
      (current.learnedTicketIds?.length ?? 0) !== (previous.learnedTicketIds?.length ?? 0),
    patterns: patternIds.length > 0 || current.patterns.length !== previous.patterns.length,
    correlations:
      correlationIds.length > 0 || current.correlationMap.length !== previous.correlationMap.length,
    smes: smeIds.length > 0 || current.smeRoutingTable.length !== previous.smeRoutingTable.length,
  };

  const active =
    changedMetrics.artifacts ||
    changedMetrics.learned ||
    changedMetrics.patterns ||
    changedMetrics.correlations ||
    changedMetrics.smes;

  return {
    active,
    changedMetrics,
    patternIds,
    smeIds,
    correlationIds,
  };
}

function stamp(iso: string): string {
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

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDomain(domain: string): string {
  return domain.replace(/_/g, " ");
}

function domainStrengthLabel(score: number): string {
  if (score >= 0.9) {
    return "Core";
  }
  if (score >= 0.72) {
    return "Strong";
  }
  if (score >= 0.5) {
    return "Supporting";
  }
  return "Emerging";
}

function routePriority(topDomainScore: number, recencyScore: number): string {
  const score = 0.62 * topDomainScore + 0.38 * recencyScore;
  if (score >= 0.82) {
    return "Route Now";
  }
  if (score >= 0.64) {
    return "Route Soon";
  }
  if (score >= 0.46) {
    return "Backup";
  }
  return "Monitor";
}

export default function SynthesizedKnowledgePage() {
  const [state, setState] = useState<SynthState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlight, setHighlight] = useState<SynthHighlightState>(EMPTY_HIGHLIGHT);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch("/api/synthesized-knowledge", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load synthesized knowledge (${response.status}).`);
      }
      const payload = (await response.json()) as SynthState;
      const previous = readSnapshotFromStorage();
      const seenUpdate = readSeenUpdate();
      setHighlight((current) => {
        if (current.active) {
          return current;
        }
        if (!previous) {
          return current;
        }
        if (previous.lastUpdatedAt === payload.lastUpdatedAt || seenUpdate === payload.lastUpdatedAt) {
          return current;
        }
        const diff = diffSynthState(payload, previous);
        if (diff.active) {
          writeSeenUpdate(payload.lastUpdatedAt);
          return diff;
        }
        return current;
      });
      writeSnapshotToStorage(payload);
      setState(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load synthesized knowledge.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
    const timer = window.setInterval(() => {
      void loadState();
    }, 6_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [loadState]);

  const recencyById = useMemo(
    () => new Map((state?.recencyIndex ?? []).map((entry) => [entry.entryId, entry])),
    [state?.recencyIndex],
  );

  const topPatterns = useMemo(
    () => [...(state?.patterns ?? [])].sort((a, b) => b.occurrenceCount - a.occurrenceCount).slice(0, 8),
    [state?.patterns],
  );

  const topSmes = useMemo(
    () =>
      [...(state?.smeRoutingTable ?? [])]
        .sort((a, b) => {
          const left = recencyById.get(a.personId)?.relevanceScore ?? 0;
          const right = recencyById.get(b.personId)?.relevanceScore ?? 0;
          return right - left;
        })
        .slice(0, 10),
    [state?.smeRoutingTable, recencyById],
  );

  const highlightedPatternIds = useMemo(() => new Set(highlight.patternIds), [highlight.patternIds]);
  const highlightedSmeIds = useMemo(() => new Set(highlight.smeIds), [highlight.smeIds]);
  const highlightedCorrelationIds = useMemo(
    () => new Set(highlight.correlationIds),
    [highlight.correlationIds],
  );

  const refreshNow = useCallback(async () => {
    if (state?.lastUpdatedAt) {
      writeSeenUpdate(state.lastUpdatedAt);
    }
    setHighlight(EMPTY_HIGHLIGHT);
    await loadState();
  }, [loadState, state?.lastUpdatedAt]);

  return (
    <main className="synth-shell">
      <header className="synth-header">
        <div>
          <p className="synth-eyebrow">Living Memory</p>
          <h1>Synthesized Knowledge Layer</h1>
          <p>
            Auto-refreshes every 6 seconds and updates when tickets are authorized and resolved.
          </p>
          {highlight.active && (
            <p className="synth-highlight-note">
              New updates are highlighted in green until you refresh.
            </p>
          )}
        </div>
        <button type="button" onClick={() => void refreshNow()}>
          Refresh Now
        </button>
      </header>

      {loading && <p className="synth-note">Loading synthesized knowledge...</p>}
      {error && <p className="synth-note synth-error">{error}</p>}
      {!state ? null : (
        <>
          <section className="synth-metrics">
            <article className={highlight.active ? "synth-new" : ""}>
              <span>Last Updated</span>
              <strong>{stamp(state.lastUpdatedAt)}</strong>
            </article>
            <article>
              <span>Bootstrap Built</span>
              <strong>{stamp(state.builtAt)}</strong>
            </article>
            <article className={highlight.active && highlight.changedMetrics.artifacts ? "synth-new" : ""}>
              <span>Artifacts Analyzed</span>
              <strong>{state.sourceArtifactCount} total (bootstrap + learned)</strong>
            </article>
            <article className={highlight.active && highlight.changedMetrics.learned ? "synth-new" : ""}>
              <span>Resolved Tickets Learned</span>
              <strong>{state.learnedTicketIds?.length ?? 0}</strong>
            </article>
            <article
              className={
                highlight.active &&
                (highlight.changedMetrics.patterns ||
                  highlight.changedMetrics.correlations ||
                  highlight.changedMetrics.smes)
                  ? "synth-new"
                  : ""
              }
            >
              <span>Patterns / Correlations / SMEs</span>
              <strong>
                {state.patterns.length} / {state.correlationMap.length} / {state.smeRoutingTable.length}
              </strong>
            </article>
          </section>

          <section className="synth-section">
            <h2>Pattern Library</h2>
            <p className="synth-section-caption">
              Value: compresses recurring incidents into reusable diagnosis and resolution templates.
            </p>
            <div className="synth-list">
              {topPatterns.map((pattern) => (
                <article
                  key={pattern.patternId}
                  className={
                    highlight.active && highlightedPatternIds.has(pattern.patternId) ? "synth-new" : ""
                  }
                >
                  <p>
                    <strong>{pattern.name}</strong>
                    <span>
                      {pattern.patternId} | seen {pattern.occurrenceCount}x | confidence{" "}
                      {pct(pattern.confidenceScore)}
                    </span>
                    {highlight.active && highlightedPatternIds.has(pattern.patternId) && (
                      <em className="synth-new-badge">Updated</em>
                    )}
                  </p>
                  <p>{pattern.description}</p>
                  <p>Systems: {pattern.involvedSystems.join(", ")}</p>
                  <p>Last seen: {stamp(pattern.lastSeen)}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="synth-section">
            <h2>SME Recency Routing</h2>
            <p className="synth-section-caption">
              Value: routes by current, demonstrated involvement instead of historical ownership.
            </p>
            <div className="synth-list">
              {topSmes.map((sme) => {
                const domains = Object.entries(sme.confidenceByDomain)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3);
                const recency = recencyById.get(sme.personId)?.relevanceScore ?? 0;
                const topDomainScore = domains[0]?.[1] ?? 0;
                const priority = routePriority(topDomainScore, recency);

                return (
                  <article
                    key={sme.personId}
                    className={highlight.active && highlightedSmeIds.has(sme.personId) ? "synth-new" : ""}
                  >
                    <p>
                      <strong>{sme.name}</strong>
                      <span>
                        {sme.role} | {sme.status} | recency {pct(recency)} | priority {priority}
                      </span>
                      {highlight.active && highlightedSmeIds.has(sme.personId) && (
                        <em className="synth-new-badge">Updated</em>
                      )}
                    </p>
                    <p>
                      Top domains:
                    </p>
                    <div className="synth-tag-row">
                      {domains.length > 0 ? (
                        domains.map(([domain, score]) => (
                          <span key={`${sme.personId}-${domain}`} className="synth-tag">
                            {formatDomain(domain)} - {domainStrengthLabel(score)}
                          </span>
                        ))
                      ) : (
                        <span className="synth-tag">n/a</span>
                      )}
                    </div>
                    <p>Recent involvements: {sme.recentInvolvements.slice(0, 4).join(", ") || "none"}</p>
                    <p>Last active: {stamp(sme.lastActiveDate)}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="synth-section">
            <h2>Correlation Map</h2>
            <p className="synth-section-caption">
              Value: exposes hidden system couplings so operators can triage root causes faster.
            </p>
            <div className="synth-list">
              {state.correlationMap.slice(0, 10).map((correlation) => (
                <article
                  key={correlation.correlationId}
                  className={
                    highlight.active && highlightedCorrelationIds.has(correlation.correlationId)
                      ? "synth-new"
                      : ""
                  }
                >
                  <p>
                    <strong>
                      {correlation.systemA} ↔ {correlation.systemB}
                    </strong>
                    <span>
                      {correlation.correlationId} | observed {correlation.observedCount}x | confidence{" "}
                      {pct(correlation.confidenceScore)}
                    </span>
                    {highlight.active && highlightedCorrelationIds.has(correlation.correlationId) && (
                      <em className="synth-new-badge">Updated</em>
                    )}
                  </p>
                  <p>{correlation.description}</p>
                  <p>Supporting tickets: {correlation.supportingTicketIds.join(", ")}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
