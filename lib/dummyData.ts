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
