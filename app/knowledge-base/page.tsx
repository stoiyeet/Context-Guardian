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

  return (
    <>
      <header className="kb-article-header">
        <p className="kb-chip">Slack</p>
        <h1>{artifact.title}</h1>
        <p className="kb-subtle">#{artifact.channel}</p>
      </header>

      <div className="kb-slack-thread">
        {Object.entries(groupedByDate).map(([dateLabel, messages]) => (
          <section key={dateLabel} className="kb-message-group">
            <p className="kb-date-divider">{dateLabel}</p>
            {messages.map((message) => (
              <article key={message.id} className="kb-message-row">
                <div className="kb-avatar">{initials(message.sender)}</div>
                <div className="kb-message-body">
                  <p className="kb-message-meta">
                    <span>{message.sender}</span>
                    <span>{message.role}</span>
                    <span>{new Date(message.timestamp).toLocaleTimeString("en-US")}</span>
                  </p>
                  <p className="kb-message-text">{message.body}</p>
                </div>
              </article>
            ))}
          </section>
        ))}
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
