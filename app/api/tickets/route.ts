// PHASE 2: LLM INTEGRATION POINT
import { NextRequest, NextResponse } from "next/server";
import { runBlueprintInference } from "@/lib/inferencePipeline";
import type { BlueprintType, Severity } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseSeverity(value: string | null): Severity | undefined {
  if (value === "Low" || value === "Medium" || value === "High" || value === "Critical") {
    return value;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const ticketId = search.get("ticketId") ?? "OPS-API-DEMO";
  const rawError = search.get("rawError") ?? "ERR_739_CUSIP_MISMATCH";
  const description =
    search.get("description") ??
    "ATON transfer rejected with CUSIP mismatch while processing TFSA transfer.";
  const accountType = search.get("accountType") ?? "Registered - TFSA";
  const product = search.get("product") ?? "TFSA Transfer";
  const severity = parseSeverity(search.get("severity"));

  const inferred = await runBlueprintInference({
    ticketId,
    rawError,
    description,
    accountType,
    product,
    severity,
    ingestedAt: new Date().toISOString(),
  });

  const blueprint: BlueprintType = inferred.blueprint;
  return NextResponse.json({
    ...blueprint,
    inferenceMeta: inferred.metadata,
    blueprintGeneratedAt: inferred.blueprintGeneratedAt,
  });
}
