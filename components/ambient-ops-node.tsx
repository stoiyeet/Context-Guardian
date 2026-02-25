"use client";

import { useEffect, useMemo, useState } from "react";
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

type ScenarioLine = {
  kind: TerminalLineKind;
  text: string;
};

type Scenario = {
  id: string;
  label: string;
  summary: string;
  component: string;
  environment: EnvironmentType;
  surface: ExecutionSurface;
  userDescription: string;
  lines: ScenarioLine[];
};

type FrictionSignal = {
  detected: boolean;
  repeatedFailures: number;
  signature?: string;
  summary?: string;
};

const FAILURE_PATTERN =
  /(ERR!|ERROR|FAILED|FAIL:|E401|Unauthorized|403 Forbidden|AccessDenied|x509|certificate|UPGRADE FAILED|lock timeout|another migration is already running)/i;

const INITIAL_LINES: TerminalLine[] = [
  {
    id: 1,
    kind: "system",
    text: "ambient-node: passive observation active (terminal + CI context simulator)",
    at: new Date("2026-02-25T14:08:00Z").toISOString(),
  },
  {
    id: 2,
    kind: "system",
    text: "tip: run a scenario or paste an error and click Analyze",
    at: new Date("2026-02-25T14:08:02Z").toISOString(),
  },
];

const SCENARIOS: Scenario[] = [
  {
    id: "tls_local_npm",
    label: "Local npm TLS failure",
    summary: "Developer shell behind corp proxy after CA rotation",
    component: "developer-shell",
    environment: "local",
    surface: "terminal",
    userDescription:
      "npm installs started failing this morning on my laptop and in dev container after network reconnect.",
    lines: [
      { kind: "command", text: "$ npm install" },
      {
        kind: "error",
        text: "npm ERR! code UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
      },
      {
        kind: "error",
        text: "npm ERR! request to https://npm.example.internal/@org/ui failed, reason: unable to get local issuer certificate",
      },
      {
        kind: "output",
        text: "curl https://npm.example.internal/health -> SSL certificate problem: self signed certificate in certificate chain",
      },
    ],
  },
  {
    id: "registry_ci_401",
    label: "CI registry auth 401",
    summary: "Shared CI runner cannot fetch private package",
    component: "payments-web",
    environment: "shared-ci",
    surface: "ci",
    userDescription:
      "CI jobs fail during package install but local installs work for the same commit.",
    lines: [
      { kind: "system", text: "[CI] workflow: build-and-test / ubuntu-runner-22" },
      { kind: "output", text: "[CI] npm ci --prefer-offline" },
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
  },
  {
    id: "ci_cache_corruption",
    label: "CI cache corruption",
    summary: "Intermittent TS compile failure after remote cache hit",
    component: "monorepo-build",
    environment: "shared-ci",
    surface: "ci",
    userDescription:
      "Compile errors appear only on some CI runs and disappear when rerunning with cache disabled.",
    lines: [
      { kind: "system", text: "[CI] turbo run build --cache-dir=.turbo" },
      { kind: "output", text: "[CI] Remote cache hit for api-types" },
      {
        kind: "error",
        text: "[CI] error TS2307: Cannot find module '@/generated/types' or its corresponding type declarations.",
      },
      {
        kind: "output",
        text: "[CI] Restored cache artifact from previous run (lockfile hash mismatch warning)",
      },
      { kind: "error", text: "[CI] Build FAILED in 83s" },
    ],
  },
  {
    id: "iam_ci_access_denied",
    label: "CI IAM AccessDenied",
    summary: "Deploy step lost secrets decrypt permission",
    component: "identity-gateway",
    environment: "shared-ci",
    surface: "ci",
    userDescription:
      "Deploy pipeline started failing after a security policy rollout. Manual deploy still works for on-call users.",
    lines: [
      { kind: "system", text: "[CI] deploy stage -> assume shared deploy role" },
      {
        kind: "error",
        text: "[CI] AccessDeniedException: User is not authorized to perform kms:Decrypt on resource arn:aws:kms:us-east-1:123:key/abc...",
      },
      {
        kind: "error",
        text: "[CI] 403 Forbidden while assuming deploy role for environment=staging",
      },
      { kind: "error", text: "[CI] Deploy FAILED" },
    ],
  },
  {
    id: "helm_prod_drift",
    label: "Prod Helm values drift",
    summary: "Secret rotation caused missing prod value during deploy",
    component: "payments-service",
    environment: "production",
    surface: "deploy",
    userDescription:
      "Deploy renders in staging but fails in prod after secret rotation; suspect config drift.",
    lines: [
      { kind: "command", text: "$ helm upgrade payments ./chart -f values-prod.yaml" },
      {
        kind: "error",
        text: "Error: UPGRADE FAILED: template: payments/templates/deployment.yaml: missing key API_BASE_URL",
      },
      {
        kind: "output",
        text: "pod/payments-7c9d... -> CrashLoopBackOff: secret reference not found",
      },
      { kind: "error", text: "deploy step failed" },
    ],
  },
  {
    id: "db_migration_lock",
    label: "Migration lock contention",
    summary: "Deploy retry collides with existing migration session",
    component: "service-api",
    environment: "staging",
    surface: "deploy",
    userDescription:
      "Staging deploy keeps failing during migration step; looks like another job is already running migrations.",
    lines: [
      { kind: "system", text: "[deploy] running migrations" },
      {
        kind: "error",
        text: "ERROR: could not obtain lock on relation \"schema_migrations\"",
      },
      {
        kind: "error",
        text: "canceling statement due to lock timeout",
      },
      {
        kind: "error",
        text: "another migration is already running",
      },
    ],
  },
];

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function normalizeFailureSignature(line: string): string {
  return line
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

function computeFriction(lines: TerminalLine[]): FrictionSignal {
  const recent = lines.slice(-20);
  const failures = recent.filter(
    (line) => line.kind === "error" || FAILURE_PATTERN.test(line.text),
  );
  if (failures.length === 0) {
    return { detected: false, repeatedFailures: 0 };
  }

  const counts = new Map<string, number>();
  for (const line of failures) {
    const key = normalizeFailureSignature(line.text);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const topRepeated = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const repeatedCount = topRepeated?.[1] ?? 1;
  const detected = failures.length >= 2 || repeatedCount >= 2;
  const signature = topRepeated?.[0];

  return {
    detected,
    repeatedFailures: failures.length,
    signature,
    summary: detected
      ? `${failures.length} failure signals observed in recent activity`
      : undefined,
  };
}

function getLatestErrorText(lines: TerminalLine[]): string {
  const reversed = [...lines].reverse();
  const explicit = reversed.find((line) => line.kind === "error");
  if (explicit) return explicit.text;
  const patternMatch = reversed.find((line) => FAILURE_PATTERN.test(line.text));
  return patternMatch?.text ?? "";
}

function relativeDate(iso: string): string {
  const deltaMs = Date.now() - Date.parse(iso);
  const hours = Math.round(deltaMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function lineClass(kind: TerminalLineKind): string {
  if (kind === "command") return "text-cyan-200";
  if (kind === "error") return "text-rose-200";
  if (kind === "system") return "text-amber-200";
  return "text-zinc-300";
}

export default function AmbientOpsNode() {
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>(INITIAL_LINES);
  const [component, setComponent] = useState("payments-web");
  const [environment, setEnvironment] = useState<EnvironmentType>("shared-ci");
  const [surface, setSurface] = useState<ExecutionSurface>("ci");
  const [userDescription, setUserDescription] = useState("");
  const [manualError, setManualError] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [lineCounter, setLineCounter] = useState(INITIAL_LINES.length + 1);

  const friction = useMemo(() => computeFriction(terminalLines), [terminalLines]);

  useEffect(() => {
    if (friction.detected) {
      setPanelOpen(true);
    }
  }, [friction.detected]);

  const addLines = (lines: ScenarioLine[], sourceLabel?: string) => {
    const startCounter = lineCounter;
    const now = Date.now();
    const generated: TerminalLine[] = [];

    if (sourceLabel) {
      generated.push({
        id: startCounter,
        kind: "system",
        text: `friction candidate: ${sourceLabel}`,
        at: new Date(now).toISOString(),
      });
    }

    const offset = generated.length;
    for (let index = 0; index < lines.length; index += 1) {
      generated.push({
        id: startCounter + offset + index,
        kind: lines[index].kind,
        text: lines[index].text,
        at: new Date(now + (offset + index + 1) * 1000).toISOString(),
      });
    }

    setLineCounter(startCounter + generated.length + 1);
    setTerminalLines((previous) => [...previous, ...generated]);
  };

  const runScenario = (scenario: Scenario) => {
    setSelectedScenarioId(scenario.id);
    setComponent(scenario.component);
    setEnvironment(scenario.environment);
    setSurface(scenario.surface);
    setUserDescription(scenario.userDescription);
    setManualError("");
    addLines(scenario.lines, `${scenario.label} • ${scenario.summary}`);
  };

  const repeatLatestFailure = () => {
    const latest = getLatestErrorText(terminalLines);
    if (!latest) return;
    addLines(
      [
        { kind: "command", text: "$ retry" },
        { kind: "error", text: latest },
      ],
      "Repeated failure observed",
    );
  };

  const clearWorkspace = () => {
    setTerminalLines(INITIAL_LINES);
    setAnalysis(null);
    setAnalysisError(null);
    setSelectedScenarioId(null);
    setLineCounter(INITIAL_LINES.length + 1);
  };

  const analyze = async () => {
    const errorText = manualError.trim() || getLatestErrorText(terminalLines);
    if (!errorText) {
      setAnalysisError("No error signal found. Paste an error or run a scenario first.");
      setPanelOpen(true);
      return;
    }

    setPanelOpen(true);
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorText,
          component,
          environment,
          surface,
          userDescription: userDescription.trim() || undefined,
          terminalHistory: terminalLines.slice(-20).map((line) => line.text),
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

      setAnalysis(payload as AnalysisResponse);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectedScenario = SCENARIOS.find((scenario) => scenario.id === selectedScenarioId) ?? null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#17344b_0%,#0b1017_40%,#07080d_100%)] text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/85">
                Ambient Operations Node · POC
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                AI Assistance Embedded Beside Engineering Workflow
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-300">
                Simulated terminal/CI activity is passively observed. Repeated failures trigger
                contextual analysis, incident classification, and retrieval of similar resolutions,
                artifacts, and the people who fixed them.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={analyze}
                disabled={isAnalyzing}
                className="rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Incident"}
              </button>
              <button
                type="button"
                onClick={repeatLatestFailure}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 transition hover:bg-white/10"
              >
                Repeat Failure
              </button>
              <button
                type="button"
                onClick={clearWorkspace}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 transition hover:bg-black/35"
              >
                Clear
              </button>
            </div>
          </div>
        </header>

        <div
          className={`grid gap-4 transition-all duration-300 ${
            panelOpen ? "lg:grid-cols-[minmax(0,1.35fr)_420px]" : "lg:grid-cols-[minmax(0,1fr)_56px]"
          }`}
        >
          <section className="flex min-w-0 flex-col gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-200">
                    Workflow Simulator
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Seed realistic failures to test classification, retrieval, and resolver
                    recommendations.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-300">
                  Auto-friction: {friction.detected ? "active" : "idle"} · {friction.repeatedFailures}{" "}
                  signals
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SCENARIOS.map((scenario) => {
                  const active = scenario.id === selectedScenarioId;
                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => runScenario(scenario)}
                      className={`rounded-2xl border p-3 text-left transition ${
                        active
                          ? "border-cyan-300/40 bg-cyan-300/12"
                          : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white">{scenario.label}</span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                          {scenario.surface}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-300">{scenario.summary}</p>
                      <p className="mt-2 text-[11px] text-zinc-500">
                        {scenario.component} · {scenario.environment}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#05070c]/85 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="ml-2 text-xs font-medium tracking-[0.12em] text-zinc-400">
                    TERMINAL / CI OBSERVER
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  {component} · {environment} · {surface}
                </div>
              </div>

              <div className="h-[420px] overflow-auto px-4 py-3 font-mono text-sm leading-6">
                {terminalLines.map((line) => (
                  <div key={line.id} className="grid grid-cols-[68px_minmax(0,1fr)] gap-3">
                    <span className="select-none text-xs text-zinc-500">{formatClock(line.at)}</span>
                    <span className={`${lineClass(line.kind)} break-words`}>{line.text}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 p-4">
                <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-zinc-400">
                        Error Text (optional override)
                      </span>
                      <textarea
                        value={manualError}
                        onChange={(event) => setManualError(event.target.value)}
                        rows={3}
                        placeholder="Paste terminal error / CI failure log line here..."
                        className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-cyan-300/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-zinc-400">
                        Optional Incident Description
                      </span>
                      <textarea
                        value={userDescription}
                        onChange={(event) => setUserDescription(event.target.value)}
                        rows={3}
                        placeholder="What changed, what you already tried, and what environment is affected?"
                        className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-cyan-300/40"
                      />
                    </label>
                  </div>

                  <div className="grid content-start gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-zinc-400">
                        Component
                      </span>
                      <input
                        value={component}
                        onChange={(event) => setComponent(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/40"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-zinc-400">
                          Environment
                        </span>
                        <select
                          value={environment}
                          onChange={(event) =>
                            setEnvironment(event.target.value as EnvironmentType)
                          }
                          className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/40"
                        >
                          <option value="local">local</option>
                          <option value="shared-ci">shared-ci</option>
                          <option value="staging">staging</option>
                          <option value="production">production</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-zinc-400">
                          Surface
                        </span>
                        <select
                          value={surface}
                          onChange={(event) => setSurface(event.target.value as ExecutionSurface)}
                          className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/40"
                        >
                          <option value="terminal">terminal</option>
                          <option value="ci">ci</option>
                          <option value="deploy">deploy</option>
                          <option value="manual">manual</option>
                        </select>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-zinc-300">
                      <p className="font-medium text-zinc-100">Captured context preview</p>
                      <p className="mt-1">
                        {selectedScenario
                          ? `Scenario: ${selectedScenario.label}. `
                          : "No scenario selected. "}
                        The analyzer will use the latest terminal/CI lines, your context fields, and
                        the optional description.
                      </p>
                    </div>
                  </div>
                </div>

                {analysisError ? (
                  <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                    {analysisError}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside
            className={`min-w-0 transition-all duration-300 ${
              panelOpen ? "opacity-100" : "opacity-100"
            }`}
          >
            {panelOpen ? (
              <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] min-h-[240px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/6 backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                      Friction Sidecar
                    </p>
                    <h2 className="text-sm font-semibold text-white">
                      Incident Memory & Resolver Guidance
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300 hover:bg-black/35"
                    aria-label="Collapse side panel"
                  >
                    Collapse
                  </button>
                </div>

                <div className="overflow-auto p-4">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
                          friction.detected
                            ? "border-amber-300/35 bg-amber-300/12 text-amber-100"
                            : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                      >
                        {friction.detected ? "friction detected" : "monitoring"}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                        {friction.repeatedFailures} failure signals
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      {friction.summary ||
                        "Watching for repeated failures and workflow interruptions."}
                    </p>
                    {friction.signature ? (
                      <p className="mt-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-zinc-400">
                        signature: {friction.signature}
                      </p>
                    ) : null}
                  </div>

                  {isAnalyzing ? (
                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-4 text-sm text-cyan-100">
                      Analyzing error text + context and querying operational memory graph...
                    </div>
                  ) : null}

                  {!isAnalyzing && !analysis ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <h3 className="text-sm font-semibold text-white">What appears here</h3>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">
                          Incident classification, confidence, similar historical incidents,
                          concrete fix artifacts (PRs, config changes, tickets), and the people/team
                          most likely to help.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <h3 className="text-sm font-semibold text-white">POC behavior</h3>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">
                          Classification uses live OpenAI if configured, otherwise a deterministic
                          fallback classifier. Retrieval always uses the operational memory graph in
                          this prototype.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {analysis ? (
                    <div className="space-y-4">
                      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                              Classification
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-white">
                              {analysis.classification.label}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100">
                              {analysis.mode === "openai" ? "OpenAI" : "Heuristic"}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-200">
                              {Math.round(analysis.classification.confidence * 100)}% confidence
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">
                          {analysis.classification.rationale}
                        </p>
                        {analysis.classification.keySignals.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {analysis.classification.keySignals.map((signal) => (
                              <span
                                key={signal}
                                className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-200"
                              >
                                {signal}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </section>

                      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white">
                            Recommended People (Recent + Relevant)
                          </h3>
                          <span className="text-xs text-zinc-500">
                            within company memory graph
                          </span>
                        </div>
                        <div className="mt-3 space-y-3">
                          {analysis.recommendedPeople.map((item) => (
                            <div
                              key={item.person.id}
                              className="rounded-xl border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-white">
                                    {item.person.name}
                                  </p>
                                  <p className="text-xs text-zinc-400">
                                    @{item.person.handle} · {item.person.role}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {item.person.team} · last active {relativeDate(item.person.lastWorkedOn)}
                                  </p>
                                </div>
                                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-100">
                                  {Math.round(item.relevanceScore * 100)} relevance
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-zinc-300">
                                {item.reasons.join(" · ")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <h3 className="text-sm font-semibold text-white">
                          Similar Resolution Storyline
                        </h3>
                        <div className="mt-3 space-y-4">
                          {analysis.storyline.map((item) => (
                            <article
                              key={item.incidentId}
                              className="rounded-xl border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-medium text-white">{item.title}</h4>
                                <span className="text-xs text-zinc-500">
                                  resolved {relativeDate(item.resolvedAt)}
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-zinc-300">
                                {item.summary}
                              </p>
                              <p className="mt-2 text-[11px] text-zinc-500">
                                Teams: {item.teamOwners.join(", ")}
                              </p>

                              <div className="mt-3 space-y-2">
                                {item.steps.map((step, index) => (
                                  <div
                                    key={`${item.incidentId}_${index}`}
                                    className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-xs text-zinc-300"
                                  >
                                    <span className="text-zinc-500">
                                      {new Intl.DateTimeFormat("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }).format(new Date(step.at))}
                                      :
                                    </span>{" "}
                                    {step.action}
                                  </div>
                                ))}
                              </div>

                              <div className="mt-3 grid gap-2">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                                  Linked Artifacts
                                </p>
                                {item.artifacts.map((artifact) => (
                                  <a
                                    key={artifact.id}
                                    href={artifact.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-xs text-zinc-200 transition hover:border-white/20 hover:bg-black/35"
                                  >
                                    <span className="font-medium">{artifact.label}</span>{" "}
                                    <span className="text-zinc-400">({artifact.type})</span>
                                    <span className="block text-zinc-400">{artifact.summary}</span>
                                  </a>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <h3 className="text-sm font-semibold text-white">Top Matches</h3>
                        <div className="mt-3 space-y-2">
                          {analysis.topMatches.map((match) => (
                            <div
                              key={match.incidentId}
                              className="rounded-xl border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-white">
                                  {match.incident.title}
                                </p>
                                <span className="text-xs text-zinc-400">
                                  score {Math.round(match.score * 100)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-500">
                                {match.incident.component} · {match.incident.environment} ·{" "}
                                {match.incident.surface}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-zinc-300">
                                {match.similarityReasons.join(" · ")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <h3 className="text-sm font-semibold text-white">Captured Context</h3>
                        <p className="mt-2 text-xs leading-5 text-zinc-300">
                          {analysis.capturedContext.component} · {analysis.capturedContext.environment} ·{" "}
                          {analysis.capturedContext.surface}
                        </p>
                        {analysis.capturedContext.userDescription ? (
                          <p className="mt-2 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-xs text-zinc-300">
                            {analysis.capturedContext.userDescription}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[11px] text-zinc-500">
                          Terminal history captured: {analysis.capturedContext.terminalHistory.length} lines
                        </p>
                      </section>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="sticky top-4 flex h-[80vh] items-center justify-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  className="flex h-full w-full items-center justify-center rounded-3xl text-xs uppercase tracking-[0.18em] text-zinc-300 hover:bg-white/5"
                  aria-label="Expand side panel"
                >
                  Open Sidecar
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
