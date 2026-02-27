// PHASE 2: LLM INTEGRATION POINT
import { NextResponse } from "next/server";
import { ingestTicket } from "@/lib/ticketStore";
import type { IngestPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: IngestPayload & {
    description?: string;
    metadata?: Record<string, string | number | boolean>;
  };

  try {
    payload = (await request.json()) as IngestPayload & {
      description?: string;
      metadata?: Record<string, string | number | boolean>;
    };
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

  const ticket = await ingestTicket(payload);

  return NextResponse.json(
    {
      ticket,
      message: "Event ingested. Blueprint generation started.",
    },
    { status: 201 },
  );
}
