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

  const loadState = useCallback(async () => {
    try {
      const response = await fetch("/api/synthesized-knowledge", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load synthesized knowledge (${response.status}).`);
      }
      const payload = (await response.json()) as SynthState;
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

  return (
    <main className="synth-shell">
      <header className="synth-header">
        <div>
          <p className="synth-eyebrow">Living Memory</p>
          <h1>Synthesized Knowledge Layer</h1>
          <p>
            Auto-refreshes every 6 seconds and updates when tickets are authorized and resolved.
          </p>
        </div>
        <button type="button" onClick={() => void loadState()}>
          Refresh Now
        </button>
      </header>

      {loading && <p className="synth-note">Loading synthesized knowledge...</p>}
      {error && <p className="synth-note synth-error">{error}</p>}
      {!state ? null : (
        <>
          <section className="synth-metrics">
            <article>
              <span>Last Updated</span>
              <strong>{stamp(state.lastUpdatedAt)}</strong>
            </article>
            <article>
              <span>Bootstrap Built</span>
              <strong>{stamp(state.builtAt)}</strong>
            </article>
            <article>
              <span>Artifacts Analyzed</span>
              <strong>{state.sourceArtifactCount} total (bootstrap + learned)</strong>
            </article>
            <article>
              <span>Resolved Tickets Learned</span>
              <strong>{state.learnedTicketIds?.length ?? 0}</strong>
            </article>
            <article>
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
                <article key={pattern.patternId}>
                  <p>
                    <strong>{pattern.name}</strong>
                    <span>
                      {pattern.patternId} | seen {pattern.occurrenceCount}x | confidence{" "}
                      {pct(pattern.confidenceScore)}
                    </span>
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
                  <article key={sme.personId}>
                    <p>
                      <strong>{sme.name}</strong>
                      <span>
                        {sme.role} | {sme.status} | recency {pct(recency)} | priority {priority}
                      </span>
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
                <article key={correlation.correlationId}>
                  <p>
                    <strong>
                      {correlation.systemA} ↔ {correlation.systemB}
                    </strong>
                    <span>
                      {correlation.correlationId} | observed {correlation.observedCount}x | confidence{" "}
                      {pct(correlation.confidenceScore)}
                    </span>
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
