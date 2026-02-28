export type KnowledgeSourceType = "slack" | "jira" | "postmortem";

export type SlackMessage = {
  id: string;
  sender: string;
  role: string;
  timestamp: string;
  dateLabel: string;
  body: string;
};

export type SlackConversationArtifact = {
  id: string;
  type: "slack";
  title: string;
  channel: string;
  messages: SlackMessage[];
};

export type JiraComment = {
  id: string;
  author: string;
  role: string;
  timestamp: string;
  body: string;
};

export type JiraStatus =
  | "Resolved"
  | "Closed"
  | "Open"
  | "Won't Fix"
  | "Cannot Reproduce"
  | "In Progress";

export type JiraArtifact = {
  id: string;
  type: "jira";
  title: string;
  ticketKey: string;
  status: JiraStatus;
  owner: string;
  createdAt: string;
  resolvedAt: string;
  summary: string;
  technicalDescription: string;
  comments: JiraComment[];
};

export type PostMortemSection = {
  heading: string;
  body: string;
};

export type PostMortemArtifact = {
  id: string;
  type: "postmortem";
  title: string;
  author: string;
  publishedAt: string;
  sections: PostMortemSection[];
};

export type KnowledgeArtifact =
  | SlackConversationArtifact
  | JiraArtifact
  | PostMortemArtifact;

const sm = (
  id: string,
  sender: string,
  role: string,
  timestamp: string,
  dateLabel: string,
  body: string,
): SlackMessage => ({
  id,
  sender,
  role,
  timestamp,
  dateLabel,
  body,
});

const jc = (
  id: string,
  author: string,
  role: string,
  timestamp: string,
  body: string,
): JiraComment => ({
  id,
  author,
  role,
  timestamp,
  body,
});

const PERSON_ROLE: Record<string, string> = {
  "Sarah Jenkins": "Senior Ops Analyst",
  "Dan Smith": "Backend Engineer",
  "Marcus T.": "Compliance Analyst",
  "Marcus Thibodeau": "Compliance Analyst",
  "Priya Nair": "Junior Ops Analyst",
  "Raj Khoury": "Engineering Manager",
  "Elena Vasquez": "Head of Compliance",
  "Dev Chatterjee": "Platform Engineer",
  "Liam O'Connell": "Transfer Operations Specialist",
  "Chloe Park": "Staff Software Engineer",
  "Nina Patel": "Reconciliation Analyst",
  "Mateo Ruiz": "Site Reliability Engineer",
  "Aisha Rahman": "Regulatory Counsel",
};

const THREAD_HOOKS: Record<string, string[]> = {
  "slack-nov-2024": [
    "Rogers/Shaw merger mapping still leaves legacy CUSIP traces in OMS snapshots",
    "manual remap in the ledger clears queue pressure but only with compliance note attached",
    "OPS-8492 remains the canonical fix path for this error class",
  ],
  "slack-stock-split-fractional-2024-08": [
    "fractional inventory from split actions keeps colliding with strict validator assumptions",
    "DRIP and split residuals look similar in the queue but need different handling",
    "bridge enrichment normalizes quantity differently than CAS lot semantics",
  ],
  "slack-delisting-mid-transfer-2024-10": [
    "delisted symbols linger in receiving ledger references longer than expected",
    "CAS can still report a stale security key after a delisting notice lands",
    "T+2 settlement windows hide this issue until late in the transfer lifecycle",
  ],
  "slack-drip-subpenny-2025-02": [
    "sub-penny DRIP residuals trip validator precision checks",
    "rounding policy mismatch between the validator and ledger reconciliation creates false rejects",
    "queue retries do not help when precision logic is deterministic",
  ],
  "slack-cas-503-2025-03": [
    "CAS 503 burst looked like individual account defects but was queue-wide backpressure",
    "incident behavior closely matched the old queue backup baseline from INFRA-392",
    "retry fanout amplified saturation in the bridge and masked root cause",
  ],
  "slack-bridge-trailing-zeros-2024-09": [
    "bridge retry path was mutating identifiers by trimming trailing zeros",
    "the issue stayed hidden because first-pass requests were clean and retries were not",
    "sporadic CUSIP drift made this appear unreproducible for weeks",
  ],
  "slack-cas-schema-change-2024-12": [
    "custodian changed acctClass semantics without notice",
    "bridge parser assumptions around account type drifted from CAS reality",
    "ops routing degraded because TFSA and FHSA labels arrived inconsistently",
  ],
  "slack-cas-timeout-rrsp-2025-02": [
    "RRSP season latency exceeded static CAS timeout thresholds",
    "duplicate attempts originated in retry policy, not operator actions",
    "queue dedupe guardrails were missing for this traffic pattern",
  ],
  "slack-tfsa-overcontribution-2025-01": [
    "transfer progress paused on TFSA over-contribution checks requiring CRA reporting",
    "ownership was unclear until compliance set explicit stop/go criteria",
    "Reg flags needed tighter notes so ops did not treat this as a pure system error",
  ],
  "slack-aml-loop-2025-05": [
    "AML review cases bounced between teams with no terminal owner",
    "queue state machine allowed reassignment loops under unresolved review outcomes",
    "compliance routing at T+2 needed an explicit owner to break the loop",
  ],
  "slack-fhsa-reg-path-2024-03": [
    "FHSA early handling inherited TFSA assumptions before process was documented",
    "classification mismatch came from both docs and account type parser drift",
    "ops asked for canonical runbook but only Slack guidance existed initially",
  ],
  "slack-w8ben-etf-2024-07": [
    "US-listed ETF transfers exposed missing W-8BEN recertification playbook",
    "ops triage and compliance expectations diverged until explicit checklist language landed",
    "the bridge presented generic errors even when issue was regulatory workflow",
  ],
  "slack-rounding-penny-2023-11": [
    "one-cent reconciliation mismatch traced to currency conversion rounding divergence",
    "ledger and custodian rounding rules differed for low notional transfers",
    "audit detectability was high but root-cause explanation was initially weak",
  ],
  "slack-fat-finger-ledger-2024-06": [
    "manual ledger adjustment hit wrong account during queue clearing rush",
    "audit trail helped detect error but remediation consumed two full shifts",
    "human-in-loop controls were present but not strict enough for peak periods",
  ],
  "slack-ledger-readonly-backlog-2025-04": [
    "ledger lock state stayed read-only after maintenance rollback",
    "ops missed early warning because notification path only handled success outcomes",
    "manual prioritization was required once queue backlog crossed forty transfers",
  ],
  "slack-validator-hyphen-regex-2023-06": [
    "validator regex rejected legitimate hyphenated client names",
    "error signature looked random until comparing rejected name patterns directly",
    "account identity formatting assumptions were too narrow in Dan's early implementation",
  ],
  "slack-validator-whitelist-2024-10": [
    "quarterly securities refresh did not update validator whitelist contents",
    "legitimate transfers failed for days with generic reject text",
    "monitoring verified job runtime but not semantic output integrity",
  ],
  "slack-validator-50-positions-timeout-2025-03": [
    "large accounts triggered validator timeout and generic failures",
    "payload size and position cardinality were not represented in timeout policy",
    "ops retried repeatedly because error text hid systemic behavior",
  ],
  "slack-fhsa-procedure-missed-2024-05": [
    "new FHSA procedure circulated in Slack but not in canonical documentation",
    "teams on later shifts missed the update and kept using old path",
    "incident exposed documentation lifecycle gap across ops and compliance",
  ],
  "slack-priya-outdated-doc-2025-01": [
    "deprecated Confluence path appeared above current guidance in search",
    "escalation chain expanded because outdated steps looked authoritative",
    "documentation ownership and archival hygiene were both weak",
  ],
  "slack-unauthorized-operator-2025-02": [
    "authorization cache stale state allowed action by insufficient permission tier",
    "audit caught the control failure before customer impact",
    "server-side permission validation needed to be mandatory at execution time",
  ],
  "slack-eoq-manual-review-sla-2025-03": [
    "quarter-end surge overwhelmed manual review lane and breached SLA",
    "many cases were low-risk and should have been auto-routed",
    "capacity planning lagged behind known seasonal transfer patterns",
  ],
  "slack-queue-backup-memory-2024-02": [
    "older queue backup created the reference model later reused in CAS incidents",
    "ticket-local troubleshooting delayed queue-level diagnosis in the first hour",
    "INFRA-392 was created to preserve operational memory for this pattern",
  ],
  "slack-validator-logic-question-2025-04": [
    "post-Dan knowledge gap made validator branch intent hard to recover",
    "legacy branch behavior crossed DRIP and corporate-action markers without clear rationale",
    "INFRA-602 tracks archaeology effort across Slack, Jira, and postmortems",
  ],
  "slack-doc-gap-followup-2025-06": [
    "DOC-114 remained open while analysts continued asking the same FHSA questions",
    "interim checklist helped but did not replace canonical runbook",
    "documentation debt persisted as a recurring operational risk signal",
  ],
};

const GLOBAL_MEMORY_REFERENCES = [
  "This is close to the whitelist issue in October where symptoms looked random before we noticed stale securities data.",
  "Pattern still resembles the queue-backup baseline from INFRA-392 more than an isolated account defect.",
  "It also echoes the trailing-zero bridge bug where retry paths behaved differently than first attempts.",
  "Reg flags are present but this still looks operational unless compliance cites a hard stop condition.",
  "If we cannot explain this in one pass, link the ticket to prior artifacts instead of re-triaging from scratch.",
];

const ACTION_CLOSEOUTS = [
  "I am adding exact queue IDs, CAS response snippets, and validator traces to the Jira comment so the next shift does not repeat the same checks.",
  "For now I will preserve processing order in the queue, annotate the ledger action explicitly, and avoid blind retries that hide causality.",
  "Please attach this thread in the ticket and include the bridge correlation IDs so retrieval can connect it with prior incidents automatically.",
  "I will document what we know, what we only suspect, and what was disproven, because those distinctions keep getting lost between shifts.",
  "If this remains unresolved at handoff I will leave a deterministic next-step list with owners so the morning team can continue without guesswork.",
];

function seedFloat(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function choose<T>(items: T[], seed: number): T {
  return items[Math.floor(seedFloat(seed) * items.length)] ?? items[0];
}

function formatDateLabel(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeSpeakerForTimeline(speaker: string, timestamp: string): string {
  const ms = new Date(timestamp).getTime();
  const danEnd = new Date("2025-03-16T00:00:00-04:00").getTime();
  const devStart = new Date("2025-04-01T00:00:00-04:00").getTime();
  const priyaStart = new Date("2025-01-01T00:00:00-05:00").getTime();

  if (speaker === "Elena Vasquez") {
    return "Marcus T.";
  }
  if (speaker === "Dan Smith" && ms >= danEnd) {
    return ms >= devStart ? "Dev Chatterjee" : "Raj Khoury";
  }
  if (speaker === "Dev Chatterjee" && ms < devStart) {
    return ms >= danEnd ? "Raj Khoury" : "Dan Smith";
  }
  if (speaker === "Priya Nair" && ms < priyaStart) {
    return "Sarah Jenkins";
  }
  return speaker;
}

function tonePrefix(speaker: string, hour: number, seed: number): string {
  if (speaker === "Sarah Jenkins") {
    const morning = [
      "Morning pass from ops:",
      "Quick structured update:",
      "I reviewed the overnight queue:",
    ];
    const late = [
      "Late-day handoff note:",
      "Before I log off, one more update:",
      "End-of-day ops summary:",
    ];
    return choose(hour < 12 ? morning : late, seed);
  }
  if (speaker === "Dan Smith") {
    const terse = ["update:", "checked logs:", "from infra side:"];
    return choose(terse, seed);
  }
  if (speaker === "Marcus T." || speaker === "Marcus Thibodeau") {
    const formal = [
      "Compliance note:",
      "Regulatory clarification:",
      "For policy alignment:",
    ];
    return choose(formal, seed);
  }
  if (speaker === "Priya Nair") {
    const learning = [
      "Question from me as I work through this:",
      "I might be misunderstanding, but:",
      "Double-checking process before I proceed:",
    ];
    return choose(learning, seed);
  }
  if (speaker === "Raj Khoury") {
    const manager = ["Escalation view:", "Leadership checkpoint:", "Visibility note:"];
    return choose(manager, seed);
  }
  if (speaker === "Liam O'Connell") {
    return choose(
      [
        "Transfer ops note:",
        "Checked queue dispatch details:",
        "Ops handling update:",
      ],
      seed,
    );
  }
  if (speaker === "Chloe Park") {
    return choose(
      [
        "Bridge/CAS implementation note:",
        "Parser behavior update:",
        "Infra codepath check:",
      ],
      seed,
    );
  }
  if (speaker === "Nina Patel") {
    return choose(
      [
        "Reconciliation view:",
        "Ledger tie-out note:",
        "Audit-side observation:",
      ],
      seed,
    );
  }
  if (speaker === "Mateo Ruiz") {
    return choose(
      [
        "SRE signal:",
        "Runtime reliability note:",
        "Latency and retry update:",
      ],
      seed,
    );
  }
  if (speaker === "Aisha Rahman") {
    return choose(
      [
        "Regulatory interpretation:",
        "Counsel perspective:",
        "Policy scope note:",
      ],
      seed,
    );
  }
  return choose(
    [
      "Platform update:",
      "Infra follow-up:",
      "Additional context from implementation side:",
    ],
    seed,
  );
}

function buildArchiveBody(
  threadId: string,
  threadTitle: string,
  speaker: string,
  timestamp: string,
  sequence: number,
): string {
  const hour = new Date(timestamp).getHours();
  const hookList = THREAD_HOOKS[threadId] ?? [
    "queue behavior remains noisier than expected for this incident class",
    "bridge and validator traces disagree on first-failure attribution",
    "ticket context still lacks one durable source-of-truth note",
  ];
  const hook = choose(hookList, sequence + threadId.length);
  const reference = choose(GLOBAL_MEMORY_REFERENCES, sequence + hook.length);
  const closeout = choose(ACTION_CLOSEOUTS, sequence + speaker.length);
  const shorthand = choose(
    [
      "I checked the ledger snapshot, the bridge transform logs, CAS response timing, and queue retries against OMS intake payloads.",
      "The queue timeline still suggests a system-level pattern even when operator view makes it look ticket-by-ticket.",
      "Validator output is still too generic for first-pass triage, which is why we keep pairing it with bridge and CAS traces.",
      "T+2 pressure is not the trigger by itself, but it changes operator behavior and increases noisy retries.",
      "DRIP residue, corporate actions, and Reg flags keep overlapping in ways that make single-system diagnosis unreliable.",
    ],
    sequence + hour + threadTitle.length,
  );

  return `${tonePrefix(speaker, hour, sequence)} ${hook}. ${shorthand} ${reference} ${closeout}`;
}

// -----------------------------------------------------------------------------
// Slack Threads
// -----------------------------------------------------------------------------

const slackArtifacts: SlackConversationArtifact[] = [
  {
    id: "slack-nov-2024",
    type: "slack",
    title: "Rogers/Shaw merger CUSIP mismatch escalating in ATON queue",
    channel: "ops-transfers-incidents",
    messages: [
      sm(
        "m1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-11-18T09:14:00-05:00",
        "Nov 18, 2024",
        "Good morning. I am seeing another cluster of ATON rejects in the queue and they look identical to Friday's pattern. It is mostly TFSA outbound. Error from the bridge is still generic, but the validator says CUSIP mismatch on handoff.",
      ),
      sm(
        "m2",
        "Dan Smith",
        "Backend Engineer",
        "2024-11-18T09:16:00-05:00",
        "Nov 18, 2024",
        "need ticket IDs and one raw payload. without that i can only guess",
      ),
      sm(
        "m3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-11-18T09:18:00-05:00",
        "Nov 18, 2024",
        "I only have account references in front of me right now. I can pull full payloads in about ten minutes. Queue is backing up and I am trying not to lose ordering.",
      ),
      sm(
        "m4",
        "Marcus T.",
        "Compliance Analyst",
        "2024-11-18T09:22:00-05:00",
        "Nov 18, 2024",
        "For awareness, merger-related CUSIP reassignment is a known edge case under IIROC Notice 24-17 on identifier continuity. If this is that scenario again, manual remap is permissible if the audit note cites the corporate action source.",
      ),
      sm(
        "m5",
        "Dan Smith",
        "Backend Engineer",
        "2024-11-18T10:01:00-05:00",
        "Nov 18, 2024",
        "found one in logs. we accept legacy Shaw id at validator, then CAS side expects new Rogers-linked CUSIP and the bridge kicks it. filing OPS-8492",
      ),
      sm(
        "m6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-11-18T10:05:00-05:00",
        "Nov 18, 2024",
        "That lines up with what ops is seeing. Failures are mid-flight, not at intake. From the queue perspective it looks random, which is why analysts kept trying retries with no change.",
      ),
      sm(
        "m7",
        "Dan Smith",
        "Backend Engineer",
        "2024-11-18T10:11:00-05:00",
        "Nov 18, 2024",
        "temporary path: manual remap in the ledger, put compliance rationale in ticket notes, then resubmit ATON. longer term fix is validator freshness check against corporate actions",
      ),
      sm(
        "m8",
        "Marcus T.",
        "Compliance Analyst",
        "2024-11-18T10:14:00-05:00",
        "Nov 18, 2024",
        "Confirmed. Please include reference to merger event and the mapping source used. I will sign off case by case until engineering patch lands.",
      ),
      sm(
        "m9",
        "Raj Khoury",
        "Engineering Manager",
        "2024-11-18T10:19:00-05:00",
        "Nov 18, 2024",
        "Keep me posted on recurrence count and whether this is isolated to TFSA.",
      ),
      sm(
        "m10",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-11-18T10:33:00-05:00",
        "Nov 18, 2024",
        "First remapped account cleared successfully. I am seeing ACK from custodian now. I will process the rest in priority order and link each one to OPS-8492.",
      ),
      sm(
        "m11",
        "Dan Smith",
        "Backend Engineer",
        "2024-11-18T11:02:00-05:00",
        "Nov 18, 2024",
        "added temporary guard in bridge logs so we can flag this exact mismatch without reading raw CAS responses manually",
      ),
      sm(
        "m12",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-11-18T11:21:00-05:00",
        "Nov 18, 2024",
        "Thank you. Someone please write this up in incident-postmortems once we close the queue. We keep relearning this and losing context between quarters.",
      ),
    ],
  },
  {
    id: "slack-stock-split-fractional-2024-08",
    type: "slack",
    title: "Stock split fractional positions failing TFSA transfer validation",
    channel: "ops-transfers-incidents",
    messages: [
      sm(
        "ss1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-08-14T09:07:00-04:00",
        "Aug 14, 2024",
        "Seeing TFSA transfers fail again for accounts holding NVDA post-split lots. Queue error says position mismatch after bridge enrichment. The failing position is fractional and tiny.",
      ),
      sm(
        "ss2",
        "Dan Smith",
        "Backend Engineer",
        "2024-08-14T09:12:00-04:00",
        "Aug 14, 2024",
        "is this DRIP-created fractional or split-created fractional",
      ),
      sm(
        "ss3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-08-14T09:13:00-04:00",
        "Aug 14, 2024",
        "Split-created. DRIP is disabled on these accounts. OMS shows 0.25 residual and validator wants whole-share precision for the transfer packet.",
      ),
      sm(
        "ss4",
        "Dan Smith",
        "Backend Engineer",
        "2024-08-14T09:21:00-04:00",
        "Aug 14, 2024",
        "validator path for TFSA currently normalizes to 2 decimals then compares against CAS integer lot flag. that's wrong for this case",
      ),
      sm(
        "ss5",
        "Marcus T.",
        "Compliance Analyst",
        "2024-08-14T09:28:00-04:00",
        "Aug 14, 2024",
        "No compliance block here if position is valid and client holdings are accurately represented. Please ensure client communications do not imply a regulatory stop.",
      ),
      sm(
        "ss6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-08-14T09:46:00-04:00",
        "Aug 14, 2024",
        "Understood. I will use language that this is a transfer processing mismatch. Filing OPS-7711 so we have a durable trail.",
      ),
      sm(
        "ss7",
        "Dan Smith",
        "Backend Engineer",
        "2024-08-14T10:02:00-04:00",
        "Aug 14, 2024",
        "added patch branch. stopgap is bypass integer lot flag when corporate action split marker is present",
      ),
      sm(
        "ss8",
        "Raj Khoury",
        "Engineering Manager",
        "2024-08-14T10:09:00-04:00",
        "Aug 14, 2024",
        "Please include test cases with fractional TFSA positions so we are not back here next split cycle.",
      ),
      sm(
        "ss9",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-08-14T11:02:00-04:00",
        "Aug 14, 2024",
        "Retried first five transfers after patch deploy to canary. All cleared. Keeping thread open until EOD in case more residual lots show up.",
      ),
    ],
  },
  {
    id: "slack-delisting-mid-transfer-2024-10",
    type: "slack",
    title: "Delisting event mid-transfer leaves receiving ledger with stale security reference",
    channel: "ops-transfers-incidents",
    messages: [
      sm(
        "dl1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-10-03T08:52:00-04:00",
        "Oct 03, 2024",
        "Flagging an odd one. Transfer started Tuesday, security delisted overnight, and now receiving ledger rejects because CAS response still carries previous trading status.",
      ),
      sm(
        "dl2",
        "Dan Smith",
        "Backend Engineer",
        "2024-10-03T09:00:00-04:00",
        "Oct 03, 2024",
        "which security",
      ),
      sm(
        "dl3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-10-03T09:01:00-04:00",
        "Oct 03, 2024",
        "NQMNQ on US side. Queue item started with valid symbol then hit transfer completion step after delist notice.",
      ),
      sm(
        "dl4",
        "Dan Smith",
        "Backend Engineer",
        "2024-10-03T09:12:00-04:00",
        "Oct 03, 2024",
        "bridge trusts CAS security state too much. no sanity check against market status feed at completion stage",
      ),
      sm(
        "dl5",
        "Marcus T.",
        "Compliance Analyst",
        "2024-10-03T09:23:00-04:00",
        "Oct 03, 2024",
        "If asset is delisted during transfer, client disclosure must include execution limitation language. This is operational, not automatically a Reg flags breach, but wording matters.",
      ),
      sm(
        "dl6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-10-03T09:38:00-04:00",
        "Oct 03, 2024",
        "Understood. I will pause finalization and prepare client note. Filing OPS-7826 now.",
      ),
      sm(
        "dl7",
        "Dan Smith",
        "Backend Engineer",
        "2024-10-03T10:10:00-04:00",
        "Oct 03, 2024",
        "ticket says wrong component by the way. this is bridge/CAS integration, not OMS. can move later",
      ),
      sm(
        "dl8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-10-03T10:12:00-04:00",
        "Oct 03, 2024",
        "Yes that was my mistake while triaging quickly. Please move component when you can.",
      ),
      sm(
        "dl9",
        "Raj Khoury",
        "Engineering Manager",
        "2024-10-03T10:17:00-04:00",
        "Oct 03, 2024",
        "No blame. fix ownership in Jira and document the classification rule so we stop misrouting these.",
      ),
    ],
  },
  {
    id: "slack-drip-subpenny-2025-02",
    type: "slack",
    title: "DRIP residual creates sub-penny value the validator rejects",
    channel: "ops-transfers-incidents",
    messages: [
      sm(
        "dr1",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-02-11T09:11:00-05:00",
        "Feb 11, 2025",
        "Question from queue: validator is rejecting a TFSA transfer over value mismatch of 0.0007. Is that just noise or do we stop it?",
      ),
      sm(
        "dr2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-11T09:14:00-05:00",
        "Feb 11, 2025",
        "Not noise. That is usually a DRIP-created sub-penny residual after a partial reinvestment. We still need to reconcile it before transfer finalization.",
      ),
      sm(
        "dr3",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-02-11T09:15:00-05:00",
        "Feb 11, 2025",
        "Got it, thanks. I thought validator ignored anything below a cent.",
      ),
      sm(
        "dr4",
        "Dan Smith",
        "Backend Engineer",
        "2025-02-11T09:19:00-05:00",
        "Feb 11, 2025",
        "it ignores below a cent on cash legs, not on position legs. code is ugly but that's how it's currently wired",
      ),
      sm(
        "dr5",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-11T09:31:00-05:00",
        "Feb 11, 2025",
        "I am opening OPS-9033. We should not make every analyst rediscover this distinction when transfer volume is high.",
      ),
      sm(
        "dr6",
        "Marcus T.",
        "Compliance Analyst",
        "2025-02-11T09:44:00-05:00",
        "Feb 11, 2025",
        "No compliance hold required if residual handling is documented and client statement remains accurate. Please keep the reconciliation note in the ticket.",
      ),
      sm(
        "dr7",
        "Dan Smith",
        "Backend Engineer",
        "2025-02-11T10:06:00-05:00",
        "Feb 11, 2025",
        "shipping quick validator message improvement. current generic error is useless",
      ),
      sm(
        "dr8",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-02-11T10:27:00-05:00",
        "Feb 11, 2025",
        "Thanks. I re-ran after adding residual adjustment note in ledger and the queue moved.",
      ),
    ],
  },
  {
    id: "slack-cas-503-2025-03",
    type: "slack",
    title: "CAS 503 burst during peak window appears as many separate transfer failures",
    channel: "eng-transfer-infra",
    messages: [
      sm(
        "c503-1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-04T08:41:00-05:00",
        "Mar 04, 2025",
        "Ops perspective: queue exploded in 15 minutes, looks like many individual failures. Same smell as the last time the queue backed up in Feb 2024.",
      ),
      sm(
        "c503-2",
        "Dan Smith",
        "Backend Engineer",
        "2025-03-04T08:44:00-05:00",
        "Mar 04, 2025",
        "seeing CAS 503 spikes. bridge retries are saturating worker slots, which is why queue latency looks like random ticket-level failure",
      ),
      sm(
        "c503-3",
        "Raj Khoury",
        "Engineering Manager",
        "2025-03-04T08:46:00-05:00",
        "Mar 04, 2025",
        "Is customer impact isolated or broad",
      ),
      sm(
        "c503-4",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-04T08:49:00-05:00",
        "Mar 04, 2025",
        "Broad enough to matter. We crossed 120 waiting items and rising. Most are RRSP and TFSA inbound this morning.",
      ),
      sm(
        "c503-5",
        "Dan Smith",
        "Backend Engineer",
        "2025-03-04T08:53:00-05:00",
        "Mar 04, 2025",
        "opening INFRA-511. temporary mitigation is cut retry fanout and increase CAS timeout from 1.5s to 3.5s",
      ),
      sm(
        "c503-6",
        "Marcus T.",
        "Compliance Analyst",
        "2025-03-04T08:58:00-05:00",
        "Mar 04, 2025",
        "Please preserve ordering metadata for delayed transfers. We cannot risk sequence ambiguity where Reg flags are involved.",
      ),
      sm(
        "c503-7",
        "Dan Smith",
        "Backend Engineer",
        "2025-03-04T09:17:00-05:00",
        "Mar 04, 2025",
        "patch deployed to infra canary. queue drain rate improving from 4/min to 22/min",
      ),
      sm(
        "c503-8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-04T09:44:00-05:00",
        "Mar 04, 2025",
        "Confirmed. Queue is still heavy but moving. I am adding a note in incident-postmortems because this looked identical to account-specific breakage from ops side.",
      ),
      sm(
        "c503-9",
        "Raj Khoury",
        "Engineering Manager",
        "2025-03-04T09:49:00-05:00",
        "Mar 04, 2025",
        "Need permanent backpressure design, not another emergency timeout tweak.",
      ),
    ],
  },
  {
    id: "slack-bridge-trailing-zeros-2024-09",
    type: "slack",
    title: "Intermittent CUSIP mismatches traced to bridge trimming trailing zeros",
    channel: "eng-transfer-infra",
    messages: [
      sm(
        "bz1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-09-12T09:03:00-04:00",
        "Sep 12, 2024",
        "I have another sporadic mismatch where the same account succeeds one day and fails the next. This one does not line up with merger mappings.",
      ),
      sm(
        "bz2",
        "Dan Smith",
        "Backend Engineer",
        "2024-09-12T09:09:00-04:00",
        "Sep 12, 2024",
        "can you share raw from bridge payload and raw from CAS response",
      ),
      sm(
        "bz3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-09-12T09:14:00-04:00",
        "Sep 12, 2024",
        "Sending in DM. One sample ends with 00 in CUSIP and one does not. I cannot tell if that is formatting or actual value change.",
      ),
      sm(
        "bz4",
        "Dan Smith",
        "Backend Engineer",
        "2024-09-12T09:31:00-04:00",
        "Sep 12, 2024",
        "wow. bridge normalization util is trimming trailing zeros after string cast on one code path. only triggers on retry path so it looked non-repro",
      ),
      sm(
        "bz5",
        "Raj Khoury",
        "Engineering Manager",
        "2024-09-12T09:34:00-04:00",
        "Sep 12, 2024",
        "How long has this been live",
      ),
      sm(
        "bz6",
        "Dan Smith",
        "Backend Engineer",
        "2024-09-12T09:38:00-04:00",
        "Sep 12, 2024",
        "looks like introduced in July retry refactor. filing INFRA-437 and adding regression test with zero-suffixed CUSIP",
      ),
      sm(
        "bz7",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-09-12T09:56:00-04:00",
        "Sep 12, 2024",
        "That explains why agents kept saying they could not reproduce when they manually retried from the queue UI only once.",
      ),
      sm(
        "bz8",
        "Dan Smith",
        "Backend Engineer",
        "2024-09-12T10:17:00-04:00",
        "Sep 12, 2024",
        "fix merged. also adding a field-level checksum log in bridge so we can diff payload mutation by stage next time",
      ),
      sm(
        "bz9",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-09-12T10:42:00-04:00",
        "Sep 12, 2024",
        "Queue clears after deploy. Please do a post-mortem; this one burned hours because it looked random.",
      ),
    ],
  },
  {
    id: "slack-cas-schema-change-2024-12",
    type: "slack",
    title: "Custodian changed account type field without notice and bridge parser broke",
    channel: "eng-transfer-infra",
    messages: [
      sm(
        "sc1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-12-09T08:55:00-05:00",
        "Dec 09, 2024",
        "Incoming incident: account type from CAS now arrives as acctClass on some responses and bridge still expects accountType. Transfers for FHSA are misclassified as TFSA.",
      ),
      sm(
        "sc2",
        "Dan Smith",
        "Backend Engineer",
        "2024-12-09T09:02:00-05:00",
        "Dec 09, 2024",
        "great. silent schema change monday morning. checking parser fallback",
      ),
      sm(
        "sc3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-12-09T09:04:00-05:00",
        "Dec 09, 2024",
        "It is causing wrong resolution pathway in queue triage. Analysts are picking the TFSA runbook for FHSA requests.",
      ),
      sm(
        "sc4",
        "Marcus T.",
        "Compliance Analyst",
        "2024-12-09T09:17:00-05:00",
        "Dec 09, 2024",
        "That classification error has regulatory impact because FHSA and TFSA reporting obligations differ. Please treat as compliance-adjacent until corrected.",
      ),
      sm(
        "sc5",
        "Dan Smith",
        "Backend Engineer",
        "2024-12-09T09:22:00-05:00",
        "Dec 09, 2024",
        "opening INFRA-566. bridge fallback currently maps unknown fields to TFSA by default. yes that's bad",
      ),
      sm(
        "sc6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-12-09T09:39:00-05:00",
        "Dec 09, 2024",
        "This feels similar to the whitelist thing in October where a default path masked the real issue until queue volume exposed it.",
      ),
      sm(
        "sc7",
        "Dan Smith",
        "Backend Engineer",
        "2024-12-09T09:56:00-05:00",
        "Dec 09, 2024",
        "patched parser to accept acctClass + accountType with strict mapping table and explicit unknown error",
      ),
      sm(
        "sc8",
        "Raj Khoury",
        "Engineering Manager",
        "2024-12-09T10:05:00-05:00",
        "Dec 09, 2024",
        "Please get custodian change-notice commitment in writing. no more surprise schema edits.",
      ),
      sm(
        "sc9",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-12-09T10:23:00-05:00",
        "Dec 09, 2024",
        "Confirmed queues are routing correctly again. I am tagging affected FHSA tickets with compliance review complete.",
      ),
    ],
  },
  {
    id: "slack-cas-timeout-rrsp-2025-02",
    type: "slack",
    title: "CAS timeout too aggressive during RRSP season created duplicate attempts",
    channel: "eng-transfer-infra",
    messages: [
      sm(
        "to1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-26T08:48:00-05:00",
        "Feb 26, 2025",
        "RRSP season volume is peaking and I am seeing duplicate transfer attempts in queue. First attempt times out, second one succeeds, then both try to settle.",
      ),
      sm(
        "to2",
        "Dan Smith",
        "Backend Engineer",
        "2025-02-26T08:54:00-05:00",
        "Feb 26, 2025",
        "CAS timeout at 1.5s is too low for current traffic. retry policy is not idempotent enough",
      ),
      sm(
        "to3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-26T08:56:00-05:00",
        "Feb 26, 2025",
        "Exactly. Ops sees two queue items with same source account and same transfer amount but different request IDs.",
      ),
      sm(
        "to4",
        "Marcus T.",
        "Compliance Analyst",
        "2025-02-26T09:03:00-05:00",
        "Feb 26, 2025",
        "Please ensure only one transfer is considered final from a reporting perspective. Duplicate attempts with same funds movement must be clearly reconciled.",
      ),
      sm(
        "to5",
        "Dan Smith",
        "Backend Engineer",
        "2025-02-26T09:11:00-05:00",
        "Feb 26, 2025",
        "opened INFRA-588. immediate fix: CAS timeout 4s during RRSP window + dedupe lock on queue key",
      ),
      sm(
        "to6",
        "Raj Khoury",
        "Engineering Manager",
        "2025-02-26T09:22:00-05:00",
        "Feb 26, 2025",
        "Do we need incident comms now",
      ),
      sm(
        "to7",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-26T09:24:00-05:00",
        "Feb 26, 2025",
        "Not external yet. Internal SLA risk only if backlog keeps rising. I will update by noon.",
      ),
      sm(
        "to8",
        "Dan Smith",
        "Backend Engineer",
        "2025-02-26T10:03:00-05:00",
        "Feb 26, 2025",
        "dedupe lock live. duplicate creation down. queue should normalize within 40 minutes",
      ),
      sm(
        "to9",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-26T10:46:00-05:00",
        "Feb 26, 2025",
        "Confirmed queue recovery. Please link this in post-mortem for CAS 503 incident if that resurfaces.",
      ),
    ],
  },
  {
    id: "slack-tfsa-overcontribution-2025-01",
    type: "slack",
    title: "TFSA over-contribution discovered mid-transfer",
    channel: "compliance-reviews",
    messages: [
      sm(
        "oc1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-01-16T11:08:00-05:00",
        "Jan 16, 2025",
        "Need compliance guidance on active transfer. During pre-close check we detected likely TFSA over-contribution. Queue currently paused at final authorization.",
      ),
      sm(
        "oc2",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-01-16T11:10:00-05:00",
        "Jan 16, 2025",
        "I thought over-contribution is only checked at account opening, not transfer stage. Did I miss a step in the runbook?",
      ),
      sm(
        "oc3",
        "Marcus T.",
        "Compliance Analyst",
        "2025-01-16T11:16:00-05:00",
        "Jan 16, 2025",
        "It can surface at transfer stage if incoming year-to-date contribution data differs from account-side assumptions. CRA reporting obligations apply before completion.",
      ),
      sm(
        "oc4",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-01-16T11:19:00-05:00",
        "Jan 16, 2025",
        "Thank you. I will hold the transfer in queue and open COMP-299 for documented handling.",
      ),
      sm(
        "oc5",
        "Raj Khoury",
        "Engineering Manager",
        "2025-01-16T11:22:00-05:00",
        "Jan 16, 2025",
        "Need owner and ETA.",
      ),
      sm(
        "oc6",
        "Marcus T.",
        "Compliance Analyst",
        "2025-01-16T11:29:00-05:00",
        "Jan 16, 2025",
        "Owner: compliance + ops jointly. ETA depends on CRA reporting packet prep, likely T+2 business days.",
      ),
      sm(
        "oc7",
        "Elena Vasquez",
        "Head of Compliance",
        "2025-01-16T11:34:00-05:00",
        "Jan 16, 2025",
        "Pause transfer. File CRA report first. Do not proceed until Marcus signs completion note.",
      ),
      sm(
        "oc8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-01-16T11:41:00-05:00",
        "Jan 16, 2025",
        "Understood. Transfer paused and queue note updated with explicit approval gate.",
      ),
    ],
  },
  {
    id: "slack-aml-loop-2025-05",
    type: "slack",
    title: "AML flagged account stuck between ops and compliance with unclear owner",
    channel: "compliance-reviews",
    messages: [
      sm(
        "aml1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-05-06T09:03:00-04:00",
        "May 06, 2025",
        "Escalating: transfer request for account with Reg flags has bounced between queue states for two days. Ops marks compliance hold, compliance marks ops follow-up, and no one owns final decision.",
      ),
      sm(
        "aml2",
        "Marcus T.",
        "Compliance Analyst",
        "2025-05-06T09:09:00-04:00",
        "May 06, 2025",
        "Agreed this is an ownership gap. Current workflow did not define terminal owner when AML review is inconclusive and transfer deadline is near.",
      ),
      sm(
        "aml3",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-05-06T09:11:00-04:00",
        "May 06, 2025",
        "I kept assigning it back because the queue instruction says compliance final, but then I got a note saying ops to gather docs. Sorry if that made the loop worse.",
      ),
      sm(
        "aml4",
        "Raj Khoury",
        "Engineering Manager",
        "2025-05-06T09:14:00-04:00",
        "May 06, 2025",
        "Who owns final yes/no right now",
      ),
      sm(
        "aml5",
        "Marcus T.",
        "Compliance Analyst",
        "2025-05-06T09:18:00-04:00",
        "May 06, 2025",
        "At this moment, no formally assigned owner. That is the defect. I am opening COMP-344 and documenting interim rule: compliance owns terminal decision when AML status is unresolved at T+2.",
      ),
      sm(
        "aml6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-05-06T09:22:00-04:00",
        "May 06, 2025",
        "Thank you. That gives queue operators clear routing.",
      ),
      sm(
        "aml7",
        "Elena Vasquez",
        "Head of Compliance",
        "2025-05-06T09:28:00-04:00",
        "May 06, 2025",
        "Effective immediately: compliance is terminal owner for AML-loop transfers. Document in runbook and audit all looped cases from last 30 days.",
      ),
      sm(
        "aml8",
        "Marcus T.",
        "Compliance Analyst",
        "2025-05-06T09:31:00-04:00",
        "May 06, 2025",
        "Acknowledged. I will post formal language in incident-postmortems and ticket comments for traceability.",
      ),
      sm(
        "aml9",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-05-06T10:02:00-04:00",
        "May 06, 2025",
        "Loop stopped for current case after ownership rule was applied. Keeping thread open until the historical audit completes.",
      ),
    ],
  },
  {
    id: "slack-fhsa-reg-path-2024-03",
    type: "slack",
    title: "FHSA transfers initially handled with TFSA pathway before process existed",
    channel: "ops-general",
    messages: [
      sm(
        "fh1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-03-19T09:25:00-04:00",
        "Mar 19, 2024",
        "Flagging documentation gap: FHSA transfer came in and the queue defaulted to TFSA resolution path because we have no FHSA-specific runbook yet.",
      ),
      sm(
        "fh2",
        "Dan Smith",
        "Backend Engineer",
        "2024-03-19T09:31:00-04:00",
        "Mar 19, 2024",
        "bridge passes account type as generic registered if CAS doesn't send explicit class. that's part of why ops got TFSA guidance",
      ),
      sm(
        "fh3",
        "Marcus T.",
        "Compliance Analyst",
        "2024-03-19T09:37:00-04:00",
        "Mar 19, 2024",
        "FHSA should not be treated as TFSA for reporting or contribution handling. Different framework under Income Tax Act amendments from 2023. Please avoid applying TFSA wording.",
      ),
      sm(
        "fh4",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-03-19T09:42:00-04:00",
        "Mar 19, 2024",
        "Understood. For today I will process manually with compliance check. Filing OPS-620 so this does not stay tribal knowledge.",
      ),
      sm(
        "fh5",
        "Raj Khoury",
        "Engineering Manager",
        "2024-03-19T09:50:00-04:00",
        "Mar 19, 2024",
        "Need owner for permanent docs and queue labels.",
      ),
      sm(
        "fh6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-03-19T10:04:00-04:00",
        "Mar 19, 2024",
        "I can draft interim notes, but this needs an official runbook and training pass.",
      ),
      sm(
        "fh7",
        "Marcus T.",
        "Compliance Analyst",
        "2024-03-19T10:16:00-04:00",
        "Mar 19, 2024",
        "I will provide required compliance language for the runbook once engineering confirms account-type mapping behavior.",
      ),
      sm(
        "fh8",
        "Dan Smith",
        "Backend Engineer",
        "2024-03-19T10:21:00-04:00",
        "Mar 19, 2024",
        "i'll add explicit fhsa enum through bridge this sprint but docs still needed",
      ),
    ],
  },
  {
    id: "slack-w8ben-etf-2024-07",
    type: "slack",
    title: "US-listed ETF transfer blocked by missing W-8BEN recertification workflow",
    channel: "compliance-reviews",
    messages: [
      sm(
        "w81",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-07-22T09:02:00-04:00",
        "Jul 22, 2024",
        "Transfer of US-listed ETF is blocked. Queue says documentation incomplete but does not name which one. Agent suspects W-8BEN expiry.",
      ),
      sm(
        "w82",
        "Marcus T.",
        "Compliance Analyst",
        "2024-07-22T09:09:00-04:00",
        "Jul 22, 2024",
        "Likely correct. W-8BEN recertification is required for specific cross-border holdings. We do not currently have a clear ops pathway in the queue tooling.",
      ),
      sm(
        "w83",
        "Dan Smith",
        "Backend Engineer",
        "2024-07-22T09:12:00-04:00",
        "Jul 22, 2024",
        "validator just surfaces doc_required=true from CAS. no mapping for which doc. that's on me from earlier shortcut",
      ),
      sm(
        "w84",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-07-22T09:21:00-04:00",
        "Jul 22, 2024",
        "Thanks for confirming. I am opening COMP-255. We need both system mapping and operator instructions.",
      ),
      sm(
        "w85",
        "Marcus T.",
        "Compliance Analyst",
        "2024-07-22T09:28:00-04:00",
        "Jul 22, 2024",
        "Please include reference to IRS Form W-8BEN renewal requirements and internal control COM-INTL-12 in the ticket.",
      ),
      sm(
        "w86",
        "Raj Khoury",
        "Engineering Manager",
        "2024-07-22T09:36:00-04:00",
        "Jul 22, 2024",
        "Prioritize. we keep tripping on hidden doc requirements.",
      ),
      sm(
        "w87",
        "Dan Smith",
        "Backend Engineer",
        "2024-07-22T10:02:00-04:00",
        "Jul 22, 2024",
        "mapping patch ready. queue will explicitly show W-8BEN recert required and route to compliance review lane",
      ),
      sm(
        "w88",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-07-22T10:33:00-04:00",
        "Jul 22, 2024",
        "Confirmed new label appears in queue. This is much clearer for ops.",
      ),
    ],
  },
  {
    id: "slack-rounding-penny-2023-11",
    type: "slack",
    title: "End-of-day reconciliation found 0.01 discrepancy on transfer FX conversion",
    channel: "ops-transfers-incidents",
    messages: [
      sm(
        "rd1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2023-11-08T16:04:00-05:00",
        "Nov 08, 2023",
        "EOD reconciliation found a one-cent discrepancy between the ledger and custodian settlement file on a CAD/USD transfer conversion.",
      ),
      sm(
        "rd2",
        "Dan Smith",
        "Backend Engineer",
        "2023-11-08T16:07:00-05:00",
        "Nov 08, 2023",
        "is this rounded in ledger at 4dp and custodian at 6dp again",
      ),
      sm(
        "rd3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2023-11-08T16:09:00-05:00",
        "Nov 08, 2023",
        "Exactly that from what I can see. The queue entry looked normal, mismatch appeared only at reconciliation stage.",
      ),
      sm(
        "rd4",
        "Dan Smith",
        "Backend Engineer",
        "2023-11-08T16:15:00-05:00",
        "Nov 08, 2023",
        "opening LED-188. this is not user-visible but audit-visible and annoying",
      ),
      sm(
        "rd5",
        "Raj Khoury",
        "Engineering Manager",
        "2023-11-08T16:22:00-05:00",
        "Nov 08, 2023",
        "Can we fix before quarter close",
      ),
      sm(
        "rd6",
        "Dan Smith",
        "Backend Engineer",
        "2023-11-08T16:26:00-05:00",
        "Nov 08, 2023",
        "yes. adding consistent rounding mode and explicit fx_precision field in bridge payload",
      ),
      sm(
        "rd7",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2023-11-08T16:41:00-05:00",
        "Nov 08, 2023",
        "Please include accounting sign-off in the ticket. Audit always asks for who approved the penny write-off logic.",
      ),
      sm(
        "rd8",
        "Dan Smith",
        "Backend Engineer",
        "2023-11-08T16:55:00-05:00",
        "Nov 08, 2023",
        "done. shipping in tonight maintenance",
      ),
    ],
  },
  {
    id: "slack-fat-finger-ledger-2024-06",
    type: "slack",
    title: "Manual ledger update applied to wrong account",
    channel: "ops-general",
    messages: [
      sm(
        "ff1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-06-11T09:11:00-04:00",
        "Jun 11, 2024",
        "Audit found a manual ledger adjustment from Sunday applied to the wrong account ID. Discovered during routine morning controls.",
      ),
      sm(
        "ff2",
        "Raj Khoury",
        "Engineering Manager",
        "2024-06-11T09:14:00-04:00",
        "Jun 11, 2024",
        "Customer impact",
      ),
      sm(
        "ff3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-06-11T09:16:00-04:00",
        "Jun 11, 2024",
        "No external impact yet. Caught before transfer final settlement, but this was a real fat finger in ledger tooling.",
      ),
      sm(
        "ff4",
        "Dan Smith",
        "Backend Engineer",
        "2024-06-11T09:24:00-04:00",
        "Jun 11, 2024",
        "ledger tool lacks confirm screen with account nickname. it's raw accountId and easy to miss",
      ),
      sm(
        "ff5",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-06-11T09:31:00-04:00",
        "Jun 11, 2024",
        "I filed LED-241. Also adding dual-review requirement for manual ledger edits above threshold until tooling is fixed.",
      ),
      sm(
        "ff6",
        "Marcus T.",
        "Compliance Analyst",
        "2024-06-11T09:39:00-04:00",
        "Jun 11, 2024",
        "Please retain both the incorrect and corrected values in audit trail. We need explicit history for supervisory review.",
      ),
      sm(
        "ff7",
        "Dan Smith",
        "Backend Engineer",
        "2024-06-11T09:57:00-04:00",
        "Jun 11, 2024",
        "adding confirmation modal + account name + last 4 display. low effort patch",
      ),
      sm(
        "ff8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-06-11T10:19:00-04:00",
        "Jun 11, 2024",
        "Thank you. Please link patch to LED-241; audit already requested evidence.",
      ),
    ],
  },
  {
    id: "slack-ledger-readonly-backlog-2025-04",
    type: "slack",
    title: "Ledger went read-only without ops notice, queue backlog exceeded 40 transfers",
    channel: "ops-transfers-incidents",
    messages: [
      sm(
        "lr1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-04-09T08:37:00-04:00",
        "Apr 09, 2025",
        "Heads up: ledger is read-only and ops did not get a maintenance notice. Queue has 43 transfers waiting for reconciliation write step.",
      ),
      sm(
        "lr2",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-04-09T08:41:00-04:00",
        "Apr 09, 2025",
        "I am checking platform events now. This might be a stale maintenance lock from overnight migration run.",
      ),
      sm(
        "lr3",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-04-09T08:43:00-04:00",
        "Apr 09, 2025",
        "Do we manually reorder queue once ledger is writable again or process first-in-first-out even if some are urgent RRSP closes?",
      ),
      sm(
        "lr4",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-04-09T08:45:00-04:00",
        "Apr 09, 2025",
        "Manual prioritization by deadline after lock clears. We have to protect same-day commitments first.",
      ),
      sm(
        "lr5",
        "Raj Khoury",
        "Engineering Manager",
        "2025-04-09T08:47:00-04:00",
        "Apr 09, 2025",
        "Need root cause + comms gap explanation.",
      ),
      sm(
        "lr6",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-04-09T09:01:00-04:00",
        "Apr 09, 2025",
        "Confirmed: maintenance lock stayed true after rollback path. No outbound notice fired because notifier subscribes to successful completion only. Opening LED-307.",
      ),
      sm(
        "lr7",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-04-09T09:26:00-04:00",
        "Apr 09, 2025",
        "Ledger writable again. Ops is running manual priority list and documenting any SLA risk.",
      ),
      sm(
        "lr8",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-04-09T09:43:00-04:00",
        "Apr 09, 2025",
        "Adding explicit read-only broadcast to ops-general and queue banner next maintenance event.",
      ),
      sm(
        "lr9",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-04-09T10:18:00-04:00",
        "Apr 09, 2025",
        "Thanks. Please include this in post-mortem with exact backlog count and time to recovery.",
      ),
    ],
  },
  {
    id: "slack-validator-hyphen-regex-2023-06",
    type: "slack",
    title: "Validator rejects account holder names with hyphens due to regex bug",
    channel: "eng-transfer-infra",
    messages: [
      sm(
        "hy1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2023-06-13T09:08:00-04:00",
        "Jun 13, 2023",
        "Reporting transfer rejects where account holder surname includes a hyphen. Queue shows generic invalid name token.",
      ),
      sm(
        "hy2",
        "Dan Smith",
        "Backend Engineer",
        "2023-06-13T09:14:00-04:00",
        "Jun 13, 2023",
        "validator regex probably strips punctuation and then length check fails. looking",
      ),
      sm(
        "hy3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2023-06-13T09:18:00-04:00",
        "Jun 13, 2023",
        "The account is perfectly valid in OMS and CAS. Only validator blocks it.",
      ),
      sm(
        "hy4",
        "Dan Smith",
        "Backend Engineer",
        "2023-06-13T09:26:00-04:00",
        "Jun 13, 2023",
        "yep regex only allows A-Z and spaces. no hyphen no apostrophe. filing VAL-101",
      ),
      sm(
        "hy5",
        "Raj Khoury",
        "Engineering Manager",
        "2023-06-13T09:31:00-04:00",
        "Jun 13, 2023",
        "Patch quickly and add tests for non-trivial names.",
      ),
      sm(
        "hy6",
        "Dan Smith",
        "Backend Engineer",
        "2023-06-13T09:44:00-04:00",
        "Jun 13, 2023",
        "patched. validator now accepts hyphen and apostrophe and normalizes unicode dash variants",
      ),
      sm(
        "hy7",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2023-06-13T10:02:00-04:00",
        "Jun 13, 2023",
        "Retried failed cases, all passed. Closing operational incident once ticket links are complete.",
      ),
      sm(
        "hy8",
        "Dan Smith",
        "Backend Engineer",
        "2023-06-13T10:09:00-04:00",
        "Jun 13, 2023",
        "this service needs better error messages, noted in VAL-101",
      ),
    ],
  },
  {
    id: "slack-validator-whitelist-2024-10",
    type: "slack",
    title: "Quarterly securities refresh missed validator whitelist updates",
    channel: "eng-transfer-infra",
    messages: [
      sm(
        "wl1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-10-07T08:58:00-04:00",
        "Oct 07, 2024",
        "Queue is rejecting legitimate transfers as unknown CUSIP since Friday night. Appears to start right after quarterly security refresh window.",
      ),
      sm(
        "wl2",
        "Dan Smith",
        "Backend Engineer",
        "2024-10-07T09:04:00-04:00",
        "Oct 07, 2024",
        "validator whitelist job failed silently. list stayed stale for three days. good catch",
      ),
      sm(
        "wl3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-10-07T09:05:00-04:00",
        "Oct 07, 2024",
        "This hit a lot of normal transfers, not edge cases. Analysts thought it was bad account data.",
      ),
      sm(
        "wl4",
        "Dan Smith",
        "Backend Engineer",
        "2024-10-07T09:14:00-04:00",
        "Oct 07, 2024",
        "opening VAL-233. root issue is refresh cron exits non-zero but monitor only checks runtime, not completion state",
      ),
      sm(
        "wl5",
        "Raj Khoury",
        "Engineering Manager",
        "2024-10-07T09:18:00-04:00",
        "Oct 07, 2024",
        "How many rejects and how long until clear",
      ),
      sm(
        "wl6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-10-07T09:22:00-04:00",
        "Oct 07, 2024",
        "112 rejected since Friday. Once whitelist refresh is fixed we can bulk requeue.",
      ),
      sm(
        "wl7",
        "Dan Smith",
        "Backend Engineer",
        "2024-10-07T09:39:00-04:00",
        "Oct 07, 2024",
        "manual refresh completed. validator now accepts current quarterly list",
      ),
      sm(
        "wl8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-10-07T10:07:00-04:00",
        "Oct 07, 2024",
        "Bulk requeue done. Will need post-mortem because this looked like broad transfer corruption for a while.",
      ),
      sm(
        "wl9",
        "Dan Smith",
        "Backend Engineer",
        "2024-10-07T10:14:00-04:00",
        "Oct 07, 2024",
        "adding hard alert when whitelist age > 24h",
      ),
    ],
  },
  {
    id: "slack-validator-50-positions-timeout-2025-03",
    type: "slack",
    title: "Validator times out on large accounts and returns generic error",
    channel: "eng-transfer-infra",
    messages: [
      sm(
        "lg1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-11T09:06:00-05:00",
        "Mar 11, 2025",
        "Seeing generic validator_error for high-net-worth accounts with many holdings. Pattern appears on accounts with long position lists.",
      ),
      sm(
        "lg2",
        "Dan Smith",
        "Backend Engineer",
        "2025-03-11T09:12:00-05:00",
        "Mar 11, 2025",
        "how many positions in failures",
      ),
      sm(
        "lg3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-11T09:13:00-05:00",
        "Mar 11, 2025",
        "Mostly 50+ holdings. Smaller accounts pass.",
      ),
      sm(
        "lg4",
        "Dan Smith",
        "Backend Engineer",
        "2025-03-11T09:21:00-05:00",
        "Mar 11, 2025",
        "validator has O(n^2) comparison in legacy holdings path. timeout swallowed and mapped to generic error. filing VAL-267",
      ),
      sm(
        "lg5",
        "Raj Khoury",
        "Engineering Manager",
        "2025-03-11T09:24:00-05:00",
        "Mar 11, 2025",
        "Can we hotfix before RRSP cutoff",
      ),
      sm(
        "lg6",
        "Dan Smith",
        "Backend Engineer",
        "2025-03-11T09:31:00-05:00",
        "Mar 11, 2025",
        "not safely today. short-term queue workaround: route 50+ positions to manual precheck lane",
      ),
      sm(
        "lg7",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-11T09:41:00-05:00",
        "Mar 11, 2025",
        "Applying manual lane now. This is painful but better than silent failures.",
      ),
      sm(
        "lg8",
        "Dan Smith",
        "Backend Engineer",
        "2025-03-11T10:02:00-05:00",
        "Mar 11, 2025",
        "added explicit timeout reason in error payload so ops can distinguish from data issue",
      ),
      sm(
        "lg9",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-11T10:18:00-05:00",
        "Mar 11, 2025",
        "Thank you. Keeping incident open until permanent optimization lands.",
      ),
    ],
  },
  {
    id: "slack-fhsa-procedure-missed-2024-05",
    type: "slack",
    title: "FHSA procedure was shared only in Slack and missed by most of ops",
    channel: "ops-general",
    messages: [
      sm(
        "fp1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-05-28T09:03:00-04:00",
        "May 28, 2024",
        "I am noticing inconsistent FHSA handling across shifts. The updated procedure appears to have been posted only in a thread and never moved into formal docs.",
      ),
      sm(
        "fp2",
        "Dan Smith",
        "Backend Engineer",
        "2024-05-28T09:09:00-04:00",
        "May 28, 2024",
        "i dropped implementation notes in thread but assumed docs team picked it up. maybe not",
      ),
      sm(
        "fp3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-05-28T09:12:00-04:00",
        "May 28, 2024",
        "They did not. We have analysts applying TFSA steps to FHSA for almost two months now.",
      ),
      sm(
        "fp4",
        "Marcus T.",
        "Compliance Analyst",
        "2024-05-28T09:17:00-04:00",
        "May 28, 2024",
        "This requires immediate correction. FHSA and TFSA pathways have distinct requirements and should not be merged in operator instructions.",
      ),
      sm(
        "fp5",
        "Raj Khoury",
        "Engineering Manager",
        "2024-05-28T09:22:00-04:00",
        "May 28, 2024",
        "Open a ticket and assign owner for actual documentation, not thread notes.",
      ),
      sm(
        "fp6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-05-28T09:29:00-04:00",
        "May 28, 2024",
        "Opening OPS-673 and an incident-postmortem entry. We need to track where process updates live.",
      ),
      sm(
        "fp7",
        "Dan Smith",
        "Backend Engineer",
        "2024-05-28T09:41:00-04:00",
        "May 28, 2024",
        "understood. i'll stop posting process-critical updates only in channel threads",
      ),
      sm(
        "fp8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-05-28T10:02:00-04:00",
        "May 28, 2024",
        "Interim checklist is pinned in this channel for now until formal runbook exists.",
      ),
    ],
  },
  {
    id: "slack-priya-outdated-doc-2025-01",
    type: "slack",
    title: "Priya followed superseded Confluence path and escalated a routine case",
    channel: "ops-general",
    messages: [
      sm(
        "po1",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-01-29T09:18:00-05:00",
        "Jan 29, 2025",
        "I escalated OPS-911 to compliance because the old Confluence page said all FHSA transfers with account type ambiguity need full legal review.",
      ),
      sm(
        "po2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-01-29T09:22:00-05:00",
        "Jan 29, 2025",
        "Thank you for flagging. That Confluence page is superseded and should have been archived. This case was routine and did not need escalation.",
      ),
      sm(
        "po3",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-01-29T09:24:00-05:00",
        "Jan 29, 2025",
        "Understood. Sorry, I searched FHSA transfer and that page was still first result.",
      ),
      sm(
        "po4",
        "Marcus T.",
        "Compliance Analyst",
        "2025-01-29T09:31:00-05:00",
        "Jan 29, 2025",
        "No issue with the question. The documentation gap is the problem. Please include this in OPS-911 so we can address source-of-truth controls.",
      ),
      sm(
        "po5",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-01-29T09:38:00-05:00",
        "Jan 29, 2025",
        "Also adding note that this feels like the validator whitelist incident in October: stale supporting data made normal work look broken.",
      ),
      sm(
        "po6",
        "Raj Khoury",
        "Engineering Manager",
        "2025-01-29T09:43:00-05:00",
        "Jan 29, 2025",
        "Good catch. make sure docs cleanup has an owner and due date.",
      ),
      sm(
        "po7",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-01-29T10:01:00-05:00",
        "Jan 29, 2025",
        "I can help with doc inventory if someone reviews before publish.",
      ),
      sm(
        "po8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-01-29T10:05:00-05:00",
        "Jan 29, 2025",
        "Appreciated. We will pair on it. I am marking the outdated page deprecated right now.",
      ),
    ],
  },
  {
    id: "slack-unauthorized-operator-2025-02",
    type: "slack",
    title: "Transfer authorized by operator without required permission level",
    channel: "compliance-reviews",
    messages: [
      sm(
        "ua1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-19T09:05:00-05:00",
        "Feb 19, 2025",
        "Audit found a transfer marked authorized by an operator lacking final-approval permission level. Detected one week after completion.",
      ),
      sm(
        "ua2",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-02-19T09:07:00-05:00",
        "Feb 19, 2025",
        "Was this because of role mismatch in IAM or because someone used shared workstation session?",
      ),
      sm(
        "ua3",
        "Marcus T.",
        "Compliance Analyst",
        "2025-02-19T09:14:00-05:00",
        "Feb 19, 2025",
        "Initial evidence suggests permission cache was stale in queue UI. Regardless, the authorization record is invalid and must be remediated under control policy OPS-CONTROL-7.",
      ),
      sm(
        "ua4",
        "Raj Khoury",
        "Engineering Manager",
        "2025-02-19T09:18:00-05:00",
        "Feb 19, 2025",
        "Severity",
      ),
      sm(
        "ua5",
        "Marcus T.",
        "Compliance Analyst",
        "2025-02-19T09:20:00-05:00",
        "Feb 19, 2025",
        "High internal control severity, low customer impact. Opened COMP-331.",
      ),
      sm(
        "ua6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-19T09:28:00-05:00",
        "Feb 19, 2025",
        "Ops is re-validating all authorizations from the same week and documenting affected tickets.",
      ),
      sm(
        "ua7",
        "Marcus T.",
        "Compliance Analyst",
        "2025-02-19T09:34:00-05:00",
        "Feb 19, 2025",
        "Please include explicit statement of no unauthorized fund movement in the remediation report.",
      ),
      sm(
        "ua8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-19T10:02:00-05:00",
        "Feb 19, 2025",
        "Will do. We confirmed process breach only, no incorrect transfer outcomes.",
      ),
    ],
  },
  {
    id: "slack-eoq-manual-review-sla-2025-03",
    type: "slack",
    title: "End-of-quarter volume surge overwhelmed manual review queue",
    channel: "incident-postmortems",
    messages: [
      sm(
        "eq1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-28T16:07:00-04:00",
        "Mar 28, 2025",
        "Formal incident record: manual review queue breached SLA at 15:40 ET. We had 287 items waiting, mostly compliance-adjacent transfer exceptions.",
      ),
      sm(
        "eq2",
        "Raj Khoury",
        "Engineering Manager",
        "2025-03-28T16:10:00-04:00",
        "Mar 28, 2025",
        "Need action plan by Monday.",
      ),
      sm(
        "eq3",
        "Marcus T.",
        "Compliance Analyst",
        "2025-03-28T16:14:00-04:00",
        "Mar 28, 2025",
        "Compliance review lane reached 4.5x normal volume. We reassigned analysts but bottleneck persisted due to unclear pre-screening criteria.",
      ),
      sm(
        "eq4",
        "Raj Khoury",
        "Engineering Manager",
        "2025-03-28T16:22:00-04:00",
        "Mar 28, 2025",
        "Queue metrics show 38 percent of manual reviews were low-risk and could have been auto-routed with better validator confidence thresholds.",
      ),
      sm(
        "eq5",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-28T16:27:00-04:00",
        "Mar 28, 2025",
        "Opening OPS-940. We need both staffing plan and system triage improvements before next quarter close.",
      ),
      sm(
        "eq6",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-03-28T16:31:00-04:00",
        "Mar 28, 2025",
        "I noticed we spent time on tickets that looked almost identical to resolved ones but no one trusted auto-links. Could retrieval have helped here?",
      ),
      sm(
        "eq7",
        "Raj Khoury",
        "Engineering Manager",
        "2025-03-28T16:34:00-04:00",
        "Mar 28, 2025",
        "Yes. include in postmortem recommendation.",
      ),
      sm(
        "eq8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-28T16:46:00-04:00",
        "Mar 28, 2025",
        "Incident closed at 16:44 with temporary overtime coverage. Post-mortem due next week.",
      ),
    ],
  },
  {
    id: "slack-queue-backup-memory-2024-02",
    type: "slack",
    title: "Historical queue backup incident used as reference in later CAS failures",
    channel: "ops-transfers-incidents",
    messages: [
      sm(
        "qb1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-02-13T09:01:00-05:00",
        "Feb 13, 2024",
        "Queue latency jumped from seconds to minutes and individual transfers looked broken in the UI. Posting for record because this pattern is hard to spot live.",
      ),
      sm(
        "qb2",
        "Dan Smith",
        "Backend Engineer",
        "2024-02-13T09:07:00-05:00",
        "Feb 13, 2024",
        "not individual transfer failures. CAS timeout wave + retry storm filled worker pool",
      ),
      sm(
        "qb3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-02-13T09:10:00-05:00",
        "Feb 13, 2024",
        "That distinction is important. Ops triage treated this as account-level defects for the first 20 minutes.",
      ),
      sm(
        "qb4",
        "Dan Smith",
        "Backend Engineer",
        "2024-02-13T09:21:00-05:00",
        "Feb 13, 2024",
        "opening INFRA-392 historical ticket so we can link next time it happens",
      ),
      sm(
        "qb5",
        "Raj Khoury",
        "Engineering Manager",
        "2024-02-13T09:33:00-05:00",
        "Feb 13, 2024",
        "Please capture dashboard signal for queue-level incident vs ticket-level incident.",
      ),
      sm(
        "qb6",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-02-13T09:49:00-05:00",
        "Feb 13, 2024",
        "Will document in postmortem notes. This one will absolutely repeat during RRSP season.",
      ),
      sm(
        "qb7",
        "Dan Smith",
        "Backend Engineer",
        "2024-02-13T10:14:00-05:00",
        "Feb 13, 2024",
        "stabilized by lowering retry concurrency. long-term fix still pending",
      ),
      sm(
        "qb8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-02-13T10:31:00-05:00",
        "Feb 13, 2024",
        "Incident resolved. Linking this thread in INFRA-392 for future reference.",
      ),
    ],
  },
  {
    id: "slack-validator-logic-question-2025-04",
    type: "slack",
    title: "Post-Dan handover gap: nobody fully understands legacy validator branch",
    channel: "eng-transfer-infra",
    messages: [
      sm(
        "vq1",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-04-17T09:13:00-04:00",
        "Apr 17, 2025",
        "Question for anyone with history: why does validator short-circuit to legacy holdings path when account has both DRIP and corporate action markers? I cannot find design notes.",
      ),
      sm(
        "vq2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-04-17T09:18:00-04:00",
        "Apr 17, 2025",
        "Dan used to explain that branch when we escalated weird cases, but I do not have written context beyond old Jira comments.",
      ),
      sm(
        "vq3",
        "Raj Khoury",
        "Engineering Manager",
        "2025-04-17T09:20:00-04:00",
        "Apr 17, 2025",
        "File a ticket and capture assumptions explicitly.",
      ),
      sm(
        "vq4",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-04-17T09:26:00-04:00",
        "Apr 17, 2025",
        "opening INFRA-602. immediate concern is branch can bypass newer dedupe guard from whitelist fix in October",
      ),
      sm(
        "vq5",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-04-17T09:31:00-04:00",
        "Apr 17, 2025",
        "This might explain why some queue items still look like old validator behavior even after newer patches.",
      ),
      sm(
        "vq6",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-04-17T10:02:00-04:00",
        "Apr 17, 2025",
        "yep. code comment literally says temporary for Q2 2023 and never removed",
      ),
      sm(
        "vq7",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-04-17T10:16:00-04:00",
        "Apr 17, 2025",
        "Please prioritize this. Ops has no confidence when behavior differs by hidden branch.",
      ),
      sm(
        "vq8",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-04-17T10:31:00-04:00",
        "Apr 17, 2025",
        "will do. drafting architecture note from tickets + postmortems since we do not have original rationale doc",
      ),
    ],
  },
  {
    id: "slack-doc-gap-followup-2025-06",
    type: "slack",
    title: "FHSA documentation ticket still open and causing repeated questions",
    channel: "ops-general",
    messages: [
      sm(
        "dg1",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-06-10T09:09:00-04:00",
        "Jun 10, 2025",
        "Following up: DOC-114 still shows open and people are still asking which FHSA path to use when account type from CAS is unclear.",
      ),
      sm(
        "dg2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-06-10T09:13:00-04:00",
        "Jun 10, 2025",
        "You are right. We have interim notes, but the canonical runbook is still not published and search results are messy.",
      ),
      sm(
        "dg3",
        "Marcus T.",
        "Compliance Analyst",
        "2025-06-10T09:16:00-04:00",
        "Jun 10, 2025",
        "Please keep using the interim checklist version dated 2025-02-03. Anything older can contain incorrect FHSA/TFSA classification guidance.",
      ),
      sm(
        "dg4",
        "Raj Khoury",
        "Engineering Manager",
        "2025-06-10T09:21:00-04:00",
        "Jun 10, 2025",
        "Who owns closing DOC-114",
      ),
      sm(
        "dg5",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-06-10T09:23:00-04:00",
        "Jun 10, 2025",
        "Assigned to Ops Enablement, but engineering notes are still pending from INFRA-602 to explain validator branch behavior.",
      ),
      sm(
        "dg6",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-06-10T09:34:00-04:00",
        "Jun 10, 2025",
        "I can provide technical appendix this week. still untangling legacy branch assumptions",
      ),
      sm(
        "dg7",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-06-10T09:42:00-04:00",
        "Jun 10, 2025",
        "Thanks. I keep seeing new hires ask in DM, so this would remove a lot of confusion.",
      ),
      sm(
        "dg8",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-06-10T10:01:00-04:00",
        "Jun 10, 2025",
        "Documenting this thread on DOC-114 as evidence that the gap is still active.",
      ),
    ],
  },
];

const CHANNEL_ARCHIVE_COUNTS: Record<SlackConversationArtifact["channel"], number> = {
  "ops-transfers-incidents": 240,
  "eng-transfer-infra": 220,
  "compliance-reviews": 200,
  "ops-general": 180,
  "incident-postmortems": 160,
};

const CHANNEL_SPECIALISTS: Record<SlackConversationArtifact["channel"], string[]> = {
  "ops-transfers-incidents": ["Liam O'Connell", "Nina Patel"],
  "eng-transfer-infra": ["Chloe Park", "Mateo Ruiz"],
  "compliance-reviews": ["Aisha Rahman", "Nina Patel"],
  "ops-general": ["Liam O'Connell", "Aisha Rahman"],
  "incident-postmortems": ["Chloe Park", "Nina Patel"],
};

for (const thread of slackArtifacts) {
  const participants = Array.from(
    new Set(
      [
        ...thread.messages.map((message) => message.sender).filter((sender) => sender !== "Elena Vasquez"),
        ...(CHANNEL_SPECIALISTS[thread.channel] ?? []),
      ],
    ),
  );
  const roleBySender = thread.messages.reduce<Record<string, string>>((acc, message) => {
    acc[message.sender] = message.role;
    return acc;
  }, {});
  let cursor = new Date(thread.messages[thread.messages.length - 1]?.timestamp ?? "2024-01-01T09:00:00Z");
  const extensionCount = CHANNEL_ARCHIVE_COUNTS[thread.channel];
  const generated: SlackMessage[] = [];

  for (let i = 0; i < extensionCount; i += 1) {
    const incrementMinutes = 9 + Math.floor(seedFloat(i + thread.id.length * 11) * 19);
    cursor = new Date(cursor.getTime() + incrementMinutes * 60 * 1000);
    const rawSpeaker = participants[i % participants.length] ?? "Sarah Jenkins";
    const normalizedSpeaker = normalizeSpeakerForTimeline(rawSpeaker, cursor.toISOString());
    const role = roleBySender[normalizedSpeaker] ?? PERSON_ROLE[normalizedSpeaker] ?? "Analyst";
    const messageId = `${thread.id}-x${String(i + 1).padStart(3, "0")}`;
    const timestamp = cursor.toISOString();
    generated.push(
      sm(
        messageId,
        normalizedSpeaker,
        role,
        timestamp,
        formatDateLabel(timestamp),
        buildArchiveBody(thread.id, thread.title, normalizedSpeaker, timestamp, i + 1),
      ),
    );
  }

  thread.messages.push(...generated);
}

// -----------------------------------------------------------------------------
// Jira Tickets
// -----------------------------------------------------------------------------

const jiraArtifacts: JiraArtifact[] = [
  {
    id: "jira-ops-8492",
    type: "jira",
    title: "ATON transfer failures post-Rogers/Shaw merger - CUSIP identifier change",
    ticketKey: "OPS-8492",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2024-11-18T10:04:00-05:00",
    resolvedAt: "2024-11-19T15:42:00-05:00",
    summary:
      "Inbound and outbound ATON transfers intermittently fail when payload still references legacy Shaw CUSIP while receiving institution has already migrated to post-merger identifier.",
    technicalDescription:
      "The validator accepts legacy identifiers from OMS at intake, but bridge completion compares against CAS active instrument map. During merger transition, identifier drift means handoff fails mid-flight. Temporary mitigation: manual ledger remap with compliance note. Permanent change: validate CUSIP freshness before queue admission and emit deterministic remediation path.",
    comments: [
      jc(
        "ops8492-c1",
        "Marcus T.",
        "Compliance Analyst",
        "2024-11-18T11:06:00-05:00",
        "Compliance sign-off approved for manual remap workflow if every case cites source merger event and mapping table version.",
      ),
      jc(
        "ops8492-c2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-11-19T09:37:00-05:00",
        "Confirmed impacted client account resolved after remap and retry. Queue backlog reduced to baseline.",
      ),
      jc(
        "ops8492-c3",
        "Dan Smith",
        "Backend Engineer",
        "2024-11-19T12:21:00-05:00",
        "Merged preflight check with bridge log marker CUSIP_MAP_DRIFT so ops can detect this without reading raw CAS payloads.",
      ),
    ],
  },
  {
    id: "jira-ops-7711",
    type: "jira",
    title: "Stock split fractional holdings rejected in TFSA transfer validator",
    ticketKey: "OPS-7711",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2024-08-14T09:49:00-04:00",
    resolvedAt: "2024-08-15T14:10:00-04:00",
    summary:
      "Post-split fractional positions were rejected by validator due to integer lot assumption on CAS handoff path.",
    technicalDescription:
      "When split marker exists, validator still applied integer-lot enforcement intended for legacy transfer path. For TFSA accounts with valid fractional holdings, this created false rejects. Updated logic checks split metadata and preserves fractional precision through bridge payload.",
    comments: [
      jc(
        "ops7711-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-08-14T10:55:00-04:00",
        "See Slack #ops-transfers-incidents Aug 14. Retry after canary patch cleared all sampled accounts.",
      ),
      jc(
        "ops7711-c2",
        "Dan Smith",
        "Backend Engineer",
        "2024-08-14T13:21:00-04:00",
        "Added test case with split-generated 0.25 position and DRIP disabled path.",
      ),
      jc(
        "ops7711-c3",
        "Marcus T.",
        "Compliance Analyst",
        "2024-08-14T14:02:00-04:00",
        "No compliance issue if holdings remain accurate and client disclosure avoids regulatory-stop wording.",
      ),
    ],
  },
  {
    id: "jira-ops-7826",
    type: "jira",
    title: "Delisted security during in-flight transfer breaks receiving ledger mapping",
    ticketKey: "OPS-7826",
    status: "Closed",
    owner: "Dan Smith",
    createdAt: "2024-10-03T09:40:00-04:00",
    resolvedAt: "2024-10-07T16:09:00-04:00",
    summary:
      "Security delisted mid-transfer; receiving ledger rejected completion due to stale market status at bridge finalize stage.",
    technicalDescription:
      "Bridge completion flow trusted CAS symbol state without fresh market-status validation. For delisting events between T0 and completion, payload remained technically valid but operationally un-executable. Case handled manually with client disclosure. Engineering patch deferred pending market-status API contract discussion.",
    comments: [
      jc(
        "ops7826-c1",
        "Dan Smith",
        "Backend Engineer",
        "2024-10-03T10:15:00-04:00",
        "Moved component from OMS to bridge. Original filing component was incorrect during rapid triage.",
      ),
      jc(
        "ops7826-c2",
        "Marcus T.",
        "Compliance Analyst",
        "2024-10-03T11:42:00-04:00",
        "Client communication language reviewed. Marking compliance expectation met.",
      ),
      jc(
        "ops7826-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2024-10-07T16:09:00-04:00",
        "Closing as operationally resolved with workaround. Long-term integration change tracked separately in INFRA-566.",
      ),
    ],
  },
  {
    id: "jira-ops-9033",
    type: "jira",
    title: "Validator rejects DRIP residual sub-penny positions",
    ticketKey: "OPS-9033",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2025-02-11T09:33:00-05:00",
    resolvedAt: "2025-02-12T13:18:00-05:00",
    summary:
      "Sub-penny position residuals from DRIP caused validator mismatch and generic transfer failure messaging.",
    technicalDescription:
      "Validator treated tiny residuals differently by leg type. Cash leg tolerance existed but position leg path still hard-rejected. Updated path normalizes DRIP residuals and emits explicit residual-handling instructions in queue.",
    comments: [
      jc(
        "ops9033-c1",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-02-11T10:31:00-05:00",
        "After applying residual adjustment note in ledger, transfer proceeded normally.",
      ),
      jc(
        "ops9033-c2",
        "Marcus T.",
        "Compliance Analyst",
        "2025-02-11T10:44:00-05:00",
        "No compliance hold required if residual treatment is documented and client holdings remain accurate.",
      ),
      jc(
        "ops9033-c3",
        "Dan Smith",
        "Backend Engineer",
        "2025-02-12T13:10:00-05:00",
        "Improved error message from validator_error to residual_position_mismatch with remediation hint.",
      ),
    ],
  },
  {
    id: "jira-infra-511",
    type: "jira",
    title: "CAS 503 burst causes queue-wide retry storm during peak transfer window",
    ticketKey: "INFRA-511",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2025-03-04T08:53:00-05:00",
    resolvedAt: "2025-03-05T17:12:00-05:00",
    summary:
      "CAS returned elevated 503 responses; bridge retries consumed worker capacity and made queue appear as many independent ticket failures.",
    technicalDescription:
      "Queue pipeline lacked adaptive backpressure. Retry fanout multiplied load under CAS 503 conditions, reducing effective throughput and delaying unrelated transfers. Temporary mitigation raised timeout and reduced retry fanout. Permanent work item proposes bounded retry budgets with queue-level health signals.",
    comments: [
      jc(
        "infra511-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-04T09:44:00-05:00",
        "Pattern looked almost identical to Feb 2024 queue backup (INFRA-392). Linking for retrieval context.",
      ),
      jc(
        "infra511-c2",
        "Marcus T.",
        "Compliance Analyst",
        "2025-03-04T10:02:00-05:00",
        "Ordering metadata preservation confirmed for delayed transfers, including those with existing Reg flags.",
      ),
      jc(
        "infra511-c3",
        "Dan Smith",
        "Backend Engineer",
        "2025-03-05T16:59:00-05:00",
        "Added queue-health signal cas_upstream_degraded to avoid misclassifying queue incidents as account-level defects.",
      ),
    ],
  },
  {
    id: "jira-infra-437",
    type: "jira",
    title: "Bridge retry path trims trailing zeros from CUSIP",
    ticketKey: "INFRA-437",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2024-09-12T09:40:00-04:00",
    resolvedAt: "2024-09-13T12:34:00-04:00",
    summary:
      "Sporadic CUSIP mismatch due to retry-specific normalization mutating zero-suffixed identifiers.",
    technicalDescription:
      "String cast in bridge retry path called numeric normalize utility, unintentionally dropping trailing zeros. Primary path unaffected, making issue appear non-reproducible. Added immutable identifier handling plus stage-level checksum tracing.",
    comments: [
      jc(
        "infra437-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-09-12T09:58:00-04:00",
        "See Slack #eng-transfer-infra Sep 12. This consumed several hours because one-time retries often passed.",
      ),
      jc(
        "infra437-c2",
        "Dan Smith",
        "Backend Engineer",
        "2024-09-12T10:20:00-04:00",
        "Regression tests added for zero-suffixed CUSIP plus repeated retry sequence.",
      ),
      jc(
        "infra437-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2024-09-13T12:34:00-04:00",
        "Resolved. Postmortem required due to prolonged diagnosis window.",
      ),
    ],
  },
  {
    id: "jira-infra-566",
    type: "jira",
    title: "Custodian schema drift: acctClass field breaks bridge account-type parser",
    ticketKey: "INFRA-566",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2024-12-09T09:23:00-05:00",
    resolvedAt: "2024-12-10T11:48:00-05:00",
    summary:
      "CAS began returning acctClass for subset of responses; bridge defaulted unknown mapping to TFSA and misrouted FHSA cases.",
    technicalDescription:
      "Parser assumed fixed schema. When acctClass appeared, fallback path forced TFSA classification and queue presented wrong resolution path. Added dual-field parser, strict unknown-type errors, and removed implicit TFSA default behavior.",
    comments: [
      jc(
        "infra566-c1",
        "Marcus T.",
        "Compliance Analyst",
        "2024-12-09T09:20:00-05:00",
        "Misclassification has compliance implications; FHSA and TFSA pathways are not interchangeable.",
      ),
      jc(
        "infra566-c2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-12-09T10:29:00-05:00",
        "Operational impact was immediate. Similar operator confusion to whitelist outage where defaults masked true issue.",
      ),
      jc(
        "infra566-c3",
        "Dan Smith",
        "Backend Engineer",
        "2024-12-10T11:40:00-05:00",
        "Added parser contract alert when new account-type keys appear without mapping.",
      ),
    ],
  },
  {
    id: "jira-infra-588",
    type: "jira",
    title: "RRSP season CAS timeouts creating duplicate transfer attempts",
    ticketKey: "INFRA-588",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2025-02-26T09:12:00-05:00",
    resolvedAt: "2025-02-27T18:02:00-05:00",
    summary:
      "Aggressive CAS timeout and weak dedupe keys caused duplicate transfer attempts during high RRSP volume.",
    technicalDescription:
      "Timeout at 1.5s was tuned for average load, not seasonal peaks. Retries generated new queue IDs before previous attempts settled, resulting in duplicate work and reconciliation risk. Added timeout profile by season and queue-key dedupe lock.",
    comments: [
      jc(
        "infra588-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-26T10:49:00-05:00",
        "Queue normalized after dedupe lock. Please link to CAS 503 incident for pattern similarity.",
      ),
      jc(
        "infra588-c2",
        "Marcus T.",
        "Compliance Analyst",
        "2025-02-26T11:22:00-05:00",
        "Confirmed one-transfer-final rule applied and duplicate attempts were reconciled.",
      ),
      jc(
        "infra588-c3",
        "Dan Smith",
        "Backend Engineer",
        "2025-02-27T17:55:00-05:00",
        "Documented seasonal timeout profile and added telemetry for duplicate-attempt ratio.",
      ),
    ],
  },
  {
    id: "jira-comp-299",
    type: "jira",
    title: "TFSA over-contribution discovered during transfer completion",
    ticketKey: "COMP-299",
    status: "Resolved",
    owner: "Marcus T.",
    createdAt: "2025-01-16T11:21:00-05:00",
    resolvedAt: "2025-01-21T14:05:00-05:00",
    summary:
      "Potential TFSA over-contribution detected mid-transfer required CRA reporting and explicit compliance sign-off before completion.",
    technicalDescription:
      "Queue workflow lacked explicit gate for over-contribution discovered after transfer start. Interim rule introduced: pause transfer, prepare CRA packet, obtain compliance completion note, then resume. Added metadata field overcontrib_review_state for auditability.",
    comments: [
      jc(
        "comp299-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-01-16T11:42:00-05:00",
        "Transfer paused in queue and routed to compliance lane. See Slack #compliance-reviews Jan 16.",
      ),
      jc(
        "comp299-c2",
        "Marcus T.",
        "Compliance Analyst",
        "2025-01-18T10:11:00-05:00",
        "CRA reporting packet submitted; awaiting confirmation before release.",
      ),
      jc(
        "comp299-c3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-01-21T14:01:00-05:00",
        "Release completed after compliance note attached. No queue regressions observed.",
      ),
    ],
  },
  {
    id: "jira-comp-344",
    type: "jira",
    title: "AML review loop between ops and compliance with no terminal owner",
    ticketKey: "COMP-344",
    status: "Open",
    owner: "Marcus T.",
    createdAt: "2025-05-06T09:18:00-04:00",
    resolvedAt: "2025-06-14T11:00:00-04:00",
    summary:
      "Accounts with AML Reg flags were bouncing between ops and compliance lanes due to missing ownership rule for inconclusive reviews.",
    technicalDescription:
      "Queue state machine supports compliance_hold and ops_followup but lacked terminal owner assignment when AML remains unresolved at deadline. Interim policy assigns compliance as terminal owner; long-term fix requires workflow ownership metadata and escalation timer.",
    comments: [
      jc(
        "comp344-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-05-06T10:03:00-04:00",
        "Immediate loop resolved after interim ownership rule. Historical cases still need audit.",
      ),
      jc(
        "comp344-c2",
        "Marcus T.",
        "Compliance Analyst",
        "2025-05-09T09:22:00-04:00",
        "Posting draft ownership matrix for review. Not closing ticket until workflow automation is complete.",
      ),
      jc(
        "comp344-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2025-06-14T11:00:00-04:00",
        "Keeping open. treat as control debt until automation ships.",
      ),
    ],
  },
  {
    id: "jira-ops-620",
    type: "jira",
    title: "FHSA transfer requests incorrectly routed through TFSA procedure",
    ticketKey: "OPS-620",
    status: "Resolved",
    owner: "Sarah Jenkins",
    createdAt: "2024-03-19T09:44:00-04:00",
    resolvedAt: "2024-04-02T16:32:00-04:00",
    summary:
      "Early FHSA transfers were triaged using TFSA process due to missing runbook and ambiguous account-type mapping from bridge.",
    technicalDescription:
      "Bridge mapped unknown registered accounts to TFSA by default while documentation had no FHSA-specific branch. Combined effect drove incorrect operator actions. Added explicit FHSA enum in bridge and interim compliance-reviewed checklist.",
    comments: [
      jc(
        "ops620-c1",
        "Marcus T.",
        "Compliance Analyst",
        "2024-03-19T10:18:00-04:00",
        "Confirmed regulatory distinction language for FHSA vs TFSA handling.",
      ),
      jc(
        "ops620-c2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-03-22T13:41:00-04:00",
        "Interim checklist deployed across shifts. Consistency improved immediately.",
      ),
      jc(
        "ops620-c3",
        "Dan Smith",
        "Backend Engineer",
        "2024-04-02T15:58:00-04:00",
        "Bridge enum update shipped. Closing this ticket; long-term docs follow-up moved to OPS-673 and DOC-114.",
      ),
    ],
  },
  {
    id: "jira-comp-255",
    type: "jira",
    title: "W-8BEN recertification path missing in transfer queue for US ETF",
    ticketKey: "COMP-255",
    status: "Resolved",
    owner: "Marcus T.",
    createdAt: "2024-07-22T09:24:00-04:00",
    resolvedAt: "2024-07-25T11:11:00-04:00",
    summary:
      "US-listed ETF transfer blocked by hidden documentation requirement and unclear queue guidance.",
    technicalDescription:
      "Queue surfaced generic doc_required flag with no document-specific mapping. Ops could not determine requirement origin and escalated broadly. Added W-8BEN explicit mapping and compliance lane routing.",
    comments: [
      jc(
        "comp255-c1",
        "Dan Smith",
        "Backend Engineer",
        "2024-07-22T10:05:00-04:00",
        "Updated validator error payload to include required_document_code.",
      ),
      jc(
        "comp255-c2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-07-22T10:34:00-04:00",
        "Queue now displays W-8BEN recert explicitly. Analyst confusion resolved.",
      ),
      jc(
        "comp255-c3",
        "Marcus T.",
        "Compliance Analyst",
        "2024-07-25T10:57:00-04:00",
        "Control COM-INTL-12 linked to workflow; closing.",
      ),
    ],
  },
  {
    id: "jira-led-188",
    type: "jira",
    title: "One-cent reconciliation discrepancy due to FX rounding mismatch",
    ticketKey: "LED-188",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2023-11-08T16:16:00-05:00",
    resolvedAt: "2023-11-09T08:42:00-05:00",
    summary:
      "Ledger and custodian applied different FX precision during transfer settlement, resulting in recurring $0.01 discrepancy.",
    technicalDescription:
      "Ledger rounded at 4 decimal places while custodian settlement feed used 6. Difference surfaced in EOD reconciliation only. Added explicit fx_precision field and unified rounding mode in bridge and ledger transform path.",
    comments: [
      jc(
        "led188-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2023-11-08T16:44:00-05:00",
        "Audit requested sign-off chain for penny-handling logic.",
      ),
      jc(
        "led188-c2",
        "Dan Smith",
        "Backend Engineer",
        "2023-11-08T18:01:00-05:00",
        "Patch in maintenance deploy. Added test matrix for CAD/USD conversion edge values.",
      ),
      jc(
        "led188-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2023-11-09T08:42:00-05:00",
        "Validated. Closing before quarter-close risk window.",
      ),
    ],
  },
  {
    id: "jira-led-241",
    type: "jira",
    title: "Manual ledger adjustment applied to wrong account",
    ticketKey: "LED-241",
    status: "Resolved",
    owner: "Sarah Jenkins",
    createdAt: "2024-06-11T09:33:00-04:00",
    resolvedAt: "2024-06-13T15:08:00-04:00",
    summary:
      "Operator fat-finger in ledger tooling updated incorrect account; discovered during routine controls two days later.",
    technicalDescription:
      "Manual ledger UI lacked account identity context and secondary confirmation. Implemented explicit account display, confirmation step, and dual-review rule for high-impact manual edits.",
    comments: [
      jc(
        "led241-c1",
        "Marcus T.",
        "Compliance Analyst",
        "2024-06-11T09:42:00-04:00",
        "Audit trail must retain incorrect and corrected values with operator identifiers.",
      ),
      jc(
        "led241-c2",
        "Dan Smith",
        "Backend Engineer",
        "2024-06-11T10:00:00-04:00",
        "UI confirmation modal shipped with account nickname + last-4 display.",
      ),
      jc(
        "led241-c3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-06-13T14:59:00-04:00",
        "Controls validated; closing with updated procedure note.",
      ),
    ],
  },
  {
    id: "jira-led-307",
    type: "jira",
    title: "Ledger read-only lock persisted after rollback; ops not notified",
    ticketKey: "LED-307",
    status: "Resolved",
    owner: "Dev Chatterjee",
    createdAt: "2025-04-09T09:03:00-04:00",
    resolvedAt: "2025-04-11T12:26:00-04:00",
    summary:
      "Read-only maintenance lock persisted unexpectedly and created transfer backlog due to missing ops notifications.",
    technicalDescription:
      "Rollback path left lock state true. Notification pipeline emitted only on successful completion events, so ops got no alert. Added read-only state broadcast events, queue banners, and rollback-specific notifier trigger.",
    comments: [
      jc(
        "led307-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-04-09T09:28:00-04:00",
        "Backlog peaked at 43 before lock cleared. Manual priority sorting required.",
      ),
      jc(
        "led307-c2",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-04-09T10:20:00-04:00",
        "Notifier updated to publish on rollback and failure states, not just success.",
      ),
      jc(
        "led307-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2025-04-11T12:26:00-04:00",
        "Resolved with postmortem follow-up required.",
      ),
    ],
  },
  {
    id: "jira-val-101",
    type: "jira",
    title: "Validator regex rejects hyphenated account holder names",
    ticketKey: "VAL-101",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2023-06-13T09:27:00-04:00",
    resolvedAt: "2023-06-13T12:18:00-04:00",
    summary:
      "Name validation regex excluded hyphens and apostrophes, blocking legitimate transfers.",
    technicalDescription:
      "Legacy regex accepted uppercase letters and spaces only. Production accounts with hyphenated surnames failed validator precheck despite valid data in OMS/CAS. Updated regex and added unicode dash normalization.",
    comments: [
      jc(
        "val101-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2023-06-13T10:04:00-04:00",
        "Ops retries passed after patch. Please keep better error reason than generic invalid token.",
      ),
      jc(
        "val101-c2",
        "Dan Smith",
        "Backend Engineer",
        "2023-06-13T10:26:00-04:00",
        "Added explicit reason code name_regex_disallowed_char.",
      ),
      jc(
        "val101-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2023-06-13T12:18:00-04:00",
        "Closed.",
      ),
    ],
  },
  {
    id: "jira-val-233",
    type: "jira",
    title: "Validator whitelist stale after quarterly securities refresh",
    ticketKey: "VAL-233",
    status: "Resolved",
    owner: "Dan Smith",
    createdAt: "2024-10-07T09:15:00-04:00",
    resolvedAt: "2024-10-08T13:07:00-04:00",
    summary:
      "Whitelist refresh task failed silently; legitimate CUSIPs rejected for multiple days.",
    technicalDescription:
      "Refresh cron non-zero exits were not treated as failures by monitor. Whitelist age exceeded expected window and validator continued with stale snapshot. Added whitelist age alert and completion-state monitoring.",
    comments: [
      jc(
        "val233-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-10-07T10:09:00-04:00",
        "Bulk requeue succeeded after manual refresh. Linking 112 impacted queue items.",
      ),
      jc(
        "val233-c2",
        "Dan Smith",
        "Backend Engineer",
        "2024-10-07T10:16:00-04:00",
        "Hard alert added when whitelist age exceeds 24h.",
      ),
      jc(
        "val233-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2024-10-08T13:07:00-04:00",
        "Resolved. Reference this incident in future validator regressions.",
      ),
    ],
  },
  {
    id: "jira-val-267",
    type: "jira",
    title: "Validator performance collapse on accounts with >50 positions",
    ticketKey: "VAL-267",
    status: "In Progress",
    owner: "Dan Smith",
    createdAt: "2025-03-11T09:23:00-05:00",
    resolvedAt: "2025-06-12T17:40:00-04:00",
    summary:
      "Large accounts trigger O(n^2) holdings comparison and time out; system returns generic error to queue.",
    technicalDescription:
      "Legacy validator path from 2023 performs quadratic cross-check and swallows timeout reason. Temporary mitigation routes large accounts to manual precheck lane. Permanent fix requires algorithm rewrite and better lineage documentation from pre-2025 implementation decisions.",
    comments: [
      jc(
        "val267-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-03-11T10:20:00-05:00",
        "Manual lane workaround reduced silent failures but increased operator load.",
      ),
      jc(
        "val267-c2",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-04-18T11:09:00-04:00",
        "I cannot find original rationale for legacy branch. Linking INFRA-602 for historical context recovery.",
      ),
      jc(
        "val267-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2025-06-12T17:40:00-04:00",
        "Leave in progress until algorithm replacement is production stable.",
      ),
    ],
  },
  {
    id: "jira-ops-673",
    type: "jira",
    title: "FHSA procedure updates distributed via Slack only",
    ticketKey: "OPS-673",
    status: "Resolved",
    owner: "Sarah Jenkins",
    createdAt: "2024-05-28T09:31:00-04:00",
    resolvedAt: "2024-06-06T14:44:00-04:00",
    summary:
      "Process-critical FHSA guidance existed in Slack thread but not formal documentation, leading to inconsistent transfer handling.",
    technicalDescription:
      "Knowledge distribution relied on ephemeral channel posts. Shift teams missing thread context applied outdated TFSA logic. Interim pinning helped, but root issue required runbook ownership model.",
    comments: [
      jc(
        "ops673-c1",
        "Marcus T.",
        "Compliance Analyst",
        "2024-05-28T09:39:00-04:00",
        "Compliance language provided for interim checklist pending formal documentation.",
      ),
      jc(
        "ops673-c2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-06-01T11:05:00-04:00",
        "Pinned checklist reduced inconsistency but does not replace canonical runbook.",
      ),
      jc(
        "ops673-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2024-06-06T14:44:00-04:00",
        "Resolved operationally. Long-term documentation ownership tracked in DOC-114.",
      ),
    ],
  },
  {
    id: "jira-ops-911",
    type: "jira",
    title: "Outdated Confluence path caused unnecessary FHSA escalation",
    ticketKey: "OPS-911",
    status: "Closed",
    owner: "Sarah Jenkins",
    createdAt: "2025-01-29T09:33:00-05:00",
    resolvedAt: "2025-01-30T16:07:00-05:00",
    summary:
      "Analyst followed superseded documentation and escalated routine transfer to compliance.",
    technicalDescription:
      "Deprecated Confluence page remained top search result and included pre-OPS-620 guidance. Case itself was routine. Ticket used to document knowledge-source failure and retire stale page.",
    comments: [
      jc(
        "ops911-c1",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-01-29T09:25:00-05:00",
        "I used the first search result and did not realize it was superseded.",
      ),
      jc(
        "ops911-c2",
        "Marcus T.",
        "Compliance Analyst",
        "2025-01-29T09:34:00-05:00",
        "No compliance breach. Root issue is stale documentation discoverability.",
      ),
      jc(
        "ops911-c3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-01-30T16:02:00-05:00",
        "Deprecated page removed from search and replaced with interim FHSA checklist link.",
      ),
    ],
  },
  {
    id: "jira-comp-331",
    type: "jira",
    title: "Unauthorized transfer approval due to stale permission cache",
    ticketKey: "COMP-331",
    status: "Resolved",
    owner: "Marcus T.",
    createdAt: "2025-02-19T09:21:00-05:00",
    resolvedAt: "2025-02-25T15:53:00-05:00",
    summary:
      "Transfer was authorized by operator lacking required permission level; discovered during weekly audit.",
    technicalDescription:
      "Queue UI cached authorization role state and did not re-validate at action time. Resulting audit defect had no customer fund impact but represented control failure. Added server-side permission check at authorization endpoint.",
    comments: [
      jc(
        "comp331-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-02-19T09:29:00-05:00",
        "Historical review found one affected authorization event only.",
      ),
      jc(
        "comp331-c2",
        "Marcus T.",
        "Compliance Analyst",
        "2025-02-20T10:02:00-05:00",
        "Remediation report confirms no unauthorized fund movement.",
      ),
      jc(
        "comp331-c3",
        "Dan Smith",
        "Backend Engineer",
        "2025-02-24T17:11:00-05:00",
        "Server-side permission validation now mandatory; UI cache can no longer bypass control.",
      ),
    ],
  },
  {
    id: "jira-ops-940",
    type: "jira",
    title: "End-of-quarter manual review queue SLA breach",
    ticketKey: "OPS-940",
    status: "Resolved",
    owner: "Sarah Jenkins",
    createdAt: "2025-03-28T16:30:00-04:00",
    resolvedAt: "2025-04-04T11:16:00-04:00",
    summary:
      "Manual review queue exceeded SLA due to volume spike and weak pre-screening, causing widespread transfer delays.",
    technicalDescription:
      "Quarter-end volume hit 4.5x baseline for compliance-adjacent transfers. Manual lane accepted low-risk items that could have been auto-routed, reducing throughput for truly complex cases. Temporary overtime resolved backlog; long-term capacity and triage changes required.",
    comments: [
      jc(
        "ops940-c1",
        "Marcus T.",
        "Compliance Analyst",
        "2025-03-28T16:40:00-04:00",
        "Compliance lane saturation was primary bottleneck; clearer pre-screening criteria needed.",
      ),
      jc(
        "ops940-c2",
        "Raj Khoury",
        "Engineering Manager",
        "2025-03-31T09:22:00-04:00",
        "Telemetry shows 38 percent of manual items were low-risk and should be auto-routed.",
      ),
      jc(
        "ops940-c3",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-04-04T11:13:00-04:00",
        "Backlog cleared and temporary staffing plan documented. Closing with postmortem actions open.",
      ),
    ],
  },
  {
    id: "jira-doc-114",
    type: "jira",
    title: "Publish canonical FHSA transfer runbook and retire stale docs",
    ticketKey: "DOC-114",
    status: "Open",
    owner: "Ops Enablement",
    createdAt: "2025-02-03T09:09:00-05:00",
    resolvedAt: "2025-06-20T10:00:00-04:00",
    summary:
      "Documentation source-of-truth for FHSA transfer handling remains unresolved despite repeated incidents.",
    technicalDescription:
      "Interim checklists exist, but no canonical runbook with engineering appendix and compliance language has been published. Search still surfaces deprecated content, driving repeated operator confusion. Blocked on historical validator branch rationale from INFRA-602.",
    comments: [
      jc(
        "doc114-c1",
        "Priya Nair",
        "Junior Ops Analyst",
        "2025-06-10T09:10:00-04:00",
        "Still seeing analysts ask the same FHSA routing question in DMs and channel.",
      ),
      jc(
        "doc114-c2",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-06-10T09:24:00-04:00",
        "Linking latest Slack follow-up thread as evidence the gap is active.",
      ),
      jc(
        "doc114-c3",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-06-12T16:49:00-04:00",
        "Will attach validator-branch technical appendix once INFRA-602 context recovery is complete.",
      ),
    ],
  },
  {
    id: "jira-infra-602",
    type: "jira",
    title: "Recover historical rationale for legacy validator branch behavior",
    ticketKey: "INFRA-602",
    status: "Open",
    owner: "Dev Chatterjee",
    createdAt: "2025-04-17T09:27:00-04:00",
    resolvedAt: "2025-06-19T17:20:00-04:00",
    summary:
      "Post-transition knowledge gap: legacy validator branch remains active but design intent is undocumented after team changes.",
    technicalDescription:
      "Current maintainers cannot justify branch conditions that bypass newer safeguards under mixed DRIP/corporate-action markers. Behavior intersects with VAL-267 and DOC-114 documentation blockers. Work includes code archaeology across old tickets, Slack threads, and postmortems.",
    comments: [
      jc(
        "infra602-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2025-04-17T09:40:00-04:00",
        "Operationally important. Queue behavior differs by hidden branch and confuses triage.",
      ),
      jc(
        "infra602-c2",
        "Dev Chatterjee",
        "Platform Engineer",
        "2025-05-08T14:15:00-04:00",
        "Found references in VAL-233 and OPS-8492 but no single design note. Creating interim architecture map.",
      ),
      jc(
        "infra602-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2025-06-19T17:20:00-04:00",
        "Keep open until branch behavior is rewritten or fully documented.",
      ),
    ],
  },
  {
    id: "jira-infra-392",
    type: "jira",
    title: "Historical queue backup classification baseline",
    ticketKey: "INFRA-392",
    status: "Closed",
    owner: "Dan Smith",
    createdAt: "2024-02-13T09:22:00-05:00",
    resolvedAt: "2024-02-20T11:40:00-05:00",
    summary:
      "Reference ticket created so future queue-level incidents can link to known retry-storm pattern.",
    technicalDescription:
      "Not a feature ticket; intentionally created as a canonical incident reference after ops repeatedly misclassified queue-level outages as account defects. Captures observability requirements and escalation signals.",
    comments: [
      jc(
        "infra392-c1",
        "Sarah Jenkins",
        "Senior Ops Analyst",
        "2024-02-13T10:34:00-05:00",
        "Please preserve this ticket as lookup artifact for future incidents.",
      ),
      jc(
        "infra392-c2",
        "Dan Smith",
        "Backend Engineer",
        "2024-02-14T09:11:00-05:00",
        "Added dashboard query pointers and queue-health metric names.",
      ),
      jc(
        "infra392-c3",
        "Raj Khoury",
        "Engineering Manager",
        "2024-02-20T11:40:00-05:00",
        "Closed as reference artifact; link in future queue incidents.",
      ),
    ],
  },
];

// -----------------------------------------------------------------------------
// Post-Mortems
// -----------------------------------------------------------------------------

const postMortemArtifacts: PostMortemArtifact[] = [
  {
    id: "postmortem-cusip-2024-11",
    type: "postmortem",
    title: "ATON Transfer Failure - Corporate Action CUSIP Reassignment (November 2024)",
    author: "Dan Smith",
    publishedAt: "2024-11-22",
    sections: [
      {
        heading: "What happened",
        body: "From Nov 15 to Nov 18, transfer tickets in the queue began failing at completion stage with CUSIP mismatch despite passing validator prechecks. Failures clustered in TFSA accounts with positions impacted by the Rogers/Shaw merger. Ops triage initially treated incidents as account-level data quality issues because queue error text lacked merger context.",
      },
      {
        heading: "Root cause",
        body: "The validator trusted legacy identifiers from OMS and did not verify freshness against corporate-action mappings. CAS/receiving side expected post-merger identifiers and rejected completion payloads. This created a mid-flight mismatch that looked non-deterministic without deep bridge logs.",
      },
      {
        heading: "Resolution",
        body: "Ops performed manual remap in the ledger with compliance-reviewed rationale notes. Engineering shipped OPS-8492 to introduce preflight mapping checks and bridge markers for explicit CUSIP drift detection. Queue recovered same day and no recurrence observed in following week.",
      },
      {
        heading: "What we learned",
        body: "Corporate-action drift is not rare edge noise; it is predictable recurring risk. We need preflight checks that fail early with actionable context and retrieval links to prior incidents. Without that, humans waste time rediscovering known patterns.",
      },
    ],
  },
  {
    id: "postmortem-bridge-trailing-zeros-2024-09",
    type: "postmortem",
    title: "Bridge Identifier Mutation - Trailing Zero Loss in Retry Path",
    author: "Dan Smith",
    publishedAt: "2024-09-16",
    sections: [
      {
        heading: "Incident summary",
        body: "A subset of transfer retries mutated CUSIP values by trimming trailing zeros. Primary path was unaffected, making reports appear random. Ops described this as impossible-to-reproduce mismatch because single manual retries frequently passed.",
      },
      {
        heading: "Technical root cause",
        body: "Retry code path cast identifier strings through a numeric normalization utility originally intended for amount fields. Identifier integrity assumptions were not codified. Mutation happened only after timeout-triggered retry, creating low-frequency but high-confusion failures.",
      },
      {
        heading: "Remediation",
        body: "Removed numeric normalization from identifier path, added immutable identifier type in bridge transform layer, and introduced stage-level checksum logs for payload diffing across queue retries.",
      },
      {
        heading: "Follow-up",
        body: "We need static analysis rules that prevent identifier fields from entering numeric utilities. Ticket INFRA-437 is closed, but monitoring for checksum anomalies remains active.",
      },
    ],
  },
  {
    id: "postmortem-validator-whitelist-2024-10",
    type: "postmortem",
    title: "Validator Whitelist Staleness After Quarterly Refresh",
    author: "Dan Smith",
    publishedAt: "2024-10-12",
    sections: [
      {
        heading: "What happened",
        body: "Quarterly securities refresh failed silently and left validator whitelist stale for approximately 72 hours. Legitimate transfers were rejected as unknown CUSIP across all account types.",
      },
      {
        heading: "Why detection lagged",
        body: "Monitoring checked job runtime but not completion status. A non-zero exit still looked healthy in dashboards. Ops only identified systemic pattern after queue rejects crossed 100 and individual account-level explanations failed.",
      },
      {
        heading: "Fixes",
        body: "Added completion-state monitoring, whitelist age alerting, and explicit operator-facing error code. Bulk requeue tooling was updated to preserve original submission time for SLA accounting.",
      },
      {
        heading: "Residual risk",
        body: "If refresh source feed schema changes, monitor can still pass while semantic content is wrong. Future work should verify sample security coverage, not only file freshness.",
      },
    ],
  },
  {
    id: "postmortem-cas-timeout-rrsp-2025-02",
    type: "postmortem",
    title: "RRSP Season CAS Timeout and Duplicate Attempt Incident",
    author: "Dan Smith",
    publishedAt: "2025-03-01",
    sections: [
      {
        heading: "Summary",
        body: "During RRSP peak week, CAS latency exceeded static timeout values. Retry behavior created duplicate transfer attempts that both entered the queue and occasionally reached settlement race conditions.",
      },
      {
        heading: "Initial misconception",
        body: "Ops initially flagged this as account-specific transfer corruption. In reality, it was a queue-level retry policy issue. This same misclassification pattern had occurred in INFRA-392 and later informed CAS 503 diagnosis.",
      },
      {
        heading: "Remediation actions",
        body: "Applied seasonal timeout profile, queue-key dedupe locks, and duplicate-attempt metrics. Added on-call runbook note clarifying queue-wide symptom signatures versus ticket-local failures.",
      },
      {
        heading: "Open items",
        body: "Backpressure strategy remains incomplete. Temporary configuration tuning is still carrying too much risk for next high-volume season.",
      },
    ],
  },
  {
    id: "postmortem-cas-503-queue-backup-2025-03",
    type: "postmortem",
    title: "CAS 503 Burst and Queue Saturation (March 2025)",
    author: "Sarah Jenkins",
    publishedAt: "2025-03-08",
    sections: [
      {
        heading: "Executive summary",
        body: "A CAS upstream outage generated a 503 burst that saturated bridge retries and caused transfer queue slowdown. To operations, this appeared as many unrelated ticket failures. Time to accurate classification was 23 minutes.",
      },
      {
        heading: "Operational impact",
        body: "Queue wait time exceeded SLA for high-priority RRSP and TFSA requests. No confirmed incorrect transfer execution occurred, but delayed completion required manual communication for a subset of clients.",
      },
      {
        heading: "Corrective action",
        body: "Engineering reduced retry fanout and adjusted timeout thresholds; ops applied queue-level triage mode. Compliance verified ordering and Reg flags integrity during delayed processing.",
      },
      {
        heading: "What still hurts",
        body: "We are still dependent on humans noticing queue-pattern similarity with prior incidents. Retrieval from historical artifacts should make this automatic in the future.",
      },
    ],
  },
  {
    id: "postmortem-fhsa-procedure-gap-2024-05",
    type: "postmortem",
    title: "FHSA Procedure Drift From Slack-Only Communication",
    author: "Sarah Jenkins",
    publishedAt: "2024-06-02",
    sections: [
      {
        heading: "Incident",
        body: "FHSA handling guidance was posted in Slack but never promoted to canonical runbook. Over multiple weeks, different shifts used different pathways and some transfers were escalated unnecessarily.",
      },
      {
        heading: "Contributing factors",
        body: "Search surfaced deprecated Confluence pages. Queue labels were also ambiguous when CAS returned account types inconsistently. Process ownership between ops, engineering, and compliance was not explicit.",
      },
      {
        heading: "Remediation",
        body: "Interim checklist pinned in #ops-general. OPS-673 tracked immediate stabilization. Long-term documentation consolidation intentionally deferred but repeatedly resurfaced, now tracked by open DOC-114.",
      },
      {
        heading: "Recommendation",
        body: "Any procedure change announced in Slack must automatically open documentation task with owner and due date. Channel messages are not sufficient system of record.",
      },
    ],
  },
  {
    id: "postmortem-ledger-readonly-2025-04",
    type: "postmortem",
    title: "Unexpected Ledger Read-Only Lock and Transfer Backlog",
    author: "Dev Chatterjee",
    publishedAt: "2025-04-13",
    sections: [
      {
        heading: "What happened",
        body: "During an overnight maintenance rollback, ledger lock state remained read-only. Operations received no automated notice and discovered impact only after queue backlog exceeded 40 transfers.",
      },
      {
        heading: "Root cause",
        body: "Notification service subscribed only to successful maintenance completion events. Rollback and failure paths did not publish lock-state transitions.",
      },
      {
        heading: "Resolution",
        body: "Cleared stale lock, prioritized queue manually, and shipped notifier updates to emit read-only state for all maintenance outcomes. Added queue banner for active ledger constraints.",
      },
      {
        heading: "Follow-up note",
        body: "Historically this might have been caught earlier because prior maintainers had deep validator/ledger coupling context. We need that knowledge written, not person-bound.",
      },
    ],
  },
  {
    id: "postmortem-aml-loop-2025-05",
    type: "postmortem",
    title: "AML Ownership Loop Between Ops and Compliance",
    author: "Marcus Thibodeau",
    publishedAt: "2025-05-11",
    sections: [
      {
        heading: "Summary",
        body: "Transfers under AML review entered repeated reassignment loops because no terminal owner existed when review remained inconclusive. Queue states allowed infinite handoff.",
      },
      {
        heading: "Why this persisted",
        body: "Process maps assumed binary outcomes and did not account for unresolved-at-deadline cases. Team members followed local interpretation, producing ping-pong behavior.",
      },
      {
        heading: "Interim control",
        body: "As of May 6, compliance is terminal owner for unresolved AML cases at T+2. This rule is mandatory pending workflow automation and has been communicated in queue SOP.",
      },
      {
        heading: "Observation",
        body: "Historically Dan would have caught ownership ambiguities in the validator-state logic review before release. That historical review habit is now missing and should be institutionalized.",
      },
    ],
  },
  {
    id: "postmortem-eoq-manual-review-2025-03",
    type: "postmortem",
    title: "End-of-Quarter Manual Review Capacity Breach",
    author: "Sarah Jenkins",
    publishedAt: "2025-04-02",
    sections: [
      {
        heading: "Incident statement",
        body: "At quarter close, manual review queue exceeded SLA due to 4.5x baseline volume and insufficient pre-screening. Overtime coverage cleared backlog but process strain was significant.",
      },
      {
        heading: "What was incomplete",
        body: "This write-up is intentionally brief due to active quarter-close workload. A fuller capacity model is still pending and should be attached to OPS-940 when available.",
      },
      {
        heading: "Immediate recommendations",
        body: "Raise temporary staffing during quarter-end windows, improve validator confidence routing, and build retrieval aids so analysts can reuse prior resolutions instead of re-triaging from scratch.",
      },
    ],
  },
];

const knowledgeArtifacts: KnowledgeArtifact[] = [
  ...slackArtifacts,
  ...jiraArtifacts,
  ...postMortemArtifacts,
];

export function listKnowledgeArtifacts(): KnowledgeArtifact[] {
  return knowledgeArtifacts;
}

export function getKnowledgeArtifact(id: string): KnowledgeArtifact | undefined {
  return knowledgeArtifacts.find((artifact) => artifact.id === id);
}
