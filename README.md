# Field Capture: offline-first RN + TypeScript prototype

Capture site records (title, category, notes, photo) with no signal. Everything is written to SQLite on the device first, the UI shows each record's sync state, and a background sync engine uploads the queue with retries as soon as connectivity returns.

Built with Expo SDK 58, React Native 0.88, TypeScript (strict), `expo-sqlite`, `@react-native-community/netinfo`, `expo-file-system`, `expo-image-picker`.

## Run it

```bash
npm install
npx expo run:ios        # or: npx expo run:android   (dev build; uses native SQLite + NetInfo)
```

No backend needed: by default the app talks to an in-app mock server with adjustable failure rate.

To use the real HTTP server instead:

```bash
npm run server                      # or: FAIL_RATE=0.3 npm run server
EXPO_PUBLIC_SYNC_URL=http://<your-LAN-IP>:4000 npx expo run:ios
```

Checks: `npm run typecheck`, `npm test` (retry policy unit tests, plain `node:test`).

## Demo controls

Tap the **Online / Offline** pill to open the demo panel:

- **Simulate offline**: forces offline without airplane mode (the iOS simulator can't toggle it). Real airplane mode on a device works too.
- **Server failure rate** 0 / 30 / 70 / 100%: makes the mock server return 503s so you can watch backoff and give-up behaviour.
- **Sync now**, **Clear all**.

## How it works

```
 Capture form ──► SQLite (source of truth) ◄── UI reads via useSyncExternalStore
                        │
                        ▼
                  SyncEngine (single-flight drain loop)
                        │  triggers: launch · new capture · reconnect · foreground · backoff timer · manual
                        ▼
                  Transport (Mock | HTTP PUT /captures/:id, idempotent)
```

**States** (`src/types.ts`)

| State | Meaning |
|---|---|
| `pending` | Saved locally, waiting. Card shows "will sync when online" or a live "Retry in Ns" countdown. |
| `syncing` | Request in flight. |
| `synced` | Server acknowledged; shows server id and time. |
| `failed` | Permanent error (4xx) or retry budget spent. Manual **Retry** button. |

**Reliability decisions**

- **Local-first**: SQLite is written before any network call. Killing the app never loses a capture.
- **Photos are copied** out of the picker's cache into the document directory, which the OS doesn't purge.
- **Idempotency**: the client UUID is the record id and the `Idempotency-Key`. A resend after a lost response returns the same server id instead of creating a duplicate (verified in `server/index.mjs`).
- **Crash recovery**: rows stuck in `syncing` at launch are moved back to `pending`.
- **Retry policy** (`src/sync/backoff.ts`): exponential backoff with jitter, 2s base, 60s cap, 6 attempts. 5xx / 408 / 429 / network errors retry; other 4xx fail immediately.
- **Reconnect flush**: on offline → online, all pending rows become due immediately rather than waiting out backoff that accrued while offline.
- **Offline mid-upload doesn't burn an attempt**: the attempt is refunded.
- **Ordered, single-flight**: one drain loop, oldest capture first, so the server sees records in capture order.

## What I'd add for production

- Background sync (`expo-background-task`) so uploads continue when the app is closed.
- Presigned direct-to-storage photo uploads instead of base64 in JSON, with resumable uploads for large media.
- Edits and deletes as queued operations (an outbox of mutations) with server-side conflict resolution (`updatedAt` / version vectors).
- Auth token refresh in the transport, telemetry for sync failures, and a schema migration runner.
- Integration tests for the engine with a fake clock and fake transport.

## Layout

```
App.tsx                    main screen, status counts, demo panel
src/db/database.ts         SQLite schema + queue queries
src/sync/SyncEngine.ts     connectivity, drain loop, retry scheduling, store
src/sync/backoff.ts        pure retry policy (unit tested)
src/sync/transport.ts      Mock + HTTP transports, SyncError(retryable)
src/media/photos.ts        camera/library + durable photo storage
src/ui/                    RecordCard, CaptureModal, hooks, theme
server/index.mjs           zero-dependency idempotent sync server
tests/backoff.test.ts
```
