# emberhold-server

Realtime server for PvP (and later co-op). Phase 6.0 skeleton: `/health` and a ticket-checked WebSocket echo at `/ws`.

## Local

```bash
cd server && npm install
PVP_SECRET= npm run dev            # no secret = dev-open, no ticket needed
curl localhost:8787/health
```

Run the protocol test from the repo root while it is up:

```bash
node --experimental-strip-types --test tests/server.test.mjs
```

## Droplet (one-time)

1. Install Docker + compose plugin, clone the repo to `/opt/emberhold`.
2. `cp server/.env.example server/.env` and fill `PVP_SECRET`, `ORIGIN`, `MONGODB_URI`, `PVP_DOMAIN`.
3. Point a DNS name (or `<ip-with-dashes>.sslip.io`) at the droplet for `PVP_DOMAIN`; open ports 80/443.
4. `docker compose -f server/docker-compose.yml up -d --build`

## Deploy

`.github/workflows/deploy-server.yml` runs on pushes to `main` that touch `server/**` or `lib/game/**`. It needs repository secrets `DO_HOST`, `DO_USER`, `DO_SSH_KEY` (private key whose public half is in the droplet's `~/.ssh/authorized_keys`).
