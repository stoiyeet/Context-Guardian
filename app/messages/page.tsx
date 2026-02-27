"use client";

import { useEffect, useMemo, useState } from "react";
import type { MessageThread } from "@/lib/messageTypes";

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/messages", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { threads: MessageThread[] };
        if (!active) {
          return;
        }
        setThreads(payload.threads ?? []);
        setSelectedThreadId((current) => current ?? payload.threads?.[0]?.id ?? null);
      } catch {
        // Keep silent for dashboard resilience.
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 2500);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  return (
    <main className="messages-shell">
      <aside className="messages-list">
        <p className="panel-eyebrow">Internal Messages</p>
        {threads.length === 0 && <p className="messages-empty">No conversation threads yet.</p>}
        {threads.map((thread) => (
          <button
            type="button"
            key={thread.id}
            className={`message-thread-card ${thread.id === selectedThreadId ? "active" : ""}`}
            onClick={() => setSelectedThreadId(thread.id)}
          >
            <p>{thread.recipients.map((recipient) => recipient.name).join(", ")}</p>
            <span>{formatTimestamp(thread.updatedAt)}</span>
          </button>
        ))}
      </aside>

      <section className="messages-thread">
        {!selectedThread ? (
          <div className="messages-empty-state">Select a thread to view messages.</div>
        ) : (
          <>
            <header className="messages-thread-header">
              <p>{selectedThread.recipients.map((recipient) => recipient.name).join(", ")}</p>
              <span>
                {selectedThread.recipients.length} recipients • {selectedThread.messages.length} messages
              </span>
            </header>

            <div className="messages-scroll">
              {selectedThread.messages.map((message) => {
                const mine = message.senderName === "You";
                return (
                  <article
                    key={message.id}
                    className={`message-bubble-row ${mine ? "mine" : "theirs"}`}
                  >
                    <div className="message-bubble">
                      <p>{message.body}</p>
                      <span>
                        {message.senderName} • {formatTimestamp(message.sentAt)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
