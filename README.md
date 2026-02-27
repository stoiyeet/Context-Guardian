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

## Data Model

Phase 1 dummy data is defined in:

- `lib/dummyData.ts`

It contains 5 seeded tickets, including hero case `ERR_739_CUSIP_MISMATCH` with TFSA transfer + Shaw/Rogers merger context.

## Phase 2 Integration Hooks (Architected, Not Implemented)

- `app/api/ingest/route.ts` has `// PHASE 2: LLM INTEGRATION POINT` for replacing dummy blueprint generation with structured LLM inference.
- `lib/ticketStore.ts` exposes `getSemanticNeighbors(ticketId)` placeholder for vector DB evidence retrieval.
- `lib/eventStreamClient.ts` centralizes stream transport so polling can be swapped for SSE/WebSocket.
