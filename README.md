# Context Guardian (Phase 1 Prototype)

Context Guardian is a Next.js 14 App Router prototype for fintech operations where every inbound event is opened as a pre-generated inference blueprint (never as raw ticket noise).

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Flow (`reactflow`)

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Set `OPENAI_API_KEY` to enable Phase 2 embeddings + synthesis (`text-embedding-3-small` + `gpt-4o`).
Without a key, the app degrades gracefully to deterministic retrieval/synthesis logic.

## Ingest Events From Another Terminal (Required Rich Context)

The left panel is driven by HTTP ingest calls, not an in-app timer.

`rawError` alone is not enough. `/api/ingest` now enforces layered process context so inference is based on failure location and state transition, not string matching.

Required payload shape:

```json
{
  "ticketId": "OPS-9500",
  "rawError": "ERR_739_CUSIP_MISMATCH",
  "accountType": "Registered - TFSA",
  "product": "ATON Outbound Transfer",
  "severity": "High",
  "context": {
    "pipelineStage": "bridge-handoff-validation",
    "attemptedAction": "bridge was mapping position identifiers before CAS handoff",
    "lastSuccessfulState": "validator accepted transfer packet and queued it for bridge",
    "sourceInstitution": "Rogers Direct",
    "existingFlags": {
      "overContributionHistory": "none",
      "amlStatus": "clear",
      "pendingReviews": ["none"]
    },
    "additionalSignals": [
      "corporate_action_window",
      "recent_custodian_schema_notice"
    ],
    "operatorNarrative": "Failure began after queue retry, not at intake."
  }
}
```

Example request:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{
    "ticketId":"OPS-9500",
    "rawError":"ERR_739_CUSIP_MISMATCH",
    "accountType":"Registered - TFSA",
    "product":"ATON Outbound Transfer",
    "severity":"High",
    "context":{
      "pipelineStage":"bridge-handoff-validation",
      "attemptedAction":"bridge was normalizing CUSIP before CAS request",
      "lastSuccessfulState":"validator accepted packet and transfer was queued",
      "sourceInstitution":"Rogers Direct",
      "existingFlags":{
        "overContributionHistory":"none",
        "amlStatus":"clear",
        "pendingReviews":[]
      },
      "additionalSignals":[
        "transfer_mid_flight",
        "custodian_identifier_migration"
      ],
      "operatorNarrative":"Looks like a mid-flight fail, not account setup."
    }
  }'
```

Validation rules (enforced by API):
- `context.pipelineStage` required, min 4 chars
- `context.attemptedAction` required, min 8 chars
- `context.lastSuccessfulState` required, min 8 chars
- `context.sourceInstitution` required
- `context.existingFlags.overContributionHistory` + `amlStatus` required strings
- `context.existingFlags.pendingReviews` required string array

The dashboard polls `GET /api/events` and animates new cards into the stream.
Each ticket blueprint now includes a readable context snapshot (stage/action/last success/source/flags) and similarity rationale so diagnosis explains *why* it matches historical cases, not just that it does.

## API Surfaces

- `POST /api/ingest`: ingest a raw event into the live stream.
- `GET /api/events`: stream snapshot used by the dashboard poller.
- `GET /api/tickets`: runs live inference and returns a `BlueprintType` response (plus inference metadata).
- `POST /api/tickets/:ticketId/authorize`: marks ticket authorized and triggers synthesized-knowledge update.

## Data Sources

- `lib/knowledgeBase.ts`: server-side knowledge artifacts (Slack thread, Jira OPS-8492, post-mortem) rendered by `/knowledge-base`.
- `lib/synthesizedKnowledge.ts`: persistent compounding memory layer (`/data/synthesizedKnowledge.json`).
- `lib/vectorUtils.ts`: local cosine similarity search with pgvector/Pinecone swap point.

## Phase 3 Hooks

- `lib/vectorUtils.ts`: swap local retrieval for pgvector/Pinecone.
- `lib/synthesizedKnowledge.ts`: move background updates to event queue (SQS/Inngest).
- `lib/synthesizedKnowledge.ts`: move pattern relationships to graph DB traversal (Neo4j).
