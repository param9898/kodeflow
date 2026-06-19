# KodeFlow

Real-time collaborative web code editor — multiple users edit the same file at the same time with CRDT-based conflict resolution.

**Stack:** React · TypeScript · Monaco Editor · Yjs (CRDT) · Socket.IO · Node.js · Redis · Docker

## Run locally

You need: Node 20+, npm, and Docker (for Redis + server) — or you can run Redis any other way and start the server with `npm run dev`.

### 1. Start the server + Redis

```bash
cd kodeflow
docker compose up --build
```

The server is now on `http://localhost:3001`.

### 2. Start the client

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` → click **New room** → copy the URL → paste it in a second browser window (or share with a friend). Type in both — edits sync live.

### Server without Docker

```bash
# in one terminal:
redis-server                       # or: docker run -p 6379:6379 redis:7-alpine

# in another:
cd server
npm install
npm run dev
```

## How it works (short version)

```
[Browser A]                                [Browser B]
  React + Monaco                              React + Monaco
       │                                            │
     Yjs Y.Doc  ←—— y-monaco binding ——→        Yjs Y.Doc
       │                                            │
       │            Socket.IO (WebSocket)            │
       └────────────────┐         ┌──────────────────┘
                        ▼         ▼
                     Node.js + Socket.IO
                            │
                            ▼
                     Redis (pub/sub)
                  for multi-instance fan-out
```

1. User types → Monaco fires change → Yjs converts it to a CRDT operation.
2. Yjs applies it locally (instant feedback) and emits an `update` event with the binary delta.
3. Client sends the delta over Socket.IO to the server.
4. Server applies it to its room-level Y.Doc (kept as a snapshot for new joiners) and broadcasts to all other sockets in the same room.
5. The Redis adapter ensures the broadcast reaches users connected to *other* server instances too.
6. Receiving clients apply the delta via `Y.applyUpdate` → Monaco re-renders.

CRDTs guarantee that no matter what order updates arrive in, every client converges to the same final document.

## Deploy

- **Client** → Vercel: `cd client && npx vercel deploy`. Set `VITE_SERVER_URL` to your deployed server URL.
- **Server** → Fly.io / Railway / Render. Provision a managed Redis (Upstash free tier works). Set `REDIS_URL` in env.
- For horizontal scaling: run multiple server instances behind a load balancer with sticky sessions (Socket.IO requirement) and point them all at the same Redis — the adapter handles the rest.

## Next steps to flesh out

- ~~**Awareness** (live cursors + presence)~~ — done. Each client picks a name + color (editable in the room header, persisted in `localStorage`) and the server relays `y-protocols/awareness` payloads. Disconnects emit a clean `awareness-remove` so peers' cursors disappear instantly instead of waiting for the heartbeat timeout.
- **Persistence** — write each room's Y.Doc snapshot to Redis or Postgres on a debounced interval.
- **Auth** — gate room access with a JWT or simple shared key.
- **Export** — POST the room contents to GitHub Gist API.
- **Language switcher** — Monaco supports dozens; drop in a `<select>` and call `editor.getModel()?.setLanguage(...)`.
