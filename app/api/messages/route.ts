import { NextResponse } from "next/server";
import { getOrCreateSessionId } from "@/lib/session";
import {
  listMessageThreads,
  sendMessageToThread,
} from "@/lib/messageStore";
import type { MessageRecipient } from "@/lib/messageTypes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function invalid(message: string) {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 400 },
  );
}

export async function GET() {
  const sessionId = getOrCreateSessionId();
  const threads = await listMessageThreads(sessionId);
  return NextResponse.json({
    sessionId,
    threads,
  });
}

export async function POST(request: Request) {
  const sessionId = getOrCreateSessionId();
  let payload: {
    recipients?: MessageRecipient[];
    body?: string;
    senderName?: string;
  };

  try {
    payload = (await request.json()) as {
      recipients?: MessageRecipient[];
      body?: string;
      senderName?: string;
    };
  } catch {
    return invalid("Invalid JSON payload.");
  }

  if (!Array.isArray(payload.recipients) || payload.recipients.length === 0) {
    return invalid("`recipients` must be a non-empty array.");
  }
  if (!payload.body || !payload.body.trim()) {
    return invalid("`body` is required.");
  }
  if (
    payload.recipients.some(
      (recipient) =>
        !recipient.id ||
        !recipient.name ||
        !recipient.role ||
        (recipient.status !== "Active" && recipient.status !== "Departed"),
    )
  ) {
    return invalid("Each recipient must include id, name, role, and status.");
  }

  const thread = await sendMessageToThread(
    sessionId,
    payload.recipients,
    payload.body.trim(),
    payload.senderName?.trim() || "You",
  );

  return NextResponse.json({
    sessionId,
    thread,
  });
}
