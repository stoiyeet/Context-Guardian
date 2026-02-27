// PHASE 2: LLM INTEGRATION POINT
import { NextResponse } from "next/server";
import { ingestTicket } from "@/lib/ticketStore";
import type { IngestPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

function invalid(message: string) {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  let payload: IngestPayload;

  try {
    payload = (await request.json()) as IngestPayload;
  } catch {
    return invalid("Invalid JSON payload.");
  }

  if (!payload.rawError || typeof payload.rawError !== "string") {
    return invalid("`rawError` is required.");
  }

  if (!payload.context || typeof payload.context !== "object") {
    return invalid("`context` is required and must include process-stage details.");
  }

  const context = payload.context;
  if (!context.pipelineStage || context.pipelineStage.trim().length < 4) {
    return invalid("`context.pipelineStage` is required (minimum 4 chars).");
  }
  if (!context.attemptedAction || context.attemptedAction.trim().length < 8) {
    return invalid("`context.attemptedAction` is required (minimum 8 chars).");
  }
  if (!context.lastSuccessfulState || context.lastSuccessfulState.trim().length < 8) {
    return invalid("`context.lastSuccessfulState` is required (minimum 8 chars).");
  }
  if (!context.sourceInstitution || context.sourceInstitution.trim().length < 2) {
    return invalid("`context.sourceInstitution` is required.");
  }
  if (!context.existingFlags || typeof context.existingFlags !== "object") {
    return invalid("`context.existingFlags` is required.");
  }
  if (
    typeof context.existingFlags.overContributionHistory !== "string" ||
    typeof context.existingFlags.amlStatus !== "string"
  ) {
    return invalid(
      "`context.existingFlags.overContributionHistory` and `context.existingFlags.amlStatus` must be strings.",
    );
  }
  if (!Array.isArray(context.existingFlags.pendingReviews)) {
    return invalid("`context.existingFlags.pendingReviews` must be a string array.");
  }
  if (context.existingFlags.pendingReviews.some((item) => typeof item !== "string")) {
    return invalid("`context.existingFlags.pendingReviews` must contain only strings.");
  }
  if (
    context.additionalSignals &&
    (!Array.isArray(context.additionalSignals) ||
      context.additionalSignals.some((item) => typeof item !== "string"))
  ) {
    return invalid("`context.additionalSignals` must be a string array when provided.");
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
