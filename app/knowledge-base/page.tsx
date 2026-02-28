import Link from "next/link";
import AutoFocusTarget from "@/components/knowledge-base/auto-focus-target";
import {
  type JiraArtifact,
  type KnowledgeArtifact,
  type PostMortemArtifact,
  type SlackConversationArtifact,
  listKnowledgeArtifacts,
} from "@/lib/knowledgeBase";

type KnowledgeBasePageProps = {
  searchParams?: {
    artifact?: string;
    message?: string;
    entry?: string;
  };
};

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function renderSlack(artifact: SlackConversationArtifact, highlightedMessageId?: string) {
  const groupedByDate = artifact.messages.reduce<Record<string, typeof artifact.messages>>(
    (acc, message) => {
      if (!acc[message.dateLabel]) {
        acc[message.dateLabel] = [];
      }
      acc[message.dateLabel].push(message);
      return acc;
    },
    {},
  );

  return (
    <>
      <header className="kb-article-header">
        <p className="kb-chip">Slack</p>
        <h1>#{artifact.channel}</h1>
        <p className="kb-subtle">{artifact.title}</p>
      </header>

      <section className="kb-slack-app">
        <div className="kb-slack-topbar">
          <p>
            <strong>FinOps Ops Workspace</strong>
            <span>Thread replay | read-only</span>
          </p>
          <p>{artifact.messages.length} messages</p>
        </div>

        <div className="kb-slack-feed-scroll">
          {Object.entries(groupedByDate).map(([dateLabel, messages]) => (
            <section key={dateLabel} className="kb-message-group">
              <p className="kb-date-divider">{dateLabel}</p>
              {messages.map((message) => {
                const isHighlighted = highlightedMessageId === message.id;

                return (
                  <article
                    key={message.id}
                    id={message.id}
                    className={`kb-slack-message ${isHighlighted ? "kb-target-entry" : ""}`}
                  >
                    <div className="kb-avatar">{initials(message.sender)}</div>
                    <div className="kb-slack-message-body">
                      <p className="kb-slack-message-meta">
                        <span className="name">{message.sender}</span>
                        <span className="role">{message.role}</span>
                        <span className="time">
                          {new Date(message.timestamp).toLocaleTimeString("en-US")}
                        </span>
                      </p>
                      <p className="kb-message-text">{message.body}</p>
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      </section>
    </>
  );
}

function renderJira(artifact: JiraArtifact, highlightedEntry?: string) {
  return (
    <>
      <header className="kb-article-header">
        <p className="kb-chip">Jira</p>
        <h1>{artifact.ticketKey}</h1>
        <p className="kb-subtle">{artifact.title}</p>
      </header>

      <section className="kb-jira-meta">
        <p>
          <span>Status</span>
          <strong>{artifact.status}</strong>
        </p>
        <p>
          <span>Owner</span>
          <strong>{artifact.owner}</strong>
        </p>
        <p>
          <span>Resolved</span>
          <strong>{new Date(artifact.resolvedAt).toLocaleDateString("en-US")}</strong>
        </p>
      </section>

      <section className="kb-jira-content">
        <h2>Summary</h2>
        <p>{artifact.summary}</p>
        <h2>Technical Description</h2>
        <p>{artifact.technicalDescription}</p>
      </section>

      <section className="kb-comments">
        <h2>Comments</h2>
        {artifact.comments.map((comment) => (
          <article
            key={comment.id}
            id={comment.id}
            className={`kb-comment-row ${highlightedEntry === comment.id ? "kb-target-entry" : ""}`}
          >
            <p className="kb-comment-meta">
              <span>{comment.author}</span>
              <span>{comment.role}</span>
              <span>{new Date(comment.timestamp).toLocaleString("en-US")}</span>
            </p>
            <p>{comment.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function renderPostMortem(artifact: PostMortemArtifact) {
  return (
    <>
      <header className="kb-article-header">
        <p className="kb-chip">Post-Mortem</p>
        <h1>{artifact.title}</h1>
        <p className="kb-subtle">
          {artifact.author} | {new Date(artifact.publishedAt).toLocaleDateString("en-US")}
        </p>
      </header>

      <section className="kb-postmortem-body">
        {artifact.sections.map((section) => (
          <article key={section.heading} className="kb-doc-section">
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function renderArtifact(
  artifact: KnowledgeArtifact,
  highlightedMessageId?: string,
  highlightedEntry?: string,
) {
  if (artifact.type === "slack") {
    return renderSlack(artifact, highlightedMessageId);
  }

  if (artifact.type === "jira") {
    return renderJira(artifact, highlightedEntry);
  }

  return renderPostMortem(artifact);
}

export default function KnowledgeBasePage({ searchParams }: KnowledgeBasePageProps) {
  const artifacts = listKnowledgeArtifacts();
  const slackArtifacts = artifacts.filter(
    (artifact): artifact is SlackConversationArtifact => artifact.type === "slack",
  );
  const infraArtifacts = artifacts.filter(
    (artifact): artifact is JiraArtifact => artifact.type === "jira",
  );
  const postMortemArtifacts = artifacts.filter(
    (artifact): artifact is PostMortemArtifact => artifact.type === "postmortem",
  );
  const selectedArtifactId = searchParams?.artifact;
  const highlightedMessageId = searchParams?.message;
  const highlightedEntry = searchParams?.entry;
  const selectedArtifact =
    artifacts.find((artifact) => artifact.id === selectedArtifactId) ??
    slackArtifacts[0] ??
    infraArtifacts[0] ??
    postMortemArtifacts[0] ??
    null;

  if (!selectedArtifact) {
    return null;
  }

  return (
    <main className="kb-page">
      <AutoFocusTarget targetId={highlightedMessageId || highlightedEntry} />
      <header className="kb-topbar">
        <Link href="/" className="kb-back-main">
          Back To Dashboard
        </Link>
      </header>

      <section className="kb-layout">
        <aside className="kb-sidebar">
          <section className="kb-group">
            <p className="kb-group-title">Slack Conversations</p>
            {slackArtifacts.map((artifact) => (
              <Link
                key={artifact.id}
                href={`/knowledge-base?artifact=${artifact.id}`}
                className={`kb-artifact-link ${artifact.id === selectedArtifact.id ? "active" : ""}`}
              >
                <span className="kb-mini-badge">SLK</span>
                <span>#{artifact.channel}</span>
              </Link>
            ))}
          </section>

          <section className="kb-group">
            <p className="kb-group-title">Infra Tickets</p>
            {infraArtifacts.map((artifact) => (
              <Link
                key={artifact.id}
                href={`/knowledge-base?artifact=${artifact.id}`}
                className={`kb-artifact-link ${artifact.id === selectedArtifact.id ? "active" : ""}`}
              >
                <span className="kb-mini-badge">INF</span>
                <span>{artifact.ticketKey}</span>
              </Link>
            ))}
          </section>

          <section className="kb-group">
            <p className="kb-group-title">Post-Mortems</p>
            {postMortemArtifacts.map((artifact) => (
              <Link
                key={artifact.id}
                href={`/knowledge-base?artifact=${artifact.id}`}
                className={`kb-artifact-link ${artifact.id === selectedArtifact.id ? "active" : ""}`}
              >
                <span className="kb-mini-badge">PM</span>
                <span>{artifact.title}</span>
              </Link>
            ))}
          </section>
        </aside>

        <article id={selectedArtifact.id} className="kb-main-single kb-article kb-highlight-target">
          {renderArtifact(selectedArtifact, highlightedMessageId, highlightedEntry)}
        </article>
      </section>
    </main>
  );
}
