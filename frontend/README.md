# Smart Waste — Operations Frontend

React + Vite dashboard for the Smart Waste Management backend. Talks
to the backend's REST API only (no direct DB/Kafka access, no
WebSockets) — live data is achieved by polling on a short interval.

## Stack

React 18 · Vite · Tailwind CSS · Axios · React Router · Recharts ·
React Leaflet · Lucide React.

## Setup

```bash
cp .env.example .env   # point VITE_API_BASE_URL at your backend if not localhost:4000
npm install
npm run dev             # http://localhost:5173
```

The backend must already be running (see `../New folder/README` /
`.env.example` — it defaults to `http://localhost:4000`, and its
`CORS_ORIGIN` already allows `http://localhost:5173`, so no backend
changes are needed).

For a live-feeling dashboard, also run the backend's Kafka consumer
(`npm run worker`) and the mock IoT simulator (`npm run mock:iot`) —
otherwise every page will load successfully but show empty states
(there's simply no data yet), which is expected and handled.

## Structure

```
src/
├── api/          Centralized Axios client + one module per backend resource
├── hooks/        useApi (data/loading/error), usePolling (interval refetch)
├── components/
│   ├── layout/   Sidebar, TopBar, AppShell
│   ├── ui/       Card, Badge, StatCard, Loading/Error/Empty states
│   ├── charts/   Recharts-based fill distribution & telemetry history
│   ├── map/      React Leaflet bin-location map
│   ├── bins/, alerts/, collection/   Feature-specific tables/panels
├── pages/        DashboardPage, BinsPage, BinDetailPage, CollectionPage, AlertsPage
└── utils/        Status/priority color maps, date/number formatters
```

## Design notes

- **No fields were invented.** Every field this UI reads was
  confirmed against the backend's actual controllers/models before
  being used — see the response shapes documented in each `src/api/*.js`
  module.
- **Polling, not WebSockets.** `usePolling` refetches every
  `VITE_POLL_INTERVAL_MS` (default 10s), pausing while the browser
  tab is hidden. The route-optimization panel is a deliberate
  exception — it calls an external service on every request, so it's
  only fetched on mount and on manual "Regenerate", never on an
  interval.
- **Dashboard's "Critical Bins"** maps to the backend's
  `fillStatus: 'full'` bin category — the backend's own
  `dashboard.service.js` documents this same mapping; there is no
  separate, stricter "critical" tier.
- Every data view handles loading, error (with retry), and empty
  states explicitly — nothing renders a blank page or an unhandled
  crash on an API failure.

## Known limitation of this build

This was built without network access to actually run
`npm install`/`npm run build`/`npm run dev` — every file was written
by hand against the real API contracts and checked for syntax and
bracket-balance, but **not actually compiled**. Run `npm install &&
npm run build` before relying on this; if the build surfaces an
error, it's most likely a small typo, not a structural issue.
