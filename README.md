# News Updates

A basic full-stack news app. A Node.js + Express backend pulls headlines from public RSS feeds, normalizes and caches them, and serves them to a React + Vite + TypeScript frontend. No API keys required.

```
backend/    Express API (src/app.js), RSS fetching + caching (src/news.js), feed list (src/sources.js)
frontend/   React + Vite + TypeScript SPA
```

Features: merged feed from BBC, NPR, The Guardian, NYT, TechCrunch and Hacker News, sorted newest first; filter by source; search headlines; manual refresh plus auto-refresh every 5 minutes; graceful handling when a feed is down.

## Prerequisites

- Node.js 20+

## Backend

```bash
cd backend
npm install
npm run dev      # http://localhost:8000, restarts on file changes
npm test
```

Environment variables (optional):

- `PORT`: defaults to `8000`
- `CORS_ORIGINS`: comma-separated; defaults to `http://localhost:5173`

Feeds are cached in memory for 5 minutes. To add a source, append an entry to `backend/src/sources.js`.

## Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

In development, Vite proxies `/api` to `http://localhost:8000` (override with `API_URL`).

- Production build: `npm run build`
- Lint: `npm run lint`

## API

| Method | Path           | Description |
|--------|----------------|-------------|
| GET    | `/api/health`  | Health check |
| GET    | `/api/sources` | List available sources |
| GET    | `/api/news`    | Articles, newest first. Query params: `source` (comma-separated ids), `q` (search), `limit` (1–200, default 50), `refresh=true` (bypass cache) |

`/api/news` returns `{ items, total, updatedAt, errors }`. If some feeds fail, the rest are still returned and the failures are listed in `errors`. If every requested feed fails, it returns 502.
