import type {
  IncidentCategory,
  MemoryGraph,
  PersonRef,
  ResolutionArtifact,
} from "@/lib/ambient-ops/types";

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  dependency_registry_auth: "Dependency Registry Auth Failure",
  ci_cache_corruption: "CI Cache Corruption / Poisoned Cache",
  build_toolchain_version_drift: "Build Toolchain Version Drift",
  database_migration_lock: "Database Migration Lock / Contention",
  kubernetes_config_drift: "Kubernetes Config Drift",
  permissions_access_policy: "Permissions / Access Policy Regression",
  tls_proxy_certificate: "TLS Proxy / Certificate Chain Failure",
};

export const CATEGORY_DESCRIPTIONS: Record<IncidentCategory, string> = {
  dependency_registry_auth:
    "Package install or artifact download fails due to expired tokens, private registry auth, or missing credentials in terminal/CI.",
  ci_cache_corruption:
    "Build or test failures caused by stale, poisoned, or incompatible cache layers, lockfiles, or compiled outputs in CI.",
  build_toolchain_version_drift:
    "Build/test failures caused by Node, pnpm, Java, Python, compiler, or plugin version mismatch across local and CI environments.",
  database_migration_lock:
    "Migration fails because schema lock is held, transaction contention exists, or multiple deploy jobs run migrations concurrently.",
  kubernetes_config_drift:
    "Deploy/runtime issue caused by cluster config differences, wrong values, missing secrets, or stale manifests between environments.",
  permissions_access_policy:
    "Unauthorized or forbidden errors caused by IAM/role/access policy changes, missing group membership, or scoped token regressions.",
  tls_proxy_certificate:
    "Network/proxy/TLS issues caused by certificate rotation, missing CA bundles, corporate proxy interception, or hostname mismatch.",
};

const people: PersonRef[] = [
  {
    id: "p_alina",
    name: "Alina Park",
    handle: "alina.park",
    team: "Developer Productivity",
    role: "Staff Engineer",
    lastWorkedOn: "2026-02-12T17:40:00Z",
  },
  {
    id: "p_omar",
    name: "Omar Nwosu",
    handle: "omar.nwosu",
    team: "Build Systems",
    role: "Senior Build Engineer",
    lastWorkedOn: "2026-02-15T13:20:00Z",
  },
  {
    id: "p_mina",
    name: "Mina Patel",
    handle: "mina.patel",
    team: "Platform Runtime",
    role: "SRE",
    lastWorkedOn: "2026-02-18T19:08:00Z",
  },
  {
    id: "p_rafael",
    name: "Rafael Kim",
    handle: "rafael.kim",
    team: "Identity & Access",
    role: "Security Engineer",
    lastWorkedOn: "2026-02-20T15:14:00Z",
  },
  {
    id: "p_jules",
    name: "Jules Romero",
    handle: "jules.romero",
    team: "Data Infra",
    role: "Database Reliability Engineer",
    lastWorkedOn: "2026-01-27T23:01:00Z",
  },
  {
    id: "p_isha",
    name: "Isha Menon",
    handle: "isha.menon",
    team: "IT Operations",
    role: "Endpoint Admin",
    lastWorkedOn: "2026-02-21T16:44:00Z",
  },
  {
    id: "p_dan",
    name: "Daniel Cho",
    handle: "daniel.cho",
    team: "Release Engineering",
    role: "Release Manager",
    lastWorkedOn: "2026-02-06T11:30:00Z",
  },
  {
    id: "p_nora",
    name: "Nora Singh",
    handle: "nora.singh",
    team: "Developer Productivity",
    role: "Tools Engineer",
    lastWorkedOn: "2026-02-23T09:25:00Z",
  },
];

const artifacts: ResolutionArtifact[] = [
  {
    id: "a_pr_18422",
    type: "pr",
    label: "PR #18422",
    url: "https://git.example.internal/monorepo/pull/18422",
    summary: "Refresh CI npm auth token injection and mask job logs.",
    timestamp: "2026-02-12T16:40:00Z",
  },
  {
    id: "a_ticket_it4471",
    type: "ticket",
    label: "IT-4471",
    url: "https://tickets.example.internal/IT-4471",
    summary: "Renewed service account token used by build runners.",
    timestamp: "2026-02-12T15:55:00Z",
  },
  {
    id: "a_cfg_npmrc",
    type: "config_change",
    label: "ci/npm-auth.yaml",
    url: "https://git.example.internal/platform-config/blob/main/ci/npm-auth.yaml",
    summary: "Updated token mount path and TTL refresh window.",
    timestamp: "2026-02-12T16:05:00Z",
  },
  {
    id: "a_runbook_pkg401",
    type: "runbook",
    label: "Runbook: Registry 401 Triage",
    url: "https://runbooks.example.internal/devex/registry-401",
    summary: "Checklist for token scope, registry hostname, and `.npmrc` source.",
    timestamp: "2025-11-03T10:12:00Z",
  },
  {
    id: "a_pr_18002",
    type: "pr",
    label: "PR #18002",
    url: "https://git.example.internal/monorepo/pull/18002",
    summary: "Bust turbo cache key on Node minor version + lockfile hash.",
    timestamp: "2026-01-18T08:14:00Z",
  },
  {
    id: "a_ticket_ci902",
    type: "ticket",
    label: "CI-902",
    url: "https://tickets.example.internal/CI-902",
    summary: "Rebuilt remote cache bucket after corrupted artifact uploads.",
    timestamp: "2026-01-18T07:31:00Z",
  },
  {
    id: "a_doc_cache",
    type: "doc",
    label: "Cache Invalidation Notes",
    url: "https://docs.example.internal/build/cache-invalidation-notes",
    summary: "Known failure signatures for stale TypeScript outputs in CI.",
    timestamp: "2025-12-09T14:50:00Z",
  },
  {
    id: "a_pr_17644",
    type: "pr",
    label: "PR #17644",
    url: "https://git.example.internal/monorepo/pull/17644",
    summary: "Pin pnpm via Corepack and enforce Node version in CI bootstrap.",
    timestamp: "2025-12-22T13:09:00Z",
  },
  {
    id: "a_ticket_rel311",
    type: "ticket",
    label: "REL-311",
    url: "https://tickets.example.internal/REL-311",
    summary: "Runner image rolled back due to Node 22 patch mismatch.",
    timestamp: "2025-12-22T11:32:00Z",
  },
  {
    id: "a_cfg_toolchain",
    type: "config_change",
    label: ".nvmrc + .node-version sync",
    url: "https://git.example.internal/monorepo/blob/main/.nvmrc",
    summary: "Standardized Node and pnpm versions used by dev shells and CI.",
    timestamp: "2025-12-22T12:41:00Z",
  },
  {
    id: "a_pr_17117",
    type: "pr",
    label: "PR #17117",
    url: "https://git.example.internal/service-api/pull/17117",
    summary: "Serialize migration job and add advisory lock timeout retry.",
    timestamp: "2025-11-14T19:20:00Z",
  },
  {
    id: "a_ticket_db552",
    type: "ticket",
    label: "DB-552",
    url: "https://tickets.example.internal/DB-552",
    summary: "Killed blocking session in staging and documented lock owner query.",
    timestamp: "2025-11-14T18:43:00Z",
  },
  {
    id: "a_runbook_migration",
    type: "runbook",
    label: "Migration Lock Response",
    url: "https://runbooks.example.internal/data/migration-locks",
    summary: "Detect lock owner, pause duplicate deploy, rerun migration safely.",
    timestamp: "2025-11-14T20:01:00Z",
  },
  {
    id: "a_pr_18288",
    type: "pr",
    label: "PR #18288",
    url: "https://git.example.internal/platform-config/pull/18288",
    summary: "Restore missing config map value and sync Helm values to prod.",
    timestamp: "2026-02-03T05:11:00Z",
  },
  {
    id: "a_ticket_sre1201",
    type: "ticket",
    label: "SRE-1201",
    url: "https://tickets.example.internal/SRE-1201",
    summary: "Deploy failed due to missing `API_BASE_URL` in prod values file.",
    timestamp: "2026-02-03T03:42:00Z",
  },
  {
    id: "a_cfg_helm",
    type: "config_change",
    label: "values-prod.yaml",
    url: "https://git.example.internal/platform-config/blob/main/apps/payments/values-prod.yaml",
    summary: "Added rotated secret ref and corrected namespace override.",
    timestamp: "2026-02-03T04:26:00Z",
  },
  {
    id: "a_pr_18377",
    type: "pr",
    label: "PR #18377",
    url: "https://git.example.internal/identity-gateway/pull/18377",
    summary: "Restore runner role to secrets decrypt policy and audit denied action.",
    timestamp: "2026-02-20T14:32:00Z",
  },
  {
    id: "a_ticket_iam778",
    type: "ticket",
    label: "IAM-778",
    url: "https://tickets.example.internal/IAM-778",
    summary: "Policy regression from least-privilege rollout blocked CI deploy.",
    timestamp: "2026-02-20T13:07:00Z",
  },
  {
    id: "a_runbook_403",
    type: "runbook",
    label: "403 / AccessDenied Playbook",
    url: "https://runbooks.example.internal/security/403-access-denied",
    summary: "Map denied action to role, scope, and environment owner quickly.",
    timestamp: "2025-10-19T09:50:00Z",
  },
  {
    id: "a_pr_18510",
    type: "pr",
    label: "PR #18510",
    url: "https://git.example.internal/dev-shell/pull/18510",
    summary: "Install corp root CA in dev container and update npm/curl trust chain.",
    timestamp: "2026-02-21T15:23:00Z",
  },
  {
    id: "a_ticket_it4529",
    type: "ticket",
    label: "IT-4529",
    url: "https://tickets.example.internal/IT-4529",
    summary: "Distributed new corporate proxy certificate bundle to laptops.",
    timestamp: "2026-02-21T14:48:00Z",
  },
  {
    id: "a_doc_tls",
    type: "doc",
    label: "TLS Intercept Troubleshooting",
    url: "https://docs.example.internal/it/tls-intercept-troubleshooting",
    summary: "Fix `unable to get local issuer certificate` across npm/git/curl.",
    timestamp: "2026-02-21T16:12:00Z",
  },
];

export const memoryGraph: MemoryGraph = {
  people,
  artifacts,
  incidents: [
    {
      id: "inc_401_registry_ci",
      title: "CI install failed with 401 from private npm registry",
      category: "dependency_registry_auth",
      component: "payments-web",
      environment: "shared-ci",
      surface: "ci",
      signatureTerms: [
        "401",
        "npm",
        "registry",
        "unauthorized",
        "token",
        "E401",
        ".npmrc",
      ],
      errorExamples: [
        "npm ERR! code E401",
        "Unable to authenticate, need: Bearer realm=\"Artifactory Realm\"",
        "GET https://npm.example.internal/@org/pkg - 401 Unauthorized",
      ],
      summary:
        "Runner token expired after credential mount path changed. CI jobs kept using a stale secret reference.",
      observedPattern:
        "Failures spiked in shared CI after token TTL rotation; local installs were unaffected.",
      resolutionOutcome:
        "Updated token injection path and rotated service account credentials; installs recovered immediately.",
      timeToResolveMinutes: 64,
      recurrenceCount: 5,
      lastSeenAt: "2026-02-12T17:12:00Z",
      linkedPeople: ["p_alina", "p_omar", "p_rafael"],
      linkedArtifacts: ["a_ticket_it4471", "a_cfg_npmrc", "a_pr_18422", "a_runbook_pkg401"],
      storyline: [
        {
          at: "2026-02-12T14:58:00Z",
          actorId: "p_omar",
          action: "Correlated E401 failures across multiple CI jobs and confirmed local installs still passed.",
        },
        {
          at: "2026-02-12T15:22:00Z",
          actorId: "p_rafael",
          action: "Confirmed runner service token scope was valid but the mounted secret path had changed during rotation.",
        },
        {
          at: "2026-02-12T15:55:00Z",
          actorId: "p_isha",
          action: "Rotated build-runner token and reissued credentials through IT service account pipeline.",
        },
        {
          at: "2026-02-12T16:40:00Z",
          actorId: "p_alina",
          action: "Merged CI auth injection fix and added log masking for token refresh checks.",
        },
      ],
    },
    {
      id: "inc_cache_ts_ci",
      title: "TypeScript compile failed from stale CI cache after lockfile update",
      category: "ci_cache_corruption",
      component: "monorepo-build",
      environment: "shared-ci",
      surface: "ci",
      signatureTerms: [
        "cache",
        "turbo",
        "artifact",
        "stale",
        "typescript",
        "module not found",
        "remote cache",
      ],
      errorExamples: [
        "error TS2307: Cannot find module '@/generated/types'",
        "Restored cache artifact but workspace state differs from lockfile",
        "turbo: remote cache hit for incompatible output",
      ],
      summary:
        "Remote build cache reused outputs compiled under a different lockfile and Node minor version.",
      observedPattern:
        "Failures appeared intermittently and disappeared after manual cache purge or rerun with cache disabled.",
      resolutionOutcome:
        "Cache key now includes lockfile hash and Node version; corrupted bucket entries were rebuilt.",
      timeToResolveMinutes: 92,
      recurrenceCount: 7,
      lastSeenAt: "2026-01-18T08:40:00Z",
      linkedPeople: ["p_omar", "p_nora", "p_dan"],
      linkedArtifacts: ["a_ticket_ci902", "a_pr_18002", "a_doc_cache"],
      storyline: [
        {
          at: "2026-01-18T06:57:00Z",
          actorId: "p_nora",
          action: "Noticed compile failures only on cache-hit paths and reproduced by replaying a prior artifact.",
        },
        {
          at: "2026-01-18T07:31:00Z",
          actorId: "p_omar",
          action: "Rebuilt remote cache bucket segments and invalidated suspect entries.",
        },
        {
          at: "2026-01-18T08:14:00Z",
          actorId: "p_dan",
          action: "Merged cache-key expansion tied to Node minor version and lockfile hash.",
        },
      ],
    },
    {
      id: "inc_toolchain_node_pnpm",
      title: "Local build failed because CI runner image upgraded Node and pnpm",
      category: "build_toolchain_version_drift",
      component: "developer-shell",
      environment: "local",
      surface: "terminal",
      signatureTerms: [
        "node version",
        "pnpm",
        "corepack",
        "unsupported engine",
        "lockfile",
        "ERR_PNPM",
      ],
      errorExamples: [
        "ERR_PNPM_LOCKFILE_BREAKING_CHANGE",
        "Unsupported engine: wanted {\"node\":\">=20 <21\"}",
        "This project requires pnpm 9.x but you have 8.x",
      ],
      summary:
        "Runner image patch changed pnpm behavior and lockfile format, while developer shells were on older versions.",
      observedPattern:
        "Developers saw failures after pulling a fresh lockfile generated by CI or another developer.",
      resolutionOutcome:
        "Pinned Node/pnpm versions in repo and aligned CI bootstrap with Corepack-managed versions.",
      timeToResolveMinutes: 48,
      recurrenceCount: 9,
      lastSeenAt: "2025-12-22T13:22:00Z",
      linkedPeople: ["p_alina", "p_dan", "p_nora"],
      linkedArtifacts: ["a_ticket_rel311", "a_cfg_toolchain", "a_pr_17644"],
      storyline: [
        {
          at: "2025-12-22T10:54:00Z",
          actorId: "p_dan",
          action: "Linked new failures to a runner image refresh that pulled a newer Node patch and pnpm binary.",
        },
        {
          at: "2025-12-22T11:32:00Z",
          actorId: "p_nora",
          action: "Rolled back the runner image to stop lockfile churn while the permanent fix was prepared.",
        },
        {
          at: "2025-12-22T13:09:00Z",
          actorId: "p_alina",
          action: "Merged repo-level toolchain pinning and CI bootstrap checks to reject drift early.",
        },
      ],
    },
    {
      id: "inc_db_migration_lock",
      title: "Staging deploy failed due to migration lock contention",
      category: "database_migration_lock",
      component: "service-api",
      environment: "staging",
      surface: "deploy",
      signatureTerms: [
        "migration",
        "lock",
        "deadlock",
        "timeout",
        "schema_migrations",
        "relation lock",
        "advisory lock",
      ],
      errorExamples: [
        "could not obtain lock on relation \"schema_migrations\"",
        "canceling statement due to lock timeout",
        "another migration is already running",
      ],
      summary:
        "Two deploy jobs raced and both attempted schema migrations; one held the lock while the other timed out.",
      observedPattern:
        "Deploy queue retried automatically, causing repeated failures until the blocking session was terminated.",
      resolutionOutcome:
        "Serialized migration execution and added advisory lock retries with clear lock owner logging.",
      timeToResolveMinutes: 74,
      recurrenceCount: 3,
      lastSeenAt: "2025-11-14T20:13:00Z",
      linkedPeople: ["p_jules", "p_mina", "p_dan"],
      linkedArtifacts: ["a_ticket_db552", "a_pr_17117", "a_runbook_migration"],
      storyline: [
        {
          at: "2025-11-14T18:43:00Z",
          actorId: "p_jules",
          action: "Identified blocking DB session from a duplicate deploy worker and terminated it in staging.",
        },
        {
          at: "2025-11-14T19:20:00Z",
          actorId: "p_dan",
          action: "Merged deploy pipeline changes to serialize migration jobs.",
        },
        {
          at: "2025-11-14T20:01:00Z",
          actorId: "p_mina",
          action: "Added runbook steps for lock owner queries and safe rerun procedure.",
        },
      ],
    },
    {
      id: "inc_k8s_values_drift",
      title: "Production deploy failed from missing Helm value after secret rotation",
      category: "kubernetes_config_drift",
      component: "payments-service",
      environment: "production",
      surface: "deploy",
      signatureTerms: [
        "helm",
        "configmap",
        "secret",
        "env var",
        "kubernetes",
        "values",
        "manifest",
      ],
      errorExamples: [
        "Error: UPGRADE FAILED: template: missing key API_BASE_URL",
        "CrashLoopBackOff: secret reference not found",
        "values-prod.yaml missing rotated secret name",
      ],
      summary:
        "A secret rotation and values file divergence left prod missing required Helm values present in staging.",
      observedPattern:
        "Deploys passed validation in lower environments but failed during prod chart render/app startup.",
      resolutionOutcome:
        "Synced prod Helm values, restored missing config map entries, and added drift checks pre-deploy.",
      timeToResolveMinutes: 87,
      recurrenceCount: 4,
      lastSeenAt: "2026-02-03T05:28:00Z",
      linkedPeople: ["p_mina", "p_dan", "p_alina"],
      linkedArtifacts: ["a_ticket_sre1201", "a_cfg_helm", "a_pr_18288"],
      storyline: [
        {
          at: "2026-02-03T03:42:00Z",
          actorId: "p_mina",
          action: "Confirmed prod values file was missing the new secret reference introduced during rotation.",
        },
        {
          at: "2026-02-03T04:26:00Z",
          actorId: "p_dan",
          action: "Patched Helm values and namespace override in platform config.",
        },
        {
          at: "2026-02-03T05:11:00Z",
          actorId: "p_alina",
          action: "Merged config sync PR and added a pre-deploy drift validation check.",
        },
      ],
    },
    {
      id: "inc_iam_access_denied",
      title: "Deploy pipeline lost permission to decrypt secrets after IAM policy rollout",
      category: "permissions_access_policy",
      component: "identity-gateway",
      environment: "shared-ci",
      surface: "ci",
      signatureTerms: [
        "access denied",
        "forbidden",
        "403",
        "iam",
        "policy",
        "kms",
        "not authorized",
      ],
      errorExamples: [
        "AccessDeniedException: User is not authorized to perform kms:Decrypt",
        "403 Forbidden while assuming deploy role",
        "sts:AssumeRole not permitted for runner service account",
      ],
      summary:
        "Least-privilege policy rollout removed a decrypt action required by CI deploy jobs.",
      observedPattern:
        "Only pipelines using the shared deploy role failed; manual deploys by on-call still worked.",
      resolutionOutcome:
        "Restored missing decrypt permission for the runner role and documented denied-action mapping workflow.",
      timeToResolveMinutes: 59,
      recurrenceCount: 6,
      lastSeenAt: "2026-02-20T14:57:00Z",
      linkedPeople: ["p_rafael", "p_mina", "p_dan"],
      linkedArtifacts: ["a_ticket_iam778", "a_pr_18377", "a_runbook_403"],
      storyline: [
        {
          at: "2026-02-20T13:07:00Z",
          actorId: "p_rafael",
          action: "Mapped denied action to the new runner policy and found missing kms:Decrypt scope.",
        },
        {
          at: "2026-02-20T13:48:00Z",
          actorId: "p_mina",
          action: "Validated manual deploy path still worked with broader on-call role, narrowing failure to shared CI role.",
        },
        {
          at: "2026-02-20T14:32:00Z",
          actorId: "p_dan",
          action: "Merged policy restoration and added CI role policy diff alerting.",
        },
      ],
    },
    {
      id: "inc_tls_proxy_local",
      title: "Local package install failed behind corporate proxy after CA rotation",
      category: "tls_proxy_certificate",
      component: "developer-shell",
      environment: "local",
      surface: "terminal",
      signatureTerms: [
        "tls",
        "certificate",
        "ssl",
        "proxy",
        "local issuer certificate",
        "self signed",
        "CA bundle",
      ],
      errorExamples: [
        "unable to get local issuer certificate",
        "SSL certificate problem: self signed certificate in certificate chain",
        "x509: certificate signed by unknown authority",
      ],
      summary:
        "Corporate proxy CA rotated, and dev containers/laptops lacked the new root certificate bundle.",
      observedPattern:
        "npm, git, and curl all failed TLS validation on the same machines starting the same day.",
      resolutionOutcome:
        "Distributed new CA bundle, updated dev shell image, and documented trust chain install steps.",
      timeToResolveMinutes: 41,
      recurrenceCount: 8,
      lastSeenAt: "2026-02-21T16:31:00Z",
      linkedPeople: ["p_isha", "p_nora", "p_alina"],
      linkedArtifacts: ["a_ticket_it4529", "a_pr_18510", "a_doc_tls"],
      storyline: [
        {
          at: "2026-02-21T14:48:00Z",
          actorId: "p_isha",
          action: "Confirmed corporate proxy certificate rotation and published the new root CA bundle.",
        },
        {
          at: "2026-02-21T15:23:00Z",
          actorId: "p_nora",
          action: "Patched dev shell image to include the corporate root CA in npm/curl trust stores.",
        },
        {
          at: "2026-02-21T16:12:00Z",
          actorId: "p_alina",
          action: "Published troubleshooting doc covering TLS intercept failures across local tools.",
        },
      ],
    },
  ],
};

export const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS) as IncidentCategory[];

export function getCategoryLabel(category: IncidentCategory): string {
  return CATEGORY_LABELS[category];
}

export function getPeopleByIds(ids: string[]): PersonRef[] {
  const byId = new Map(memoryGraph.people.map((person) => [person.id, person]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as PersonRef[];
}

export function getArtifactsByIds(ids: string[]): ResolutionArtifact[] {
  const byId = new Map(memoryGraph.artifacts.map((artifact) => [artifact.id, artifact]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as ResolutionArtifact[];
}

