import type { SmeStatus } from "@/lib/types";

export type MessageRecipient = {
  id: string;
  name: string;
  role: string;
  status: SmeStatus;
};

export type InternalMessage = {
  id: string;
  senderName: string;
  body: string;
  sentAt: string;
};

export type MessageThread = {
  id: string;
  sessionId: string;
  recipientKey: string;
  recipients: MessageRecipient[];
  messages: InternalMessage[];
  createdAt: string;
  updatedAt: string;
};
