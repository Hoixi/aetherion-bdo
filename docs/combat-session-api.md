# Kill-feed sessions — Companion v2

## Activation (not performed by the implementation task)

1. Back up DB; apply `scripts/sql/20260925-combat-sessions.sql` once.
2. Deploy schema/API with `prisma generate` (existing postinstall).
3. Set `ENABLE_COMBAT_SYNC=1` in the server environment and redeploy/restart.
4. Install the new local combat-beta Companion build. This feature is not enabled in standard releases.

Do not use `prisma db push --accept-data-loss`. This SQL adds only two tables;
the old combat-beta SQL is not a prerequisite. No official damage reports are changed.
No production migration or real recording upload was performed during implementation.

## Auth and scope

Reuse site session auth or Companion Bearer token. All endpoints currently require
site admin or guild admin with a guild. Primary guild managers see all wars;
ally managers see `isAllyWar=true` wars. Changing account/site does not send the old
local queue under a new identity. Session ownership is immutable. Participants
need not exist in `users`; game names remain strings, including ally names.

## UI contract for `/savas-haritasi`

Use existing war IDs; no date/title matching.

`GET /api/app/wars/{warId}/combat-sessions?after={sessionId}`

Returns `{sessions, nextCursor}` (50/page). A session contains:
`id`, `clientSessionId`, `warId`, `allianceName`, `recordedGuildId`, `parserVersion`,
`startedAt`, `endedAt`, `phase`, `lastSeq` (accepted event count), `updatedAt`,
`uploader:{id,familyName}`. Display uploader/start time as well as alliance:
two guilds can both record GoldAether. `listening` means not finalized, NOT proof
the client is still online; use `updatedAt` to display stale/partial recordings.

`GET /api/app/wars/{warId}/combat-sessions/{encodeURIComponent(sessionId)}/events?after=0`

Returns `{session, events, nextCursor}` (250/page). Continue until cursor is null.
For polling an open session use the last seen `seq` even after a null cursor.
Each event has `seq`, `receivedAt`, families/characters, opponentGuild, ourKill,
killerFamily, victimFamily, gameX/Y/Z, positionVerified, rawHash, tailHex, directionFlagHex.
`?raw=1` additionally returns the exact 359-byte frame as `rawBase64`.

**Existing renderer adapter:** `events.map(e => e.mapRow)` produces the existing
`olaylariCoz` JSON shape (time, fields, flags, floatCandidates, tailHex).
Pass all pages together to the parser. Do not use row offset as event identity:
use `(session.id, event.seq)`.

The user will connect this API to the map selector; no replacement map UI is added.

## Upload contract

`POST /api/app/wars/{warId}/combat-sessions`

```json
{
  "id": "client-generated-uuid",
  "warId": 123,
  "allianceName": "GoldAether",
  "parserVersion": "bdo-nodewar-11e1-v2",
  "startedAtMs": 1790273800000,
  "endedAtMs": null,
  "phase": "listening",
  "throughSeq": 1,
  "final": false,
  "events": [{"seq": 1, "receivedAtMs": 1790273801000, "rawBase64": "<359-byte-frame>"}]
}
```

Max 100 events / 128 KiB per request; session max 5000. Server decodes names,
direction and coordinates from the packet rather than trusting derived client fields.
This validates format, **not authenticity**: a client can fabricate a packet. This
must not award attendance or overwrite official war statistics automatically.

ACK `{sessionId:"userId:uuid", id:"uuid", throughSeq:1, final:false}` is returned
only after the PostgreSQL transaction commits. Duplicate identical sequences are
accepted; divergent repeats, gaps, retargeting and appends after finalization return
409. Non-final batches must contain events. The final batch may be empty and must
include `endedAtMs`, phase `stopped|error|interrupted`, and the session's final sequence.

## Durability and interpretation

- Local `%APPDATA%/online.aetheri.companion/combat-outbox.sqlite3` uses WAL + FULL
  synchronous writes for each accepted event. Never copy only the DB file while
  running; close Companion before backup (or use SQLite online backup).
- Credentials are NOT stored in this DB. It contains player names and feed frames.
- Worker uploads every ~10s, 100/batch, catches up at 1s for full batches, retry
  backoff up to 60s. It runs while Companion is open/logged in, across tabs.
- Restart marks unfinished local sessions `interrupted` and retries pending uploads;
  it does not resume packet capture automatically. Reopen capture for a new session.
- Invalid/unauthorized head-of-queue data blocks that account's queue with a visible
  error, rather than being silently skipped/deleted. Fix authorization/server data
  before retry. No automatic pruning; both local and server copies are retained.
- Existing old JSON archives are NOT silently migrated or uploaded (they had no
  recorded site/account consent). New recordings use the outbox.
- Multiple recorders may see the same feed. Separate sessions are preserved.
  Do **not** sum them blindly or deduplicate by name/time. `rawHash` is a candidate
  for comparison, not a guaranteed global kill ID. Default map view should pick
  one recorder/session; merging needs an explicit reconciliation policy.
- `receivedAt` is capture time on the recorder's machine, not authoritative game time.
- Raw XYZ is retained, Y presumed height. Position remains `positionVerified=false`;
  neither exact victim location nor world-to-map calibration has been established
  for every event. Renderer calibration can change without rewriting stored events.
- A single recorder only captures feed the game sends to that client. Full alliance
  coverage is not guaranteed. Kills/deaths show exchange locations, not confirmed
  territory ownership or a full tactical win/loss result.

Verification: Rust durable queue tests, client TypeScript/build, Prisma validate,
server decoder/store contract tests. PostgreSQL/live authenticated end-to-end
verification still requires an explicitly configured test DB or post-deploy test.
