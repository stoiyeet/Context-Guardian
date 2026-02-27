import type { OpsTicket, TicketBlueprint } from "@/lib/types";

export const HERO_TICKET_ID = "OPS-9021";

const ERR_739_BLUEPRINT: TicketBlueprint = {
  diagnosis:
    "The transfer failed because our system still used the old Shaw CUSIP after the merger, while the receiving broker expected the updated Rogers-linked CUSIP.",
  severity: "High",
  accountType: "Registered - TFSA",
  product: "TFSA Transfer",
  confidenceScore: 0.92,
  resolutionSteps: [
    {
      id: "step-verify-cusip",
      title: "Confirm legacy CUSIP reference in the account record.",
      details:
        "Check the holding record and verify it still points to pre-merger CUSIP 82028K200.",
      status: "Pending",
      reviewed: false,
    },
    {
      id: "step-ledger-payload",
      title: "Apply the remap payload and add a compliance note.",
      details:
        "Submit the ledger update that remaps the CUSIP and logs the merger rationale.",
      status: "Pending",
      reviewed: false,
      payloadJson: JSON.stringify(
        {
          tool: "ledger.updateHoldingReference",
          ticketId: HERO_TICKET_ID,
          accountId: "TFSA-448129",
          updates: [
            {
              field: "cusip",
              previous: "82028K200",
              next: "775109200",
            },
          ],
          complianceNote:
            "Manual remap approved due to Rogers/Shaw corporate action CUSIP reassignment.",
        },
        null,
        2,
      ),
    },
    {
      id: "step-reroute-transfer",
      title: "Re-run the ATON transfer with the corrected identifier.",
      details:
        "Retry transfer submission and confirm the receiving broker accepts the packet.",
      status: "Pending",
      reviewed: false,
    },
  ],
  evidenceNodes: [
    {
      id: "node-current-ticket",
      sourceType: "ticket",
      label: "OPS-9021",
      snippet: "ERR_739_CUSIP_MISMATCH on TFSA transfer request.",
      documentRef: "Current ticket",
      position: { x: 80, y: 120 },
    },
    {
      id: "node-slack-nov2024",
      sourceType: "slack",
      label: "Slack thread Nov 2024",
      snippet: "Ops discussion about transfer rejects after merger CUSIP shifts.",
      documentRef: "slack-nov-2024",
      position: { x: 290, y: 120 },
    },
    {
      id: "node-jira-ops8492",
      sourceType: "jira",
      label: "OPS-8492",
      snippet: "Resolved ticket: manual remap required before transfer retry.",
      documentRef: "jira-ops-8492",
      position: { x: 500, y: 120 },
    },
    {
      id: "node-postmortem",
      sourceType: "confluence",
      label: "Post-mortem",
      snippet: "Corporate action CUSIP reassignment documented with prevention steps.",
      documentRef: "postmortem-cusip-2024-11",
      position: { x: 710, y: 120 },
    },
  ],
  evidenceEdges: [
    {
      id: "edge-1",
      source: "node-current-ticket",
      target: "node-slack-nov2024",
      label: "Referenced in resolution",
    },
    {
      id: "edge-2",
      source: "node-slack-nov2024",
      target: "node-jira-ops8492",
      label: "Same error class",
    },
    {
      id: "edge-3",
      source: "node-jira-ops8492",
      target: "node-postmortem",
      label: "Referenced in resolution",
    },
  ],
  smes: [
    {
      id: "sme-sarah",
      name: "Sarah Jenkins",
      role: "Operations Analyst",
      status: "Active",
    },
    {
      id: "sme-dan",
      name: "Dan Smith",
      role: "Platform Engineer",
      status: "Active",
    },
    {
      id: "sme-marcus",
      name: "Marcus T.",
      role: "Compliance",
      status: "Active",
    },
  ],
};

function cloneBlueprint(blueprint: TicketBlueprint): TicketBlueprint {
  return {
    diagnosis: blueprint.diagnosis,
    severity: blueprint.severity,
    accountType: blueprint.accountType,
    product: blueprint.product,
    confidenceScore: blueprint.confidenceScore,
    resolutionSteps: blueprint.resolutionSteps.map((step) => ({ ...step })),
    evidenceNodes: blueprint.evidenceNodes.map((node) => ({
      ...node,
      position: { ...node.position },
    })),
    evidenceEdges: blueprint.evidenceEdges.map((edge) => ({ ...edge })),
    smes: blueprint.smes.map((sme) => ({ ...sme })),
  };
}

export function getErr739Blueprint(): TicketBlueprint {
  return cloneBlueprint(ERR_739_BLUEPRINT);
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
  const blueprint = getErr739Blueprint();
  return {
    ...blueprint,
    diagnosis:
      rawError === "ERR_739_CUSIP_MISMATCH"
        ? blueprint.diagnosis
        : "The event was classified as a transfer-processing mismatch and pre-mapped to a known remediation pathway.",
  };
}
