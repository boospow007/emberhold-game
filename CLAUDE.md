# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Emberhold: a portrait, one-handed, endless co-op base-defense game. Three.js renders the world, a Next.js-style app (via `vinext`) serves it, and a single Cloudflare Worker route backed by D1 handles profiles, rooms, and rewards. UI copy is Thai (`<html lang="th">`); code and identifiers are English. See README.md for gameplay and co-op semantics.

## Commands

Node >= 22.13 is required (tests rely on `--experimental-strip-types` to import `.ts` directly).

```bash
npm run dev -- --host 0.0.0.0      # vinext dev server on :3000 with local Miniflare D1
npm run build                      # vinext build -> dist/
npm run start                      # wrangler dev against dist/server/wrangler.json
npx tsc --noEmit                   # typecheck (no separate typecheck script)
npm run lint                       # oxlint, type-aware (see .oxlintrc.json)
npm run format                     # oxfmt (single quotes, printWidth 80)
npm run db:generate                # drizzle-kit generate -> drizzle/*.sql
```

Tests use `node:test`, no test runner package:

```bash
node --experimental-strip-types --test tests/engine.test.mjs tests/terrain.test.mjs tests/units.test.mjs tests/length.test.mjs   # pure engine, no server
node --experimental-strip-types --test tests/coop.test.mjs                            # needs dev server running
```

Engine files import each other with explicit `.ts` extensions (`./terrain.ts`) because Node's type stripping needs them; `allowImportingTsExtensions` is on in tsconfig.

Run a single test with `--test-name-pattern`:

```bash
node --experimental-strip-types --test --test-name-pattern="respawns" tests/engine.test.mjs
```

`coop.test.mjs` hits `/api/game` at `GAME_TEST_ORIGIN` (default `http://localhost:3000`), creates real anonymous profiles, and cleans up its room. Dev only.

Local D1 state lives in `.wrangler/state/v3/d1`. The `drizzle/*.sql` migrations must be applied there before the API works; Sites applies them automatically on deploy. There is no migrations table locally, so apply a new migration directly to the Miniflare SQLite file (`wrangler d1 execute` with `dist/server/wrangler.json` targets a different persist path and will not work):

```bash
sed 's/--> statement-breakpoint//g' drizzle/0004_smooth_avengers.sql | sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
```

The Worker bindings (D1 as `DB`) are declared inline in `vite.config.ts` from `.openai/hosting.json`, not in a root `wrangler.toml`.

## Architecture

The game is split into four layers that must stay separate:

**`lib/game/terrain.ts` generates the world from a seed.** Heightmap (water / plain / hill / mountain), river with fords, lakes, and obstacle placement all derive from `(seed, map)` with a deterministic PRNG. Heights are never serialized: `terrainOf()` caches them per client, and only the mutable obstacle list travels in the `World`. Never use `Math.random` in generation code.

**`lib/game/engine.ts` is the authoritative, pure simulation.** It has no React, DOM, or Three.js imports and is what the tests exercise. Key exports: `newWorld`, `addPlayer`, `command`, `canBuild`, `startWave`, `step(world, inputs, dt)`, `reward`, plus the `MAPS`, `BUILDINGS` and `UNITS` data tables. Soldiers live in `world.units`, belong to a barracks (`home`), and are either `hold` (guarding a post) or `follow` (in a player's squad, capped by `player.stack`); `rally`/`release` commands are allowed in battle, build/upgrade are prep-only. `world.days` (0 = endless) sets the final night; surviving it sets `won` and ends the run, and `daysSurvived()`/`reward()` are the only places that should compute score. Solo runs autosave to `localStorage` (`emberhold:save:<profileId>`) at the start of every prep phase via `Game`'s `onSave` prop. `command()` returns an empty string on success or a Thai error message on rejection; callers show that string as a toast. The `World` object is plain JSON so it can be serialized as a room snapshot.

**`lib/game/scene.ts` is render-only.** `GameScene` builds Three.js meshes from a `World` each frame via `render(world, localId, placement)`. It never mutates game state. It also owns pointer-to-world raycasting (`point`) and cleanup (`dispose`).

**`app/api/game/route.ts` is the entire backend.** One `POST` handler dispatching on `body.action`: `profile`, `name`, `purchase`, `list`, `create`, `join`, `solo-reward`, `claim`, `leave`, `sync`, `lobby`. `seeds`, `seed-save`, `seed-delete` manage saved map seeds. It uses raw D1 prepared statements through `db/raw.ts`. `db/index.ts` (drizzle client) exists but is unused at runtime; `db/schema.ts` exists so `drizzle-kit generate` can produce migrations. If you change the schema, update `db/schema.ts`, regenerate, and keep the raw SQL in the route in sync by hand.

`lib/game/api.ts` is the typed client wrapper (`api('action', data)`) with a 10s timeout; its `Results` map is the contract between client and route.

### Co-op model (host-authoritative over HTTP polling)

- Identity is an anonymous `ember_session` HttpOnly cookie. The profile id is the SHA-256 hex of the cookie value, so the same token always maps to the same row. There is no login.
- `app/Game.tsx` runs the render loop for everyone but only calls `engine.step()` when `host` is true (solo play or room host). Guests never simulate; they replace `world.current` with the host's snapshot on every `sync`.
- Every ~180ms each client POSTs `sync` with its `Input` (`x`, `z` in [-1,1] plus a queue of sequenced `Command`s). The host additionally uploads the full `World` snapshot. The route stores inputs per member and the snapshot per room; the response returns all members' inputs (used by the host) and the snapshot (used by guests).
- Commands carry a monotonically increasing `seq`. The engine records `world.acks[playerId]`, and guests drop queued commands with `seq <= ack`, which is what makes replication exactly-once. Never process a command without updating `acks`.
- Only the host's snapshot is accepted; guest snapshots are ignored server-side. Room liveness is the `rooms.updated` heartbeat (45s timeout) and per-member `online` is `updated` within 3s.
- Rewards are rows in `rewards` keyed `run + profileId`; `solo-reward` and `claim` are idempotent through `INSERT OR IGNORE` plus a `claimed` flag. Preserve this when touching reward logic.

### Frontend

- `app/page.tsx` is the lobby/camp screen (weapon and map pick, room create/join/list, Ember shop). It mounts `app/Game.tsx` with a `Session` once a run starts. Both are `'use client'`.
- `Game.tsx` keeps the live `World` in a ref and throttles a copy into React state (`setHud`) about every 90ms; do not put the world itself in state.
- `components/ui/*` is a stock shadcn (base-nova style, `@base-ui/react`) install; only a few pieces (Tabs, Dialog, etc.) are used. Styling for the game itself is hand-written in `app/globals.css`, not Tailwind utility classes.

## Documentation rule

Every code change or addition must be accompanied by a new file in `doc/`, named `YYYY-MM-DD-<topic>.md`, following the template in `doc/README.md` (what changed, why, impact, how to test). Add a row to the index table in `doc/README.md` as well. Write these entries in Thai to match the existing docs. Do this in the same change, not as a follow-up.

## Deployment notes

This project is built for OpenAI Sites hosting (`@openai/sites-vite-plugin`, `.openai/hosting.json`). `vinext` replaces the Next.js runtime; `next.config.ts` is a stub kept for compatibility. `.next/types` is generated by vinext and should not be edited.
