import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { getMongoDb, hasMongoConfig } from "@/lib/mongo";
import type {
  InternalMessage,
  MessageRecipient,
  MessageThread,
} from "@/lib/messageTypes";

type ThreadDoc = {
  _id: ObjectId;
  sessionId: string;
  recipientKey: string;
  recipients: MessageRecipient[];
  messages: InternalMessage[];
  createdAt: string;
  updatedAt: string;
};

const MEMORY_THREADS = new Map<string, MessageThread[]>();

function normalizeRecipients(recipients: MessageRecipient[]): MessageRecipient[] {
  return [...recipients]
    .map((recipient) => ({
      ...recipient,
      name: recipient.name.trim(),
      role: recipient.role.trim(),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function recipientKeyFor(recipients: MessageRecipient[]): string {
  return normalizeRecipients(recipients)
    .map((recipient) => recipient.id)
    .join("|");
}

function toThread(doc: ThreadDoc): MessageThread {
  return {
    id: doc._id.toString(),
    sessionId: doc.sessionId,
    recipientKey: doc.recipientKey,
    recipients: doc.recipients,
    messages: doc.messages,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function listThreadsMongo(sessionId: string): Promise<MessageThread[]> {
  const db = await getMongoDb();
  const rows = (await db
    .collection<ThreadDoc>("message_threads")
    .find({ sessionId })
    .sort({ updatedAt: -1 })
    .toArray()) as ThreadDoc[];
  return rows.map(toThread);
}

async function sendMessageMongo(
  sessionId: string,
  recipients: MessageRecipient[],
  body: string,
  senderName: string,
): Promise<MessageThread> {
  const db = await getMongoDb();
  const now = new Date().toISOString();
  const normalizedRecipients = normalizeRecipients(recipients);
  const recipientKey = recipientKeyFor(normalizedRecipients);
  const message: InternalMessage = {
    id: randomUUID(),
    senderName,
    body,
    sentAt: now,
  };

  await db.collection<ThreadDoc>("message_threads").findOneAndUpdate(
    {
      sessionId,
      recipientKey,
    },
    {
      $setOnInsert: {
        sessionId,
        recipientKey,
        recipients: normalizedRecipients,
        createdAt: now,
      },
      $set: {
        updatedAt: now,
      },
      $push: {
        messages: message,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  const persisted = await db.collection<ThreadDoc>("message_threads").findOne({
    sessionId,
    recipientKey,
  });

  if (!persisted) {
    throw new Error("Failed to persist message thread.");
  }

  return toThread(persisted);
}

function listThreadsMemory(sessionId: string): MessageThread[] {
  return [...(MEMORY_THREADS.get(sessionId) ?? [])].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
}

function sendMessageMemory(
  sessionId: string,
  recipients: MessageRecipient[],
  body: string,
  senderName: string,
): MessageThread {
  const now = new Date().toISOString();
  const normalizedRecipients = normalizeRecipients(recipients);
  const recipientKey = recipientKeyFor(normalizedRecipients);
  const message: InternalMessage = {
    id: randomUUID(),
    senderName,
    body,
    sentAt: now,
  };

  const current = MEMORY_THREADS.get(sessionId) ?? [];
  const existing = current.find((thread) => thread.recipientKey === recipientKey);
  if (existing) {
    const updated: MessageThread = {
      ...existing,
      updatedAt: now,
      messages: [...existing.messages, message],
    };
    MEMORY_THREADS.set(
      sessionId,
      current.map((thread) => (thread.id === existing.id ? updated : thread)),
    );
    return updated;
  }

  const created: MessageThread = {
    id: randomUUID(),
    sessionId,
    recipientKey,
    recipients: normalizedRecipients,
    messages: [message],
    createdAt: now,
    updatedAt: now,
  };
  MEMORY_THREADS.set(sessionId, [created, ...current]);
  return created;
}

export async function listMessageThreads(sessionId: string): Promise<MessageThread[]> {
  if (hasMongoConfig()) {
    return listThreadsMongo(sessionId);
  }
  return listThreadsMemory(sessionId);
}

export async function sendMessageToThread(
  sessionId: string,
  recipients: MessageRecipient[],
  body: string,
  senderName: string,
): Promise<MessageThread> {
  if (hasMongoConfig()) {
    return sendMessageMongo(sessionId, recipients, body, senderName);
  }
  return sendMessageMemory(sessionId, recipients, body, senderName);
}
