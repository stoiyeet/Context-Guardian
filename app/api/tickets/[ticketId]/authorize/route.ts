import { NextResponse } from "next/server";
import { cloneBlueprintFromTicket } from "@/lib/dummyData";
import { updateSynthesizedKnowledge } from "@/lib/synthesizedKnowledge";
import { authorizeTicket } from "@/lib/ticketStore";
import type { OpsTicket } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    ticketId: string;
  };
};

export async function POST(request: Request, context: RouteContext) {
  let operatorNotes: string | undefined;
  let ticketSnapshot: OpsTicket | undefined;
  try {
    const payload = (await request.json()) as {
      operatorNotes?: string;
      ticketSnapshot?: OpsTicket;
    };
    operatorNotes = payload.operatorNotes;
    ticketSnapshot = payload.ticketSnapshot;
  } catch {
    operatorNotes = undefined;
    ticketSnapshot = undefined;
  }

  const ticket = await authorizeTicket(context.params.ticketId, { operatorNotes });
  if (!ticket) {
    if (ticketSnapshot && ticketSnapshot.id === context.params.ticketId) {
      const snapshotAuthorized: OpsTicket = {
        ...ticketSnapshot,
        status: "Authorized",
        unread: false,
      };
      const blueprint = cloneBlueprintFromTicket(snapshotAuthorized);
      void updateSynthesizedKnowledge(snapshotAuthorized, blueprint, operatorNotes).catch(() => {
        // Keep API response successful for stale-session ticket fallback mode.
      });

      return NextResponse.json({
        ticket: snapshotAuthorized,
        message:
          "Resolution authorized from client snapshot. Synthesized knowledge update queued.",
      });
    }

    return NextResponse.json(
      {
        error: `Ticket ${context.params.ticketId} not found.`,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ticket,
    message: "Resolution authorized. Synthesized knowledge update queued.",
  });
}
