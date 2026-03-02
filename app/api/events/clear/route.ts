import { NextResponse } from "next/server";
import { clearEventStream } from "@/lib/ticketStore";

export const dynamic = "force-dynamic";

export async function POST() {
  clearEventStream();
  return NextResponse.json({
    message: "Event stream cleared.",
    serverTime: new Date().toISOString(),
  });
}
