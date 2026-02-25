"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type {
  AnalysisResponse,
  EnvironmentType,
  ExecutionSurface,
} from "@/lib/ambient-ops/types";

type TerminalLineKind = "command" | "output" | "error" | "system";

type TerminalLine = {
  id: number;
  kind: TerminalLineKind;
  text: string;
  at: string;
};

type DemoScript = {
  id: string;
  label: string;
  component: string;
  environment: EnvironmentType;
  surface: ExecutionSurface;
  note: string;
  lines: Array<{ kind: TerminalLineKind; text: string }>;
  successLines: Array<{ kind: TerminalLineKind; text: string }>;
};

type FrictionSignal = {
  detected: boolean;
  repeatedFailures: number;
  signature?: string;
  latestError?: string;
};

type ObserverEventTone = "neutral" | "alert" | "ai" | "success";

type ObserverEvent = {
  id: string;
  at: string;
  tone: ObserverEventTone;
  code: string;
  text: string;
};

type WorkerMemoryEntryKind = "incident" | "resolution";

type WorkerMemoryEntry = {
  id: string;
  at: string;
  workerId: string;
  kind: WorkerMemoryEntryKind;
  title: string;
  summary: string;
  categoryLabel?: string;
  component: string;
  environment: EnvironmentType;
  surface: ExecutionSurface;
  sourceRequestId?: string;
  relatedPeople?: string[];
  relatedArtifacts?: string[];
};

const STORAGE_PREFIX = "ambient-ops-worker-memory:";
const FAILURE_PATTERN =
  /(ERR!|ERROR|FAILED|FAIL:|E401|Unauthorized|403 Forbidden|AccessDenied|x509|certificate|UPGRADE FAILED|lock timeout|another migration is already running)/i;

const INITIAL_TERMINAL_LINES: TerminalLine[] = [
  {
    id: 1,
    kind: "system",
    text: "ambient-node observer online · passive capture armed",
    at: new Date("2026-02-25T15:02:00Z").toISOString(),
  },
  {
    id: 2,
    kind: "system",
    text: "ready: run demo workflow (observer will classify + store automatically)",
    at: new Date("2026-02-25T15:02:02Z").toISOString(),
  },
];

const DEMO_SCRIPTS: DemoScript[] = [
  {
    id: "iam_deploy_regression",
    label: "CI Deploy Permission Regression",
    component: "identity-gateway",
    environment: "shared-ci",
    surface: "ci",
    note: "Shared runner loses decrypt permission after policy rollout",
    lines: [
      { kind: "system", text: "[CI] deploy workflow started · environment=staging" },
      { kind: "output", text: "[CI] assuming shared deploy role" },
      {
        kind: "error",
        text: "[CI] AccessDeniedException: User is not authorized to perform kms:Decrypt on arn:aws:kms:us-east-1:123:key/abc...",
      },
      {
        kind: "error",
        text: "[CI] 403 Forbidden while assuming deploy role for environment=staging",
      },
      { kind: "error", text: "[CI] Deploy FAILED" },
    ],
    successLines: [
      { kind: "system", text: "[observer] rerun initiated after policy correction" },
      { kind: "output", text: "[CI] assume-role succeeded" },
      { kind: "output", text: "[CI] deploy completed · 4m18s" },
    ],
  },
  {
    id: "registry_auth_401",
    label: "Private Registry 401 in CI",
    component: "payments-web",
    environment: "shared-ci",
    surface: "ci",
    note: "CI install fails while local install still passes",
    lines: [
      { kind: "system", text: "[CI] build-and-test · npm ci" },
      { kind: "output", text: "[CI] fetching @org/sdk from npm.example.internal" },
      { kind: "error", text: "[CI] npm ERR! code E401" },
      {
        kind: "error",
        text: "[CI] npm ERR! Unable to authenticate, need: Bearer realm=\"Artifactory Realm\"",
      },
      {
        kind: "error",
        text: "[CI] GET https://npm.example.internal/@org/sdk - 401 Unauthorized",
      },
    ],
    successLines: [
      { kind: "system", text: "[observer] rerun initiated after token refresh / mount-path fix" },
      { kind: "output", text: "[CI] npm ci completed" },
      { kind: "output", text: "[CI] build-and-test passed" },
    ],
  },
];

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function relativeShort(iso: string): string {
  const deltaMs = Date.now() - Date.parse(iso);
  const mins = Math.max(0, Math.round(deltaMs / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function normalizeFailureSignature(line: string): string {
  return line
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, "")
    .replace(/arn:[^\s]+/g, "arn:#")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

function computeFriction(lines: TerminalLine[]): FrictionSignal {
  const recent = lines.slice(-18);
  const failures = recent.filter(
    (line) => line.kind === "error" || FAILURE_PATTERN.test(line.text),
  );

  if (failures.length === 0) {
    return { detected: false, repeatedFailures: 0 };
  }

  const counts = new Map<string, number>();
  for (const line of failures) {
    const signature = normalizeFailureSignature(line.text);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  const [signature, repeats] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const latestError = [...failures].reverse()[0]?.text;
  const detected = failures.length >= 2 || (repeats ?? 0) >= 2;

  return {
    detected,
    repeatedFailures: failures.length,
    signature,
    latestError,
  };
}

function lineColor(kind: TerminalLineKind): string {
  if (kind === "command") return "text-cyan-200";
  if (kind === "error") return "text-rose-200";
  if (kind === "system") return "text-amber-200";
  return "text-zinc-300";
}

function eventToneClass(tone: ObserverEventTone): string {
  if (tone === "alert") return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  if (tone === "ai") return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
  if (tone === "success") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  return "border-white/10 bg-white/5 text-zinc-200";
}

function memoryKindClass(kind: WorkerMemoryEntryKind): string {
  return kind === "incident"
    ? "border-amber-300/15 bg-amber-300/8"
    : "border-emerald-300/15 bg-emerald-300/8";
}

function buildContextNotes(entries: WorkerMemoryEntry[]): string[] {
  return entries.slice(0, 6).map((entry) => {
    if (entry.kind === "incident") {
      return `incident:${entry.categoryLabel ?? "unknown"}:${entry.component}:${entry.summary}`;
    }
    return `resolution:${entry.component}:${entry.summary}`;
  });
}

function storageKey(workerId: string): string {
  return `${STORAGE_PREFIX}${workerId}`;
}

function loadWorkerMemory(workerId: string): WorkerMemoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(workerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WorkerMemoryEntry =>
        typeof item === "object" && item !== null && typeof (item as { id?: string }).id === "string",
    );
  } catch {
    return [];
  }
}

const observerSeedEvent: ObserverEvent = {
  id: makeId("evt"),
  at: new Date().toISOString(),
  tone: "neutral",
  code: "OBS",
  text: "Observer armed · passive mode ON",
};

export default function AmbientOpsNode() {
  const [workerId, setWorkerId] = useState("markkogan-dev");
  const [selectedScriptId, setSelectedScriptId] = useState(DEMO_SCRIPTS[0].id);
  const [autoObserve, setAutoObserve] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>(INITIAL_TERMINAL_LINES);
  const [component, setComponent] = useState(DEMO_SCRIPTS[0].component);
  const [environment, setEnvironment] = useState<EnvironmentType>(DEMO_SCRIPTS[0].environment);
  const [surface, setSurface] = useState<ExecutionSurface>(DEMO_SCRIPTS[0].surface);
  const [userNote, setUserNote] = useState(DEMO_SCRIPTS[0].note);
  const [manualError, setManualError] = useState("");

  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [observerEvents, setObserverEvents] = useState<ObserverEvent[]>([observerSeedEvent]);
  const [workerMemory, setWorkerMemory] = useState<WorkerMemoryEntry[]>([]);
  const [hydratedWorkerId, setHydratedWorkerId] = useState<string | null>(null);

  const [activeObservationId, setActiveObservationId] = useState<string | null>(null);
  const [lastAutoAnalysisKey, setLastAutoAnalysisKey] = useState<string | null>(null);
  const [resolutionCapturedForRequestId, setResolutionCapturedForRequestId] = useState<string | null>(null);
  const [analysisTriggerLabel, setAnalysisTriggerLabel] = useState<"manual" | "passive" | null>(null);

  const lineIdRef = useRef(INITIAL_TERMINAL_LINES.length + 1);
  const playingTokenRef = useRef(0);

  const friction = useMemo(() => computeFriction(terminalLines), [terminalLines]);
  const contextNotes = useMemo(() => buildContextNotes(workerMemory), [workerMemory]);
  const selectedScript =
    DEMO_SCRIPTS.find((script) => script.id === selectedScriptId) ?? DEMO_SCRIPTS[0];
  const topPeople = analysis?.recommendedPeople.slice(0, 3) ?? [];

  const incidentCount = workerMemory.filter((entry) => entry.kind === "incident").length;
  const resolutionCount = workerMemory.filter((entry) => entry.kind === "resolution").length;

  const triggerPassiveAnalyze = useEffectEvent(() => {
    void analyzeIncident("passive");
  });

  const appendTerminal = (kind: TerminalLineKind, text: string) => {
    setTerminalLines((prev) => [
      ...prev,
      {
        id: lineIdRef.current++,
        kind,
        text,
        at: new Date().toISOString(),
      },
    ]);
  };

  const pushObserverEvent = (event: Omit<ObserverEvent, "id" | "at">) => {
    setObserverEvents((prev) => [
      {
        id: makeId("evt"),
        at: new Date().toISOString(),
        ...event,
      },
      ...prev,
    ].slice(0, 18));
  };

  const resetTerminal = () => {
    playingTokenRef.current = Date.now();
    setIsPlaying(false);
    lineIdRef.current = INITIAL_TERMINAL_LINES.length + 1;
    setTerminalLines(INITIAL_TERMINAL_LINES);
    setAnalysis(null);
    setAnalysisError(null);
    setActiveObservationId(null);
    setLastAutoAnalysisKey(null);
    setResolutionCapturedForRequestId(null);
    setObserverEvents([
      {
        id: makeId("evt"),
        at: new Date().toISOString(),
        tone: "neutral",
        code: "OBS",
        text: "Workspace reset · observer still armed",
      },
    ]);
  };

  const persistIncidentToWorkerMemory = (
    result: AnalysisResponse,
    trigger: "manual" | "passive",
  ) => {
    const topMatch = result.topMatches[0]?.incident;
    const newEntry: WorkerMemoryEntry = {
      id: makeId("mem"),
      at: new Date().toISOString(),
      workerId,
      kind: "incident",
      title: result.classification.label,
      summary: topMatch
        ? `Matched ${topMatch.title} · ${Math.round(result.topMatches[0].score * 100)} similarity`
        : result.classification.rationale,
      categoryLabel: result.classification.label,
      component: result.capturedContext.component,
      environment: result.capturedContext.environment,
      surface: result.capturedContext.surface,
      sourceRequestId: result.requestId,
      relatedPeople: result.recommendedPeople.slice(0, 3).map((person) => person.person.handle),
      relatedArtifacts: result.storyline[0]?.artifacts.slice(0, 3).map((artifact) => artifact.label) ?? [],
    };

    setWorkerMemory((prev) => [newEntry, ...prev].slice(0, 20));
    pushObserverEvent({
      tone: "success",
      code: "STO",
      text: `Stored incident in worker context (${trigger}) · ${result.classification.label}`,
    });
    pushObserverEvent({
      tone: "ai",
      code: "CTX",
      text: `AI context pack for ${workerId} updated`,
    });
  };

  const analyzeIncident = async (trigger: "manual" | "passive") => {
    const errorText = manualError.trim() || friction.latestError || "";
    if (!errorText) {
      setAnalysisError("No error detected yet.");
      setPanelOpen(true);
      return;
    }

    setPanelOpen(true);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisTriggerLabel(trigger);

    if (trigger === "passive") {
      pushObserverEvent({
        tone: "alert",
        code: "FRI",
        text: `Friction detected · ${friction.repeatedFailures} failure signals`,
      });
    }

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorText,
          component,
          environment,
          surface,
          userDescription: userNote.trim() || undefined,
          terminalHistory: terminalLines.slice(-20).map((line) => line.text),
          workerId,
          workerContextNotes: contextNotes,
        }),
      });

      const payload = (await response.json()) as AnalysisResponse | { error?: string };
      const apiError =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : null;

      if (!response.ok || apiError) {
        throw new Error(apiError || "Analysis failed");
      }

      const result = payload as AnalysisResponse;
      setAnalysis(result);
      setResolutionCapturedForRequestId(null);

      pushObserverEvent({
        tone: "ai",
        code: "AI",
        text: `Classified: ${result.classification.label} · ${Math.round(result.classification.confidence * 100)}%`,
      });
      if (result.recommendedPeople[0]) {
        pushObserverEvent({
          tone: "ai",
          code: "ASST",
          text: `Top resolver: @${result.recommendedPeople[0].person.handle}`,
        });
      }

      persistIncidentToWorkerMemory(result, trigger);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Analysis failed");
      pushObserverEvent({
        tone: "alert",
        code: "ERR",
        text: error instanceof Error ? error.message : "Analysis failed",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runScript = async () => {
    if (isPlaying) return;

    const token = Date.now();
    playingTokenRef.current = token;
    setIsPlaying(true);
    setAnalysis(null);
    setAnalysisError(null);
    setResolutionCapturedForRequestId(null);

    const observationId = makeId("obs");
    setActiveObservationId(observationId);

    setComponent(selectedScript.component);
    setEnvironment(selectedScript.environment);
    setSurface(selectedScript.surface);
    setUserNote(selectedScript.note);
    setManualError("");

    pushObserverEvent({
      tone: "neutral",
      code: "OBS",
      text: `Observing ${selectedScript.label}`,
    });

    appendTerminal("system", `observer attached · worker=${workerId} · mode=passive`);
    appendTerminal("command", `$ run ${selectedScript.id}`);

    for (const line of selectedScript.lines) {
      if (playingTokenRef.current !== token) break;
      await sleep(180);
      appendTerminal(line.kind, line.text);
    }

    if (playingTokenRef.current === token) {
      appendTerminal("system", "observer: waiting for friction signal / repeated failure pattern");
    }

    setIsPlaying(false);
  };

  const repeatLatestFailure = () => {
    const latestError = manualError.trim() || friction.latestError;
    if (!latestError) return;
    appendTerminal("command", "$ retry");
    appendTerminal("error", latestError);
    pushObserverEvent({
      tone: "alert",
      code: "FRI",
      text: "Repeated failure observed on retry",
    });
  };

  const captureResolutionPattern = async () => {
    if (!analysis) return;
    if (resolutionCapturedForRequestId === analysis.requestId) return;

    const topStory = analysis.storyline[0];
    const topMatch = analysis.topMatches[0]?.incident;
    const artifactLabels = topStory?.artifacts.slice(0, 2).map((artifact) => artifact.label) ?? [];
    const actionSummary = topMatch?.resolutionOutcome ?? topStory?.summary ?? "Recorded resolution signal";

    pushObserverEvent({
      tone: "success",
      code: "RES",
      text: `Resolution signal captured · ${artifactLabels.join(" + ") || "runbook action"}`,
    });

    appendTerminal("system", "[observer] resolution evidence detected");
    for (const line of selectedScript.successLines) {
      await sleep(120);
      appendTerminal(line.kind, line.text);
    }

    const resolutionEntry: WorkerMemoryEntry = {
      id: makeId("mem"),
      at: new Date().toISOString(),
      workerId,
      kind: "resolution",
      title: "Resolution Pattern Captured",
      summary: `${actionSummary}${artifactLabels.length > 0 ? ` · ${artifactLabels.join(", ")}` : ""}`,
      component,
      environment,
      surface,
      sourceRequestId: analysis.requestId,
      relatedPeople: analysis.recommendedPeople.slice(0, 2).map((person) => person.person.handle),
      relatedArtifacts: artifactLabels,
    };

    setWorkerMemory((prev) => [resolutionEntry, ...prev].slice(0, 20));
    setResolutionCapturedForRequestId(analysis.requestId);
    pushObserverEvent({
      tone: "ai",
      code: "CTX",
      text: `Worker context enriched with resolution pattern`,
    });
  };

  useEffect(() => {
    const loaded = loadWorkerMemory(workerId);
    setWorkerMemory(loaded);
    setHydratedWorkerId(workerId);
  }, [workerId]);

  useEffect(() => {
    if (hydratedWorkerId !== workerId || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey(workerId), JSON.stringify(workerMemory));
    } catch {
      // ignore storage failures in the demo UI
    }
  }, [hydratedWorkerId, workerId, workerMemory]);

  useEffect(() => {
    if (friction.detected) {
      setPanelOpen(true);
    }
  }, [friction.detected]);

  useEffect(() => {
    if (!autoObserve) return;
    if (!friction.detected) return;
    if (!friction.signature) return;
    if (!activeObservationId) return;
    if (isAnalyzing) return;

    const autoKey = `${activeObservationId}:${friction.signature}`;
    if (autoKey === lastAutoAnalysisKey) return;

    setLastAutoAnalysisKey(autoKey);
    triggerPassiveAnalyze();
  }, [
    autoObserve,
    friction.detected,
    friction.signature,
    activeObservationId,
    isAnalyzing,
    lastAutoAnalysisKey,
  ]);

  const nextSuggestedAction = analysis?.topMatches[0]?.incident.resolutionOutcome;
  const topArtifactLabels = analysis?.storyline[0]?.artifacts.slice(0, 3).map((artifact) => artifact.label) ?? [];

  return (
    <div className="min-h-screen bg-[#06070b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.14),transparent_38%),radial-gradient(circle_at_82%_22%,rgba(34,211,238,0.15),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:26px_26px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-black/35 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                <span className="font-mono text-sm">AO</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                  Ambient Operations Node
                </p>
                <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  Passive Observer + AI Resolver Sidecar
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200">
                <span className="uppercase tracking-[0.14em] text-zinc-400">Worker</span>
                <input
                  value={workerId}
                  onChange={(event) => setWorkerId(event.target.value || "worker-demo")}
                  className="w-[136px] border-none bg-transparent p-0 font-mono text-xs text-zinc-100 outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => setAutoObserve((value) => !value)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition ${
                  autoObserve
                    ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100"
                    : "border-white/10 bg-white/5 text-zinc-300"
                }`}
              >
                Observe {autoObserve ? "On" : "Off"}
              </button>

              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
                Context Pack <span className="font-mono text-zinc-100">{workerMemory.length}</span>
              </div>
            </div>
          </div>
        </header>

        <div
          className={`grid gap-4 transition-all duration-300 ${
            panelOpen ? "lg:grid-cols-[minmax(0,1.25fr)_390px]" : "lg:grid-cols-[minmax(0,1fr)_58px]"
          }`}
        >
          <section className="min-w-0 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl">
                <div className="flex flex-wrap items-center gap-2">
                  {DEMO_SCRIPTS.map((script) => {
                    const active = selectedScriptId === script.id;
                    return (
                      <button
                        key={script.id}
                        type="button"
                        onClick={() => {
                          setSelectedScriptId(script.id);
                          setComponent(script.component);
                          setEnvironment(script.environment);
                          setSurface(script.surface);
                          setUserNote(script.note);
                        }}
                        className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                          active
                            ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                            : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                        }`}
                      >
                        <span className="block font-medium">{script.label}</span>
                        <span className="block text-[10px] text-zinc-500">{script.component}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => void runScript()}
                    disabled={isPlaying}
                    className="rounded-2xl border border-cyan-300/25 bg-cyan-300/12 px-4 py-3 text-left transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Demo Run</p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {isPlaying ? "Streaming activity..." : "Start observed workflow"}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={repeatLatestFailure}
                    className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-left transition hover:bg-amber-300/14"
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-amber-100">Friction</p>
                    <p className="mt-1 text-sm font-medium text-white">Repeat latest failure</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => void analyzeIncident("manual")}
                    disabled={isAnalyzing}
                    className="rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-left transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">AI Assist</p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {isAnalyzing ? "Analyzing..." : "Analyze now"}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => void captureResolutionPattern()}
                    disabled={!analysis || resolutionCapturedForRequestId === analysis.requestId}
                    className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-left transition hover:bg-emerald-300/14 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-emerald-100">Resolution</p>
                    <p className="mt-1 text-sm font-medium text-white">Capture resolution signal</p>
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Component</p>
                    <p className="mt-1 text-sm font-medium text-white">{component}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Env</p>
                    <p className="mt-1 text-sm font-medium text-white">{environment}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Surface</p>
                    <p className="mt-1 text-sm font-medium text-white">{surface}</p>
                  </div>
                </div>

                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    Note
                  </span>
                  <input
                    value={userNote}
                    onChange={(event) => setUserNote(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/35"
                  />
                </label>

                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    Error Override (optional)
                  </span>
                  <textarea
                    value={manualError}
                    onChange={(event) => setManualError(event.target.value)}
                    rows={2}
                    placeholder="Paste a failure line"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-cyan-300/35"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-[#040509]/85 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Work Surface
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                      friction.detected
                        ? "border-amber-300/25 bg-amber-300/12 text-amber-100"
                        : "border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {friction.detected ? `friction ${friction.repeatedFailures}` : "stable"}
                  </span>
                  <button
                    type="button"
                    onClick={resetTerminal}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="h-[440px] overflow-auto font-mono text-sm leading-6">
                    {terminalLines.map((line) => (
                      <div key={line.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
                        <span className="select-none text-xs text-zinc-600">{formatClock(line.at)}</span>
                        <span className={`${lineColor(line.kind)} break-words`}>{line.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Observer State</p>
                    <div className="mt-2 grid gap-2">
                      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                        <span className="text-xs text-zinc-400">Passive Mode</span>
                        <span className={`text-xs font-medium ${autoObserve ? "text-emerald-200" : "text-zinc-300"}`}>
                          {autoObserve ? "ON" : "OFF"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                        <span className="text-xs text-zinc-400">Last Trigger</span>
                        <span className="text-xs font-medium text-zinc-100">
                          {analysisTriggerLabel ? analysisTriggerLabel : "none"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                        <span className="text-xs text-zinc-400">Worker Context</span>
                        <span className="text-xs font-medium text-zinc-100">{workerMemory.length} entries</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Demo Proof</p>
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-zinc-300">
                        1. Observe work in background
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-zinc-300">
                        2. Classify issue + recommend people
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-zinc-300">
                        3. Store incident + resolution into worker context
                      </div>
                    </div>
                  </div>

                  {analysisError ? (
                    <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
                      {analysisError}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            {panelOpen ? (
              <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/35 shadow-[0_30px_100px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">AI Sidecar</p>
                    <p className="text-sm font-semibold text-white">Assist + Memory Rail</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10"
                  >
                    Hide
                  </button>
                </div>

                <div className="overflow-auto p-4 space-y-4">
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Classification</p>
                        <h2 className="mt-1 text-base font-semibold text-white">
                          {analysis?.classification.label ?? "Waiting for friction"}
                        </h2>
                      </div>
                      {analysis ? (
                        <div className="text-right">
                          <span className="block rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100">
                            {analysis.mode}
                          </span>
                          <span className="mt-1 block text-xs text-zinc-400">
                            {Math.round(analysis.classification.confidence * 100)}%
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {analysis ? (
                      <>
                        <p className="mt-2 text-xs leading-5 text-zinc-300">{analysis.classification.rationale}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {analysis.classification.keySignals.slice(0, 5).map((signal) => (
                            <span
                              key={signal}
                              className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[11px] text-zinc-200"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                        <p className="mt-3 text-[11px] text-zinc-500">
                          worker context attached: {analysis.capturedContext.workerContextNotes?.length ?? 0} notes
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">Run the workflow and let passive observe trigger analysis.</p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Recommended People</p>
                      <span className="text-[10px] text-zinc-500">AI helper</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {topPeople.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-500">
                          No recommendation yet.
                        </div>
                      ) : (
                        topPeople.map((item) => (
                          <div key={item.person.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-white">{item.person.name}</p>
                                <p className="text-xs text-zinc-400">@{item.person.handle} · {item.person.team}</p>
                              </div>
                              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-100">
                                {Math.round(item.relevanceScore * 100)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-zinc-300">{item.reasons.join(" · ")}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Resolution Pattern</p>
                    {analysis ? (
                      <div className="mt-2 space-y-2 text-xs">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-zinc-200">
                          {nextSuggestedAction ?? "No resolution pattern available"}
                        </div>
                        {topArtifactLabels.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {topArtifactLabels.map((label) => (
                              <span
                                key={label}
                                className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[11px] text-zinc-300"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void captureResolutionPattern()}
                          disabled={resolutionCapturedForRequestId === analysis.requestId}
                          className="w-full rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-300/14 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {resolutionCapturedForRequestId === analysis.requestId
                            ? "Resolution Signal Captured"
                            : "Capture As Worker Resolution Context"}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">Analyze an incident to reveal likely resolution actions.</p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Observer Feed</p>
                      <span className="text-[10px] text-zinc-500">passive background</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {observerEvents.map((event) => (
                        <div key={event.id} className={`rounded-xl border px-3 py-2 ${eventToneClass(event.tone)}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{event.code}</span>
                            <span className="text-[10px] opacity-80">{relativeShort(event.at)}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5">{event.text}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Worker Memory</p>
                      <span className="text-[10px] text-zinc-500">{incidentCount} incidents · {resolutionCount} resolutions</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {workerMemory.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-500">
                          Empty. First analysis will store a classified incident here.
                        </div>
                      ) : (
                        workerMemory.slice(0, 8).map((entry) => (
                          <div
                            key={entry.id}
                            className={`rounded-xl border p-3 ${memoryKindClass(entry.kind)}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-white">{entry.title}</p>
                              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                                {entry.kind} · {relativeShort(entry.at)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-zinc-300">{entry.summary}</p>
                            <p className="mt-2 text-[11px] text-zinc-500">
                              {entry.component} · {entry.environment} · {entry.surface}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="sticky top-4 flex h-[80vh] items-center justify-center rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  className="flex h-full w-full items-center justify-center rounded-3xl text-xs uppercase tracking-[0.18em] text-zinc-300 hover:bg-white/5"
                >
                  Open AI Rail
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
