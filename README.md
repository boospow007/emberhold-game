# Emberhold

A playable Three.js prototype of a portrait, one-handed, endless co-op base-defense game.

## Play

Choose one of three weapons and maps. Drag on the battlefield to move; attacks are automatic. In preparation phases, open Build, select a structure, drag the placement preview, and confirm. Walk near a structure for its upgrade action. Collect crystals for temporary run upgrades. The keep falling ends the run; heroes respawn after eight seconds.

Completed waves, kills, and combat time award persistent Ember points. Buy permanent damage/health upgrades or unlock frost towers and healing shrines at camp. Progress lives in D1, associated with an anonymous HttpOnly browser cookie. Clearing cookies loses access to that profile; there is no cross-device account recovery in this prototype.

## Co-op

Create a room, share its six-digit code, or browse available rooms. Up to four players choose independent weapons and share the keep, gold, and team XP. Rooms stop accepting joins once a run begins.

The host browser runs the authoritative simulation. Guest inputs and reliable sequenced commands travel through the room API; snapshots are interpolated on the client. This initial transport polls HTTP about five times per second, so latency depends on the network. Keep the host tab foregrounded. There is no host migration or mid-run reconnection flow yet. Host departure closes the room; a connection failure displays a message and pauses the host simulation after three seconds. Rooms expire after 45 seconds without a host heartbeat.

This is a cooperative playtest, not an anti-cheat competitive service. Solo run results and host-reported co-op results are trusted; reward claims are transactionally idempotent. A production version should move simulation and score validation to a dedicated realtime server.

## Local development

- `npm install`
- `npm run dev -- --host 0.0.0.0`
- Apply the generated `drizzle/*.sql` migrations to the local D1 database before API use. Sites applies them automatically at deployment.
- `npm run build`
- `npx tsc --noEmit`
- `node --experimental-strip-types --test tests/engine.test.mjs`
- With the local server running: `node --experimental-strip-types --test tests/coop.test.mjs`

The API integration tests create isolated anonymous test profiles and clean up their test room. Run only against a development environment.

## Validation

Engine tests cover free placement, collision/phase/unlock rules, ranged and melee automatic attacks, command deduplication, income/repair, respawning, defeat, and complete wave resolution across all three maps. API tests use distinct sessions to cover discovery, four-player capacity, movement/build replication, host permissions, room closure, durable progress, spending limits, and idempotent reward claims.

Browser/device visual and touch testing has not been performed. Optional WebMCP configure/read tools are feature-detected; no supported validation context was available in this task.
