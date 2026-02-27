export type KnowledgeSourceType = "slack" | "jira" | "postmortem";

export type SlackMessage = {
  id: string;
  sender: string;
  role: string;
  timestamp: string;
  dateLabel: string;
  body: string;
};

export type SlackConversationArtifact = {
  id: string;
  type: "slack";
  title: string;
  channel: string;
  messages: SlackMessage[];
};

export type JiraComment = {
  id: string;
  author: string;
  role: string;
  timestamp: string;
  body: string;
};

export type JiraArtifact = {
  id: string;
  type: "jira";
  title: string;
  ticketKey: string;
  status: "Resolved";
  owner: string;
  createdAt: string;
  resolvedAt: string;
  summary: string;
  technicalDescription: string;
  comments: JiraComment[];
};

export type PostMortemSection = {
  heading: string;
  body: string;
};

export type PostMortemArtifact = {
  id: string;
  type: "postmortem";
  title: string;
  author: string;
  publishedAt: string;
  sections: PostMortemSection[];
};

export type KnowledgeArtifact =
  | SlackConversationArtifact
  | JiraArtifact
  | PostMortemArtifact;

const slackConversation: SlackConversationArtifact = {
  id: "slack-nov-2024",
  type: "slack",
  title: "#ops-transfers-incidents | Nov 2024 CUSIP thread",
  channel: "ops-transfers-incidents",
  messages: [
    {
      id: "m1",
      sender: "Sarah Jenkins",
      role: "Ops",
      timestamp: "2024-11-18T09:14:00-05:00",
      dateLabel: "Nov 18, 2024",
      body: "morning - transfers are getting stuck again after the Rogers/Shaw thing. same weird reject, no clean reason in queue view",
    },
    {
      id: "m2",
      sender: "Dan Smith",
      role: "Eng",
      timestamp: "2024-11-18T09:16:00-05:00",
      dateLabel: "Nov 18, 2024",
      body: "can you drop ticket IDs? i need samples before i poke validator logs",
    },
    {
      id: "m3",
      sender: "Sarah Jenkins",
      role: "Ops",
      timestamp: "2024-11-18T09:18:00-05:00",
      dateLabel: "Nov 18, 2024",
      body: "i don't have IDs handy yet, queue is a mess rn. seeing mainly TFSA transfers though.",
    },
    {
      id: "m4",
      sender: "Marcus T.",
      role: "Compliance",
      timestamp: "2024-11-18T09:22:00-05:00",
      dateLabel: "Nov 18, 2024",
      body: "CUSIP reassignments during mergers can break matching if one side migrated earlier. that edge case is legit, not a surprise tbh",
    },
    {
      id: "m5",
      sender: "Dan Smith",
      role: "Eng",
      timestamp: "2024-11-18T10:01:00-05:00",
      dateLabel: "Nov 18, 2024",
      body: "found one in logs. reject is mid-flight when receiving broker expects new CUSIP and we still pass old Shaw id. filing OPS-8492 now",
    },
    {
      id: "m6",
      sender: "Dan Smith",
      role: "Eng",
      timestamp: "2024-11-18T10:11:00-05:00",
      dateLabel: "Nov 18, 2024",
      body: "temp fix: manual remap + compliance sign-off before retry. long-term we should validate CUSIP freshness pre-transfer",
    },
    {
      id: "m7",
      sender: "Marcus T.",
      role: "Compliance",
      timestamp: "2024-11-18T10:14:00-05:00",
      dateLabel: "Nov 18, 2024",
      body: "confirming sign-off path, this falls under corporate action identifier continuity requirement. document each remap in ticket notes",
    },
    {
      id: "m8",
      sender: "Sarah Jenkins",
      role: "Ops",
      timestamp: "2024-11-18T10:33:00-05:00",
      dateLabel: "Nov 18, 2024",
      body: "client account cleared after remap + retry. thanks. someone pls write this up before we forget the details again",
    },
  ],
};

const jiraTicket: JiraArtifact = {
  id: "jira-ops-8492",
  type: "jira",
  title: "ATON transfer failures post-Rogers/Shaw merger - CUSIP identifier change",
  ticketKey: "OPS-8492",
  status: "Resolved",
  owner: "Dan Smith",
  createdAt: "2024-11-18T10:04:00-05:00",
  resolvedAt: "2024-11-19T15:42:00-05:00",
  summary:
    "Inbound and outbound ATON transfers intermittently fail when payload still references legacy Shaw CUSIP while receiving institution has already migrated to post-merger identifier.",
  technicalDescription:
    "Transfer validator accepts legacy CUSIP at intake, but downstream handoff compares against broker-side active instrument map. During Rogers/Shaw merger window, legacy->new identifier mapping is inconsistent across rails, causing mid-flight rejection (ERR_739_CUSIP_MISMATCH). Temporary mitigation is manual remap plus compliance note. Permanent fix requires pre-transfer CUSIP freshness validation against corporate actions table.",
  comments: [
    {
      id: "j1",
      author: "Marcus T.",
      role: "Compliance",
      timestamp: "2024-11-18T11:06:00-05:00",
      body: "Compliance sign-off approved for manual remap workflow if each case logs reason + source merger event.",
    },
    {
      id: "j2",
      author: "Sarah Jenkins",
      role: "Ops",
      timestamp: "2024-11-19T09:37:00-05:00",
      body: "Confirmed impacted client acct resolved this morning after remap/retry. no further rejects in queue so far.",
    },
  ],
};

const postMortem: PostMortemArtifact = {
  id: "postmortem-cusip-2024-11",
  type: "postmortem",
  title: "ATON Transfer Failure - Corporate Action CUSIP Reassignment (November 2024)",
  author: "Dan Smith",
  publishedAt: "2024-11-22",
  sections: [
    {
      heading: "What happened",
      body: "Multiple TFSA transfer requests were ingested successfully but failed downstream when receiving brokers validated against the post-merger CUSIP set. Operators saw this as sporadic transfer stalls and generic rejects in queue views.",
    },
    {
      heading: "Root cause",
      body: "Our intake path allowed legacy Shaw CUSIP values without checking whether the receiving rail had already switched to Rogers-linked identifiers. This mismatch surfaced late in the transfer pipeline, so the failure looked random from operations.",
    },
    {
      heading: "Resolution steps",
      body: "Engineering filed OPS-8492, added manual remap instructions, and required compliance sign-off for each remap. Operations retried transfers after remap and documented each case in ticket audit notes.",
    },
    {
      heading: "Prevention note",
      body: "Add pre-transfer CUSIP validation against corporate-action mappings before handoff. If identifier drift is detected, block early and produce a deterministic remediation path instead of failing mid-flight.",
    },
  ],
};

const knowledgeArtifacts: KnowledgeArtifact[] = [
  slackConversation,
  jiraTicket,
  postMortem,
];

export function listKnowledgeArtifacts(): KnowledgeArtifact[] {
  return knowledgeArtifacts;
}

export function getKnowledgeArtifact(id: string): KnowledgeArtifact | undefined {
  return knowledgeArtifacts.find((artifact) => artifact.id === id);
}
