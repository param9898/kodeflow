# Deploying KodeFlow

Server (Socket.IO + Yjs) goes on **Render**; client (Vite/React) goes on
**Vercel**. ~5 minutes end-to-end the first time.

## 1. Server — Render

1. Push this repo to GitHub (already done).
2. Go to https://render.com → **New +** → **Blueprint**.
3. Connect your GitHub if you haven't, select the **kodeflow** repo, and
   Render will read `render.yaml` and provision the `kodeflow-server`
   web service automatically.
4. First build takes ~2 minutes (`npm install && npm run build`). Once
   the status shows **Live**, copy the URL (e.g.
   `https://kodeflow-server.onrender.com`).
5. Hit `https://<your-url>/health` to confirm `{"ok":true}`.

> The free plan sleeps after 15 min of inactivity. First request after
> sleep takes ~30 sec to wake. Fine for a demo; upgrade to Starter ($7/mo)
> to remove sleep.

> **Optional Redis:** the server falls back to single-instance mode if
> Redis is unavailable. To enable multi-instance fan-out later, add a
> Render Key Value (or Upstash Redis) and set `REDIS_URL` in the
> service's env vars.

## 2. Client — Vercel

1. Go to https://vercel.com → **New Project** → import the **kodeflow**
   repo.
2. In the import step, set:
   - **Root Directory:** `client`
   - **Framework Preset:** Vite (Vercel auto-detects)
   - **Environment Variable:** `VITE_SERVER_URL` = the Render URL from
     step 1 (e.g. `https://kodeflow-server.onrender.com`)
3. Click Deploy. Vercel runs `npm install && npm run build` on the
   `client/` folder and serves the static `dist/` output.
4. Open the Vercel URL → click **New room** → share the link.

## Local development

See `README.md`.
