import { NextResponse } from "next/server";
import { getErr739Blueprint } from "@/lib/dummyData";
import type { BlueprintType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const blueprint: BlueprintType = getErr739Blueprint();
  return NextResponse.json(blueprint);
}
