import type { OpsTicket, TicketBlueprint } from "@/lib/types";

const now = Date.now();
const toIso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

export const HERO_TICKET_ID = "OPS-9021";

const heroBlueprint: TicketBlueprint = {
  diagnosis:
    "TFSA transfer rejected because the source CUSIP on file still maps to pre-merger Shaw equity; receiving broker expects the post-merger Rogers-linked replacement CUSIP.",
  severity: "High",
  accountType: "Registered - TFSA",
  product: "TFSA Transfer",
  confidenceScore: 0.92,
  resolutionSteps: [
    {
      id: "step-verify-cusip",
      title: "Confirm instrument migration status",
      details:
        "Validate whether the account still references legacy CUSIP 82028K200 and map it to migration table entry for the post-merger identifier.",
      status: "In Progress",
      reviewed: false,
    },
    {
      id: "step-ledger-payload",
      title: "Submit ledger correction payload",
      details:
        "Run the ledger update tool call with the normalized CUSIP and reconciliation note before retrying transfer routing.",
      status: "Pending",
      reviewed: false,
      payloadJson: JSON.stringify(
        {
          tool: "ledger.updateHoldingReference",
          ticketId: "OPS-9021",
          accountId: "TFSA-448129",
          updates: [
            {
              field: "cusip",
              previous: "82028K200",
              next: "775109200",
            },
          ],
          rationale:
            "Shaw/Rogers merger migration normalized legacy CUSIP reference before ATON re-attempt",
        },
        null,
        2,
      ),
    },
    {
      id: "step-rerun-transfer",
      title: "Retry ATON handoff",
      details:
        "Requeue transfer after ledger write and confirm receiving broker ACK includes corrected security key.",
      status: "Pending",
      reviewed: false,
    },
    {
      id: "step-notify-client-ops",
      title: "Notify client operations queue",
      details:
        "Attach a short note to client-facing ops queue that rejection reason was mapped to merger CUSIP drift and resolved.",
      status: "Pending",
      reviewed: false,
    },
  ],
  evidenceNodes: [
    {
      id: "node-current-ticket",
      sourceType: "ticket",
      label: "OPS-9021",
      snippet: "ATON reject: ERR_739_CUSIP_MISMATCH on TFSA account TFSA-448129.",
      documentRef: "Current ticket",
      position: { x: 340, y: 160 },
    },
    {
      id: "node-jira-ops8492",
      sourceType: "jira",
      label: "Jira OPS-8492",
      snippet:
        "Title: CUSIP rot in transfer validator after issuer action (fixed Dec 2024, typo in migration map key).",
      documentRef: "Jira /browse/OPS-8492",
      position: { x: 92, y: 64 },
    },
    {
      id: "node-slack-nov2024",
      sourceType: "slack",
      label: "#ops-transfers Nov 2024",
      snippet:
        "" +
        "\"we keep seeing shaw paper bouncing b/c broker side already flipped ids lol — use the merger table first\"",
      documentRef: "Slack thread 2024-11-18",
      position: { x: 604, y: 72 },
    },
    {
      id: "node-confluence-postmortem",
      sourceType: "confluence",
      label: "Post-mortem 2024-12-03",
      snippet:
        "Dec 3 post-mortem: transfer rejects clustered around stale issuer-action references in pre-check service.",
      documentRef: "Confluence OPS-PM-2024-12-03",
      position: { x: 104, y: 300 },
    },
    {
      id: "node-reg-note-iiroc",
      sourceType: "regulatory",
      label: "IIROC Notice 24-17",
      snippet:
        "Corporate action identifier transitions must preserve full audit trail during account transfer workflows.",
      documentRef: "Regulatory note IIROC-24-17",
      position: { x: 586, y: 294 },
    },
    {
      id: "node-slack-jan-followup",
      sourceType: "slack",
      label: "#clearing-escalations Jan 2025",
      snippet:
        "" +
        "\"if error 739 + TFSA, check CUSIP remap first before pinging custodian\"",
      documentRef: "Slack thread 2025-01-07",
      position: { x: 738, y: 196 },
    },
  ],
  evidenceEdges: [
    {
      id: "edge-current-jira",
      source: "node-current-ticket",
      target: "node-jira-ops8492",
      label: "Same error class",
    },
    {
      id: "edge-jira-confluence",
      source: "node-jira-ops8492",
      target: "node-confluence-postmortem",
      label: "Referenced in resolution",
    },
    {
      id: "edge-current-slack",
      source: "node-current-ticket",
      target: "node-slack-nov2024",
      label: "Referenced in resolution",
    },
    {
      id: "edge-current-reg",
      source: "node-current-ticket",
      target: "node-reg-note-iiroc",
      label: "Regulatory overlap",
    },
    {
      id: "edge-slack-followup",
      source: "node-slack-nov2024",
      target: "node-slack-jan-followup",
      label: "Same error class",
    },
  ],
  smes: [
    {
      id: "sme-alice",
      name: "Alice Deshmukh",
      role: "Transfers Operations Lead",
      status: "Active",
    },
    {
      id: "sme-jordan",
      name: "Jordan M. Singh",
      role: "Broker Connectivity Engineer",
      status: "Active",
    },
    {
      id: "sme-ron",
      name: "Ron Cavanaugh",
      role: "Legacy Settlements Analyst",
      status: "Departed",
    },
  ],
};

export const dummyTickets: OpsTicket[] = [
  {
    id: "OPS-9024",
    rawError: "ERR_112_ACCOUNT_HOLD_UNKNOWN",
    ingestedAt: toIso(-1_000),
    blueprintGeneratedAt: toIso(2_000),
    unread: true,
    status: "Open",
    diagnosis:
      "Transfer paused because account hold source is ambiguous; hold may have been inherited from an expired fraud watchlist sync.",
    severity: "Medium",
    accountType: "Non-Registered - Individual",
    product: "ATON Outbound Transfer",
    confidenceScore: 0.71,
    resolutionSteps: [
      {
        id: "ops9024-step-1",
        title: "Resolve hold origin",
        details:
          "Check hold table lineage for the latest write source and expiration metadata.",
        status: "Pending",
        reviewed: false,
      },
      {
        id: "ops9024-step-2",
        title: "Validate watchlist sync state",
        details:
          "Confirm yesterday's fraud-watchlist ETL succeeded and did not replay stale records.",
        status: "Pending",
        reviewed: false,
      },
      {
        id: "ops9024-step-3",
        title: "Retry transfer if cleared",
        details: "Re-run transfer validation after hold source is confirmed or removed.",
        status: "Pending",
        reviewed: false,
      },
    ],
    evidenceNodes: [
      {
        id: "ops9024-ticket",
        sourceType: "ticket",
        label: "OPS-9024",
        snippet: "New account hold surfaced during transfer pre-check.",
        documentRef: "Current ticket",
        position: { x: 320, y: 155 },
      },
      {
        id: "ops9024-jira",
        sourceType: "jira",
        label: "Jira OPS-8880",
        snippet: "hold_source null fallback causes unknown hold label in validator",
        documentRef: "Jira /browse/OPS-8880",
        position: { x: 90, y: 80 },
      },
      {
        id: "ops9024-slack",
        sourceType: "slack",
        label: "#risk-pipeline",
        snippet: "" + "\"watchlist ETL retried w/ old cursor at 01:22, might duplicate holds\"",
        documentRef: "Slack message 2026-01-12",
        position: { x: 570, y: 80 },
      },
      {
        id: "ops9024-confluence",
        sourceType: "confluence",
        label: "Risk Sync Runbook",
        snippet: "Manual rollback requires deleting stale hold snapshots before replay.",
        documentRef: "Confluence RUNBOOK-RISK-11",
        position: { x: 120, y: 285 },
      },
    ],
    evidenceEdges: [
      {
        id: "ops9024-edge-1",
        source: "ops9024-ticket",
        target: "ops9024-jira",
        label: "Same error class",
      },
      {
        id: "ops9024-edge-2",
        source: "ops9024-ticket",
        target: "ops9024-slack",
        label: "Referenced in resolution",
      },
      {
        id: "ops9024-edge-3",
        source: "ops9024-jira",
        target: "ops9024-confluence",
        label: "Referenced in resolution",
      },
    ],
    smes: [
      {
        id: "ops9024-sme-1",
        name: "Priya Lang",
        role: "Fraud Platform On-Call",
        status: "Active",
      },
      {
        id: "ops9024-sme-2",
        name: "Elliot Varela",
        role: "Core Ledger Analyst",
        status: "Active",
      },
    ],
  },
  {
    id: HERO_TICKET_ID,
    rawError: "ERR_739_CUSIP_MISMATCH",
    ingestedAt: toIso(-420_000),
    blueprintGeneratedAt: toIso(-417_000),
    unread: true,
    status: "Open",
    ...heroBlueprint,
  },
  {
    id: "OPS-9018",
    rawError: "ERR_218_SANCTIONS_ALIAS_HIT",
    ingestedAt: toIso(-980_000),
    blueprintGeneratedAt: toIso(-976_000),
    unread: false,
    status: "Flagged for Human Review",
    diagnosis:
      "Name screening flagged a probable false positive caused by a transliteration alias collision against a sanctions list entity.",
    severity: "Critical",
    accountType: "Corporate",
    product: "Cross-Border Wire",
    confidenceScore: 0.64,
    resolutionSteps: [
      {
        id: "ops9018-step-1",
        title: "Compare sanction hit tokens",
        details:
          "Inspect token-level match trace to verify alias confidence and jurisdiction tags.",
        status: "Complete",
        reviewed: true,
      },
      {
        id: "ops9018-step-2",
        title: "Collect enhanced due diligence docs",
        details:
          "Pull recent corporate registry extracts and beneficial owner records.",
        status: "In Progress",
        reviewed: false,
      },
      {
        id: "ops9018-step-3",
        title: "Route to compliance adjudication",
        details: "Escalate to compliance queue with model trace attached.",
        status: "Pending",
        reviewed: false,
      },
    ],
    evidenceNodes: [
      {
        id: "ops9018-ticket",
        sourceType: "ticket",
        label: "OPS-9018",
        snippet: "Wire halted by sanctions alias hit (score 0.81).",
        documentRef: "Current ticket",
        position: { x: 340, y: 165 },
      },
      {
        id: "ops9018-jira",
        sourceType: "jira",
        label: "Jira AML-1772",
        snippet: "alias_distance threshold too strict for french translit names",
        documentRef: "Jira /browse/AML-1772",
        position: { x: 100, y: 76 },
      },
      {
        id: "ops9018-slack",
        sourceType: "slack",
        label: "#compliance-live",
        snippet: "" + "\"looks like same company, diff romanization again...\"",
        documentRef: "Slack 2026-01-29",
        position: { x: 580, y: 88 },
      },
      {
        id: "ops9018-reg",
        sourceType: "regulatory",
        label: "FINTRAC Guideline B-8",
        snippet: "False positive remediation must preserve decision rationale and source traces.",
        documentRef: "FINTRAC B-8",
        position: { x: 560, y: 280 },
      },
    ],
    evidenceEdges: [
      {
        id: "ops9018-edge-1",
        source: "ops9018-ticket",
        target: "ops9018-jira",
        label: "Same error class",
      },
      {
        id: "ops9018-edge-2",
        source: "ops9018-ticket",
        target: "ops9018-slack",
        label: "Referenced in resolution",
      },
      {
        id: "ops9018-edge-3",
        source: "ops9018-ticket",
        target: "ops9018-reg",
        label: "Regulatory overlap",
      },
    ],
    smes: [
      {
        id: "ops9018-sme-1",
        name: "Mei Ortega",
        role: "Compliance Investigations",
        status: "Active",
      },
      {
        id: "ops9018-sme-2",
        name: "Hakim Leclerc",
        role: "AML Data Scientist",
        status: "Active",
      },
      {
        id: "ops9018-sme-3",
        name: "Nora Caldeira",
        role: "KYC Operations",
        status: "Departed",
      },
    ],
  },
  {
    id: "OPS-9015",
    rawError: "ERR_505_LEDGER_DRIFT",
    ingestedAt: toIso(-1_760_000),
    blueprintGeneratedAt: toIso(-1_758_000),
    unread: false,
    status: "Authorized",
    diagnosis:
      "Account position mismatch was caused by stale settlement leg replay after overnight ledger backfill.",
    severity: "Medium",
    accountType: "Managed - Joint",
    product: "Margin Reconciliation",
    confidenceScore: 0.88,
    resolutionSteps: [
      {
        id: "ops9015-step-1",
        title: "Freeze impacted account",
        details: "Apply reconciliation lock before replaying settlement deltas.",
        status: "Complete",
        reviewed: true,
      },
      {
        id: "ops9015-step-2",
        title: "Replay settlement deltas",
        details: "Run replay job for trade date bucket T-1 with dedupe guard.",
        status: "Complete",
        reviewed: true,
      },
      {
        id: "ops9015-step-3",
        title: "Release account lock",
        details: "Remove lock after reconciled ledger snapshot passes validation checks.",
        status: "Complete",
        reviewed: true,
      },
    ],
    evidenceNodes: [
      {
        id: "ops9015-ticket",
        sourceType: "ticket",
        label: "OPS-9015",
        snippet: "ledger checksum mismatch after nightly backfill",
        documentRef: "Current ticket",
        position: { x: 320, y: 170 },
      },
      {
        id: "ops9015-jira",
        sourceType: "jira",
        label: "Jira LED-203",
        snippet: "backfill worker can replay already-settled legs if retry jitter overlaps",
        documentRef: "Jira /browse/LED-203",
        position: { x: 100, y: 92 },
      },
      {
        id: "ops9015-confluence",
        sourceType: "confluence",
        label: "Post-mortem 2025-09-16",
        snippet: "Added dedupe guard hash on settlement replay payload.",
        documentRef: "Confluence PM-LED-2025-09-16",
        position: { x: 560, y: 92 },
      },
    ],
    evidenceEdges: [
      {
        id: "ops9015-edge-1",
        source: "ops9015-ticket",
        target: "ops9015-jira",
        label: "Same error class",
      },
      {
        id: "ops9015-edge-2",
        source: "ops9015-jira",
        target: "ops9015-confluence",
        label: "Referenced in resolution",
      },
    ],
    smes: [
      {
        id: "ops9015-sme-1",
        name: "Vikram Osei",
        role: "Ledger Reliability",
        status: "Active",
      },
      {
        id: "ops9015-sme-2",
        name: "Jules Morin",
        role: "Settlements Engineer",
        status: "Departed",
      },
    ],
  },
  {
    id: "OPS-9009",
    rawError: "ERR_401_ATON_REJECT_DEALERCODE",
    ingestedAt: toIso(-2_400_000),
    blueprintGeneratedAt: toIso(-2_395_000),
    unread: true,
    status: "Open",
    diagnosis:
      "ATON request rejected because dealer code normalization stripped a required suffix during outbound formatting.",
    severity: "High",
    accountType: "RRSP",
    product: "ATON Inbound Transfer",
    confidenceScore: 0.9,
    resolutionSteps: [
      {
        id: "ops9009-step-1",
        title: "Rebuild dealer code payload",
        details: "Apply canonical dealer code formatter including suffix segment.",
        status: "In Progress",
        reviewed: false,
      },
      {
        id: "ops9009-step-2",
        title: "Run validation against counterparty profile",
        details:
          "Check outbound record against receiving broker capability matrix before retry.",
        status: "Pending",
        reviewed: false,
      },
      {
        id: "ops9009-step-3",
        title: "Re-submit transfer",
        details: "Submit ATON packet and confirm format acceptance from counterparty.",
        status: "Pending",
        reviewed: false,
      },
    ],
    evidenceNodes: [
      {
        id: "ops9009-ticket",
        sourceType: "ticket",
        label: "OPS-9009",
        snippet: "ERR_401_ATON_REJECT_DEALERCODE from counterparty gate",
        documentRef: "Current ticket",
        position: { x: 330, y: 168 },
      },
      {
        id: "ops9009-jira",
        sourceType: "jira",
        label: "Jira TRF-612",
        snippet: "dealerCodeFormatter trims suffix when profile=legacyAton",
        documentRef: "Jira /browse/TRF-612",
        position: { x: 118, y: 82 },
      },
      {
        id: "ops9009-slack",
        sourceType: "slack",
        label: "#broker-links",
        snippet: "" + "\"yep RBC wants full code incl -CA now, no truncation\"",
        documentRef: "Slack 2025-12-08",
        position: { x: 594, y: 98 },
      },
      {
        id: "ops9009-reg",
        sourceType: "regulatory",
        label: "CSA Transfer Rule Note",
        snippet: "Transfer requests must preserve source institution identifier fidelity.",
        documentRef: "CSA-TR-2025-04",
        position: { x: 560, y: 280 },
      },
    ],
    evidenceEdges: [
      {
        id: "ops9009-edge-1",
        source: "ops9009-ticket",
        target: "ops9009-jira",
        label: "Same error class",
      },
      {
        id: "ops9009-edge-2",
        source: "ops9009-ticket",
        target: "ops9009-slack",
        label: "Referenced in resolution",
      },
      {
        id: "ops9009-edge-3",
        source: "ops9009-ticket",
        target: "ops9009-reg",
        label: "Regulatory overlap",
      },
    ],
    smes: [
      {
        id: "ops9009-sme-1",
        name: "Kari Nandakumar",
        role: "Transfer Rail Integrations",
        status: "Active",
      },
      {
        id: "ops9009-sme-2",
        name: "Derek Hall",
        role: "Broker Partner Manager",
        status: "Active",
      },
    ],
  },
];

export function cloneDummyTickets(): OpsTicket[] {
  return dummyTickets.map((ticket) => ({
    ...ticket,
    resolutionSteps: ticket.resolutionSteps.map((step) => ({ ...step })),
    evidenceNodes: ticket.evidenceNodes.map((node) => ({
      ...node,
      position: { ...node.position },
    })),
    evidenceEdges: ticket.evidenceEdges.map((edge) => ({ ...edge })),
    smes: ticket.smes.map((sme) => ({ ...sme })),
  }));
}

export function cloneBlueprintFromTicket(ticket: OpsTicket): TicketBlueprint {
  return {
    diagnosis: ticket.diagnosis,
    severity: ticket.severity,
    accountType: ticket.accountType,
    product: ticket.product,
    confidenceScore: ticket.confidenceScore,
    resolutionSteps: ticket.resolutionSteps.map((step) => ({ ...step })),
    evidenceNodes: ticket.evidenceNodes.map((node) => ({
      ...node,
      position: { ...node.position },
    })),
    evidenceEdges: ticket.evidenceEdges.map((edge) => ({ ...edge })),
    smes: ticket.smes.map((sme) => ({ ...sme })),
  };
}

export function buildGenericBlueprint(rawError: string): TicketBlueprint {
  return {
    diagnosis:
      "Incoming operational event classified as a transfer-processing exception; core failure likely tied to upstream data normalization drift.",
    severity: "Medium",
    accountType: "Non-Registered - Individual",
    product: "Operations Queue",
    confidenceScore: 0.68,
    resolutionSteps: [
      {
        id: "generic-step-1",
        title: "Validate raw payload fingerprint",
        details: "Confirm the incoming payload hash and parse metadata fields.",
        status: "Pending",
        reviewed: false,
      },
      {
        id: "generic-step-2",
        title: "Run exception classifier fallback",
        details: "Apply fallback resolver to map the event into a known remediation path.",
        status: "Pending",
        reviewed: false,
      },
      {
        id: "generic-step-3",
        title: "Escalate if unresolved",
        details: "Flag for senior operations review if mismatch persists after retry.",
        status: "Pending",
        reviewed: false,
      },
    ],
    evidenceNodes: [
      {
        id: "generic-ticket",
        sourceType: "ticket",
        label: "Current Event",
        snippet: `Ingested raw code: ${rawError}`,
        documentRef: "Current ticket",
        position: { x: 320, y: 160 },
      },
      {
        id: "generic-jira",
        sourceType: "jira",
        label: "Jira OPS-Template",
        snippet: "historical resolver branch for uncategorized transfer faults",
        documentRef: "Jira /browse/OPS-Template",
        position: { x: 96, y: 82 },
      },
      {
        id: "generic-slack",
        sourceType: "slack",
        label: "#ops-runtime",
        snippet: "" + "\"new fault class probably same parser bug we saw last quarter\"",
        documentRef: "Slack thread",
        position: { x: 578, y: 98 },
      },
      {
        id: "generic-runbook",
        sourceType: "confluence",
        label: "Unhandled Error Runbook",
        snippet: "Route unknown codes through triage branch before operator escalation.",
        documentRef: "Confluence RUNBOOK-UNHANDLED-01",
        position: { x: 540, y: 286 },
      },
    ],
    evidenceEdges: [
      {
        id: "generic-edge-1",
        source: "generic-ticket",
        target: "generic-jira",
        label: "Same error class",
      },
      {
        id: "generic-edge-2",
        source: "generic-ticket",
        target: "generic-slack",
        label: "Referenced in resolution",
      },
      {
        id: "generic-edge-3",
        source: "generic-jira",
        target: "generic-runbook",
        label: "Referenced in resolution",
      },
    ],
    smes: [
      {
        id: "generic-sme-1",
        name: "Ops Duty Analyst",
        role: "Operations On-Call",
        status: "Active",
      },
      {
        id: "generic-sme-2",
        name: "Data Reliability Lead",
        role: "Platform Reliability",
        status: "Active",
      },
    ],
  };
}
