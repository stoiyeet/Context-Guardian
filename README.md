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

## Ingest Events From Another Terminal

The left panel is driven by HTTP ingest calls, not an in-app timer.

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"rawError":"ERR_739_CUSIP_MISMATCH"}'
```

You can also send optional metadata overrides:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{
    "ticketId":"OPS-9500",
    "rawError":"ERR_401_ATON_REJECT_DEALERCODE",
    "accountType":"RRSP",
    "product":"ATON Inbound Transfer",
    "severity":"High"
  }'
```

The dashboard polls `GET /api/events` and animates new cards into the stream.

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
