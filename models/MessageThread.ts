import { Schema, model, models, type Model } from "mongoose";
import type { InternalMessage, MessageRecipient } from "@/lib/messageTypes";

export type MessageThreadModelType = {
  sessionId: string;
  recipientKey: string;
  recipients: MessageRecipient[];
  messages: InternalMessage[];
  createdAt: string;
  updatedAt: string;
};

const recipientSchema = new Schema<MessageRecipient>(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    status: { type: String, required: true, enum: ["Active", "Departed"] },
  },
  { _id: false },
);

const messageSchema = new Schema<InternalMessage>(
  {
    id: { type: String, required: true, trim: true },
    senderName: { type: String, required: true },
    body: { type: String, required: true },
    sentAt: { type: String, required: true },
  },
  { _id: false },
);

const messageThreadSchema = new Schema<MessageThreadModelType>(
  {
    sessionId: { type: String, required: true, trim: true },
    recipientKey: { type: String, required: true, trim: true },
    recipients: { type: [recipientSchema], required: true, default: [] },
    messages: { type: [messageSchema], required: true, default: [] },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  {
    collection: "message_threads",
    versionKey: false,
  },
);

messageThreadSchema.index({ sessionId: 1, updatedAt: -1 });
messageThreadSchema.index({ sessionId: 1, recipientKey: 1 }, { unique: true });

export const MessageThreadModel =
  (models.MessageThread as Model<MessageThreadModelType>) ||
  model<MessageThreadModelType>("MessageThread", messageThreadSchema);
