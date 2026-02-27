// PHASE 2: LLM INTEGRATION POINT
import { NextResponse } from "next/server";
import { ingestTicket } from "@/lib/ticketStore";
import type { IngestPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: IngestPayload;

  try {
    payload = (await request.json()) as IngestPayload;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON payload.",
      },
      { status: 400 },
    );
  }

  if (!payload.rawError || typeof payload.rawError !== "string") {
    return NextResponse.json(
      {
        error: "`rawError` is required.",
      },
      { status: 400 },
    );
  }

  // PHASE 2: call LLM with structured prompt and return a blueprint matching OpsTicket interface.
  const ticket = ingestTicket(payload);

  return NextResponse.json(
    {
      ticket,
      message: "Event ingested. Blueprint generation started.",
    },
    { status: 201 },
  );
}
