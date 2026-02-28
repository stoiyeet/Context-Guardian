import { NextResponse } from "next/server";
import { loadSynthesizedKnowledge } from "@/lib/synthesizedKnowledge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const state = await loadSynthesizedKnowledge();
  return NextResponse.json(state);
}
