// app/api/_diag/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
    console.log("node", process.version);
    return NextResponse.json({ node: process.version });
}