#!/usr/bin/env node
import 'dotenv/config';


import { randomUUID } from "node:crypto";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "context_guardian";
const sessionId = process.env.CG_SESSION_ID ?? process.env.SESSION_ID ?? "cg-demo-session";
const wipeSession = process.argv.includes("--wipe");

if (!uri) {
  console.error("Missing MONGODB_URI. Set it in your env before running this script.");
  process.exit(1);
}

/**
 * Match app behavior so recipientKey aligns with /api/messages storage.
 */
function normalizeRecipients(recipients) {
  return [...recipients]
    .map((recipient) => ({
      ...recipient,
      name: recipient.name.trim(),
      role: recipient.role.trim(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function recipientKeyFor(recipients) {
  return normalizeRecipients(recipients)
    .map((recipient) => recipient.id)
    .join("|");
}

function minutesAgo(baseMs, minutes) {
  return new Date(baseMs - minutes * 60_000).toISOString();
}

const PEOPLE = {
  sarah: {
    id: "sarah-jenkins",
    name: "Sarah Jenkins",
    role: "Senior Ops Analyst",
    status: "Active",
  },
  raj: {
    id: "raj-khoury",
    name: "Raj Khoury",
    role: "Engineering Manager",
    status: "Active",
  },
  priya: {
    id: "priya-nair",
    name: "Priya Nair",
    role: "Junior Ops Analyst",
    status: "Active",
  },
  chloe: {
    id: "chloe-park",
    name: "Chloe Park",
    role: "Staff Software Engineer",
    status: "Active",
  },
  mateo: {
    id: "mateo-ruiz",
    name: "Mateo Ruiz",
    role: "Site Reliability Engineer",
    status: "Active",
  },
  aisha: {
    id: "aisha-rahman",
    name: "Aisha Rahman",
    role: "Regulatory Counsel",
    status: "Active",
  },
  nina: {
    id: "nina-patel",
    name: "Nina Patel",
    role: "Reconciliation Analyst",
    status: "Active",
  },
  dev: {
    id: "dev-chatterjee",
    name: "Dev Chatterjee",
    role: "Platform Engineer",
    status: "Active",
  },
  liam: {
    id: "liam-oconnell",
    name: "Liam O'Connell",
    role: "Transfer Operations Specialist",
    status: "Active",
  },
};

const threads = [
  {
    label: "Sarah Jenkins",
    recipients: [PEOPLE.sarah],
    messages: [
      {
        senderName: "You",
        body: "Quick check: we paused OPS-9701 at final authorization pending compliance note. Can you confirm if queue annotations are complete?",
      },
      {
        senderName: "Sarah Jenkins",
        body: "Yes, annotations are in place and the hold reason is explicit. I still want compliance confirmation before release.",
      },
      {
        senderName: "You",
        body: "Perfect. If compliance confirms, I will authorize and attach the audit trace to the ticket.",
      },
      {
        senderName: "Sarah Jenkins",
        body: "Sounds good. Please include the queue event IDs in the note so night shift has full context.",
      },
    ],
  },
  {
    label: "Raj + Sarah",
    recipients: [PEOPLE.raj, PEOPLE.sarah],
    messages: [
      {
        senderName: "You",
        body: "Need a fast decision on whether we run the mitigation now or wait for full replay data.",
      },
      {
        senderName: "Raj Khoury",
        body: "Do not wait for full replay. If risk is bounded, run scoped mitigation and monitor closely.",
      },
      {
        senderName: "Sarah Jenkins",
        body: "Ops can execute in 10 minutes. We just need the compliance note attached before final authorize.",
      },
      {
        senderName: "You",
        body: "Understood. I will execute scoped payload first, then authorize after compliance note is attached.",
      },
      {
        senderName: "Raj Khoury",
        body: "Proceed. Post a short update with outcome and residual risk.",
      },
    ],
  },
  {
    label: "Priya Nair",
    recipients: [PEOPLE.priya],
    messages: [
      {
        senderName: "You",
        body: "Can you pull the latest runbook snippet you used for FHSA handling and paste it in DOC-114 comments?",
      },
      {
        senderName: "Priya Nair",
        body: "Yep, I used the interim checklist not the old Confluence page. I will paste exact links in DOC-114 now.",
      },
      {
        senderName: "You",
        body: "Great, and add the timestamped Slack reference so retrieval can link it cleanly.",
      },
      {
        senderName: "Priya Nair",
        body: "Done. Added links and noted which one is canonical.",
      },
    ],
  },
  {
    label: "Chloe + Mateo",
    recipients: [PEOPLE.chloe, PEOPLE.mateo],
    messages: [
      {
        senderName: "You",
        body: "Seeing CAS timeout spikes and parser drift symptoms together on OPS-9601.",
      },
      {
        senderName: "Chloe Park",
        body: "Parser diff confirmed on retry path. Normalization output is not stable across retries.",
      },
      {
        senderName: "Mateo Ruiz",
        body: "From SRE side, CAS latency is elevated and retry fanout is amplifying queue pressure.",
      },
      {
        senderName: "You",
        body: "Thanks both. Can you post a go/no-go for tonight after parser patch + retry cap checks complete?",
      },
      {
        senderName: "Chloe Park",
        body: "Go from engineering if retry cap is enabled first. I will post patch hash in INFRA-566 follow-up.",
      },
      {
        senderName: "Mateo Ruiz",
        body: "Go from SRE with 15-minute rollback guardrail and queue-depth alerts on.",
      },
    ],
  },
  {
    label: "Aisha + Nina",
    recipients: [PEOPLE.aisha, PEOPLE.nina],
    messages: [
      {
        senderName: "You",
        body: "Need confirmation on compliance + reconciliation sequencing for a likely over-contribution hold.",
      },
      {
        senderName: "Aisha Rahman",
        body: "Correct sequence is CRA packet first, then release only after explicit compliance completion note is attached.",
      },
      {
        senderName: "Nina Patel",
        body: "From reconciliation side, I also want the ledger note to confirm no unauthorized fund movement.",
      },
      {
        senderName: "You",
        body: "Perfect. I will use that wording in the audit log and attach both references.",
      },
      {
        senderName: "Aisha Rahman",
        body: "Approved. That wording is compliant.",
      },
    ],
  },
  {
    label: "Dev + Liam",
    recipients: [PEOPLE.dev, PEOPLE.liam],
    messages: [
      {
        senderName: "You",
        body: "Can one of you confirm the latest validator branch notes are linked on INFRA-602?",
      },
      {
        senderName: "Dev Chatterjee",
        body: "Yes, I linked branch notes and added the architecture map draft in INFRA-602.",
      },
      {
        senderName: "Liam O'Connell",
        body: "Ops still needs a short plain-language summary. Current note is too implementation-heavy for triage.",
      },
      {
        senderName: "You",
        body: "Good call. I will open a small follow-up doc task and link it from DOC-114 for ops visibility.",
      },
      {
        senderName: "Dev Chatterjee",
        body: "Works for me. I will add a concise decision tree section tonight.",
      },
    ],
  },
];

async function main() {
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("message_threads");

  try {
    if (wipeSession) {
      const wipeResult = await collection.deleteMany({ sessionId });
      console.log(
        `[seed-messages] wiped ${wipeResult.deletedCount} existing thread(s) for session ${sessionId}`,
      );
    }

    const nowMs = Date.now();
    let insertedThreads = 0;
    let appendedThreads = 0;
    let totalMessages = 0;

    for (let threadIndex = 0; threadIndex < threads.length; threadIndex += 1) {
      const seed = threads[threadIndex];
      const normalizedRecipients = normalizeRecipients(seed.recipients);
      const recipientKey = recipientKeyFor(normalizedRecipients);
      const existing = await collection.findOne({ sessionId, recipientKey });

      const messages = seed.messages.map((entry, messageIndex) => ({
        id: randomUUID(),
        senderName: entry.senderName,
        body: entry.body,
        sentAt: minutesAgo(
          nowMs,
          90 - threadIndex * 11 - messageIndex * 3,
        ),
      }));

      totalMessages += messages.length;

      if (existing) {
        await collection.updateOne(
          { _id: existing._id },
          {
            $set: {
              recipients: normalizedRecipients,
              updatedAt: messages[messages.length - 1]?.sentAt ?? new Date().toISOString(),
            },
            $push: {
              messages: { $each: messages },
            },
          },
        );
        appendedThreads += 1;
        continue;
      }

      const createdAt = messages[0]?.sentAt ?? new Date().toISOString();
      await collection.insertOne({
        _id: new ObjectId(),
        sessionId,
        recipientKey,
        recipients: normalizedRecipients,
        messages,
        createdAt,
        updatedAt: messages[messages.length - 1]?.sentAt ?? createdAt,
      });
      insertedThreads += 1;
    }

    console.log(`[seed-messages] session=${sessionId}`);
    console.log(
      `[seed-messages] inserted=${insertedThreads}, appended=${appendedThreads}, messages=${totalMessages}`,
    );
    console.log(
      "[seed-messages] done. Open /messages in a browser session using the same cg_session_id cookie.",
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("[seed-messages] failed:", error);
  process.exit(1);
});
