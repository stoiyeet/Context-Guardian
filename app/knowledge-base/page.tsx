import Link from "next/link";
import {
  type JiraArtifact,
  type KnowledgeArtifact,
  type KnowledgeSourceType,
  type PostMortemArtifact,
  type SlackConversationArtifact,
  listKnowledgeArtifacts,
} from "@/lib/knowledgeBase";

type KnowledgeBasePageProps = {
  searchParams?: {
    artifact?: string;
  };
};

const TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  slack: "Slack",
  jira: "Jira",
  postmortem: "Post-Mortems",
};

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function renderSlack(artifact: SlackConversationArtifact) {
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

  const participants = Array.from(
    new Map(artifact.messages.map((message) => [message.sender, message.role])).entries(),
  ).map(([name, role]) => ({ name, role }));

  return (
    <>
      <header className="kb-article-header">
        <p className="kb-chip">Slack</p>
        <h1>{artifact.title}</h1>
        <p className="kb-subtle">#{artifact.channel}</p>
      </header>

      <div className="kb-slack-app">
        <div className="kb-slack-toolbar">
          <div>
            <p className="kb-slack-workspace">FinOps Incident Workspace</p>
            <p className="kb-slack-channel">#{artifact.channel}</p>
          </div>
          <p className="kb-slack-count">{artifact.messages.length} messages</p>
        </div>

        <div className="kb-slack-layout">
          <aside className="kb-slack-nav">
            <p className="kb-slack-nav-title">Channels</p>
            <p className="kb-slack-nav-item active">#ops-transfers-incidents</p>
            <p className="kb-slack-nav-item">#ops-transfer-failures</p>
            <p className="kb-slack-nav-item">#clearing-escalations</p>

            <p className="kb-slack-nav-title">Participants</p>
            {participants.map((participant) => (
              <p key={participant.name} className="kb-slack-participant">
                <span>{participant.name}</span>
                <small>{participant.role}</small>
              </p>
            ))}
          </aside>

          <section className="kb-slack-feed">
            {Object.entries(groupedByDate).map(([dateLabel, messages]) => (
              <section key={dateLabel} className="kb-message-group">
                <p className="kb-date-divider">{dateLabel}</p>
                {messages.map((message) => (
                  <article key={message.id} className="kb-slack-message">
                    <div className="kb-avatar">{initials(message.sender)}</div>
                    <div className="kb-slack-message-body">
                      <p className="kb-slack-message-meta">
                        <span className="name">{message.sender}</span>
                        <span className="role">{message.role}</span>
                        <span className="time">
                          {new Date(message.timestamp).toLocaleTimeString("en-US")}
                        </span>
                      </p>
                      <div className="kb-slack-bubble">
                        <p className="kb-message-text">{message.body}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

function renderJira(artifact: JiraArtifact) {
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
          <article key={comment.id} className="kb-comment-row">
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

function renderArtifact(artifact: KnowledgeArtifact) {
  if (artifact.type === "slack") {
    return renderSlack(artifact);
  }

  if (artifact.type === "jira") {
    return renderJira(artifact);
  }

  return renderPostMortem(artifact);
}

export default function KnowledgeBasePage({ searchParams }: KnowledgeBasePageProps) {
  const artifacts = listKnowledgeArtifacts();
  const selectedId = searchParams?.artifact;
  const selectedArtifact =
    artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0] ?? null;

  const groupedArtifacts: Record<KnowledgeSourceType, KnowledgeArtifact[]> = {
    slack: artifacts.filter((artifact) => artifact.type === "slack"),
    jira: artifacts.filter((artifact) => artifact.type === "jira"),
    postmortem: artifacts.filter((artifact) => artifact.type === "postmortem"),
  };

  if (!selectedArtifact) {
    return null;
  }

  return (
    <main className="kb-shell">
      <aside className="kb-sidebar">
        <Link href="/" className="kb-back-link">
          Context Guardian
        </Link>

        {(Object.keys(groupedArtifacts) as KnowledgeSourceType[]).map((type) => (
          <section key={type} className="kb-sidebar-group">
            <p className="kb-sidebar-heading">{TYPE_LABELS[type]}</p>
            {groupedArtifacts[type].map((artifact) => (
              <Link
                key={artifact.id}
                href={`/knowledge-base?artifact=${artifact.id}#${artifact.id}`}
                className={`kb-sidebar-item ${artifact.id === selectedArtifact.id ? "active" : ""}`}
              >
                {artifact.type === "jira" ? artifact.ticketKey : artifact.title}
              </Link>
            ))}
          </section>
        ))}
      </aside>

      <section className="kb-main">
        <article id={selectedArtifact.id} className="kb-article kb-highlight-target">
          {renderArtifact(selectedArtifact)}
        </article>
      </section>
    </main>
  );
}
