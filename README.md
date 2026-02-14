# Easy BullMQ + Next.js Realtime Demo

Simple TypeScript project that shows:

- **Backend:** Express + BullMQ queue/worker
- **Frontend:** Next.js UI
- **Realtime updates:** **SSE** (Server-Sent Events) showing `added`, `processing`, `progress`, and `finished`
- **Runtime persistence (no DB):** history kept in backend memory while server is running, so refresh still shows old data

## 1) Requirements

- Node.js 20+
- Redis running locally on `localhost:6379`

Quick Redis with Docker:

```bash
docker run --name demo-redis -p 6379:6379 -d redis:7
```

## 2) Install

```bash
npm install
```

## 3) Run backend + frontend

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

## 4) How to test the flow

1. Open frontend page.
2. Click **Start Job**.
3. Watch live event list update:
   - Job added
   - Job started processing
   - Progress updates
   - Job finished

## Useful API endpoints

- `POST /jobs/start` → enqueue job
- `GET /jobs/:id` → check one job status
- `GET /events` → SSE stream
- `GET /runtime-data` → in-memory events/jobs history for page refresh

## Environment variables (optional)

### Backend

- `PORT` (default `4000`)
- `REDIS_URL` (default `redis://127.0.0.1:6379`)
- `FRONTEND_ORIGIN` (default `http://localhost:3000`)

### Frontend

- `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:4000`)
