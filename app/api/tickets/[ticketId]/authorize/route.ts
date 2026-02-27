import { NextResponse } from "next/server";
import { authorizeTicket } from "@/lib/ticketStore";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    ticketId: string;
  };
};

export async function POST(request: Request, context: RouteContext) {
  let operatorNotes: string | undefined;
  try {
    const payload = (await request.json()) as { operatorNotes?: string };
    operatorNotes = payload.operatorNotes;
  } catch {
    operatorNotes = undefined;
  }

  const ticket = await authorizeTicket(context.params.ticketId, { operatorNotes });
  if (!ticket) {
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
