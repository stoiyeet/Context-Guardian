import { NextResponse } from "next/server";
import {
  getAuditLogByTicketId,
  getInferenceMetadata,
  isBlueprintReady,
  listTickets,
} from "@/lib/ticketStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  const tickets = listTickets().map((ticket) => ({
    ...ticket,
    blueprintReady: isBlueprintReady(ticket),
  }));

  return NextResponse.json({
    tickets,
    inferenceByTicketId: getInferenceMetadata(),
    auditLogByTicketId: getAuditLogByTicketId(),
    serverTime: new Date().toISOString(),
  });
}
