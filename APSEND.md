# Plan: Offload ActivityPub Outbound Sending to Child Processes

## Problem

`ActivityPub.send()` and `ActivityPub._sendMessage()` execute in the main event loop. For each outbound federation message:

1. **`send()`** resolves inboxes (actor assertions, DB lookups, blocklist filtering), fetches private keys, and batches HTTP sends via `batch.processArray()`
2. **`_sendMessage()`** signs the payload (RSA/ECDSA cryptographic ops) and POSTs to each inbox via `request.post()` (DNS lookup, TCP connect, TLS handshake, response processing)

Even though `undici` is async, I/O completion callbacks, DNS resolution, and signature generation still consume event loop time. A user with hundreds of remote followers can block the main thread for hundreds of milliseconds per post.

## Goal

Move the HTTP sending (and signing) work off the main event loop into a child process pool, so the main process can continue handling requests with minimal latency.

## Architecture

`activitypub.send()` is fire-and-forget: push tasks to the Redis queue and return immediately. A drain loop in the main process continuously pulls from the queue and dispatches to worker processes. The caller doesn't need to know or care about sending — it just queues and moves on.

```
Main Process                    Redis Queue              Child Process Pool
─────────────                   ──────────────           ──────────────────
out.js (triggers send)
    │
    ▼
ActivityPub.send()
  - resolveInboxes()
  - build payload
  - getPrivateKey()
  - push tasks to ap:retry:queue  ──→  [sorted set]
  - return immediately
                                      │
                                  Drain loop (main process)
                                  - active: tight loop with `setImmediate` yield
                                  - idle: checks every 10 seconds
                                      │
                                      ▼
                              dispatch to free worker ──→  Worker
                                                            sign + POST
                              ←────── result (ok/fail) ────┘
                              success → analytics + remove
                              failure → update score (backoff)
```

**Key properties:**
- `send()` is fire-and-forget — push to Redis, return immediately
- Queue is persistent in Redis — survives restarts
- Drain loop runs continuously while queue has items, backs off to 10-second intervals when idle
- Replaces both the hourly retry cron job and the inline `batch.processArray` in `send()`
- Retry logic is unified — same queue for first attempt and retries

## Detailed Design

### 1. New file: `src/activitypub/sendWorker.js`

A self-contained child process module (similar to `src/meta/minifier.js` pattern with `process.env.minifier_child` guard).

**Environment variable:** `AP_SEND_CHILD=true`

**Responsibilities (minimal):**
- On startup: emit `{ type: 'ready' }` message to parent
- Receive send tasks via `process.on('message')`
- Sign the payload (import private key PEM, generate HTTP signature headers)
- POST to remote inbox via `undici` `fetch`
- Report `{ type: 'result', id, success, error }` back via `process.send()`
- On receiving `{ type: 'shutdown' }`: abort in-flight task (if any), then exit. Do **not** wait for in-flight tasks to complete — the parent coordinates shutdown timeout separately.

**Message protocol:**

```js
// Main → Worker
{
  type: 'send',
  id: <crypto.randomUUID>(),   // unique across all batches
  uri: <string>,               // inbox URL
  payload: <string>,           // JSON-stringified AP object
  digest: <string>,            // pre-computed SHA-256 digest
  key: <string>,               // private key PEM
  keyId: <string>,             // keyId for signature header
}

// Worker → Main
{
  type: 'result',
  id: <task id>,
  success: true | false,
  error: <string>,             // only on failure
}

// Worker → Main (startup)
{ type: 'ready' }
```

**SSRF protection:** `src/request.js` depends on `nconf` (config not loaded in fork) and `plugins` (not bootstrapped in fork), so it can't be required directly. Instead, the worker inlines the SSRF check functions from `request.js`:
- `checkHostname(hostname)` — DNS lookup + `ipaddr.js` range check (`unicast` only)
- `lookup()` — cached DNS resolution to prevent DNS rebinding
- TTL cache for DNS results (using a simple `Map` + timestamp, no `ttl` module dependency)

These functions only depend on `dns.promises`, `ipaddr.js`, and a local `Map` — all fork-safe.

**HTTP timeout:** Each POST uses `AbortSignal.timeout(10000)` (same as current `_sendMessage` hardcoded timeout). On timeout, worker reports `success: false` with error message.

**Error handling:**
- Malformed/missing fields in incoming message → reply with `{ type: 'error', id, error: 'missing fields' }`
- Unexpected message types → log warning, ignore
- Uncaught exceptions → `process.on('uncaughtException')` handler sends error back if task ID is known, otherwise just logs

**No Redis access:** Worker is stateless — no Redis connection, no analytics, no retry queueing. It just does HTTP and reports back.

### 2. Pool management in `src/activitypub/index.js`

No separate `sendManager.js` — pool management lives inline in `ActivityPub`. Add a `SendPool` object:

```js
ActivityPub.SendPool = {
    workers: [],           // all forked workers
    free: [],              // available workers
    busy: new Map(),       // Map<worker pid, taskId> — tracks in-flight tasks
    taskTimers: new Map(), // Map<taskId, Timer> — per-task stuck detection
    pending: new Map(),    // Map<taskId, { queueId, uri, payloadType }> — awaiting results
    maxWorkers: Math.max(1, cpus().length - 1),
    draining: false,       // prevents concurrent drain loops

    init() { /* fork workers, wait for ready */ },
    dispatch(task) { /* send to free worker or queue */ },
    shutdown() { /* stop drain loop, signal workers, wait + kill */ },
};
```

**`busy` Map tracks in-flight tasks per worker** for crash recovery: when a worker exits unexpectedly, its in-flight task ID is moved back to the Redis queue for dispatch to another worker.

**`taskTimers` Map prevents stuck tasks:** each dispatched task gets a 30-second timer. If the timer fires (task has been in-flight >30s with no result), the task is moved back to the Redis queue and the worker is killed. This handles the case where a worker is hung (not crashed) and silently occupying a slot.

**`pending` cleanup on worker exit:** when a worker exits, all `pending` entries for tasks dispatched to that worker (cross-referenced via `busy`) are cleaned up to prevent memory leaks.

### 3. Queue format in Redis (`ap:retry:queue`)

Current format stores task metadata in `ap:retry:queue:<queueId>` objects. Extend to support immediate sends:

```js
// Sorted set: ap:retry:queue → score (timestamp) → queueId (member)
// Object: ap:retry:queue:<queueId> → {
//     queueId: <string>,
//     uri: <string>,
//     id: <actor id — uid or cid>,
//     type: <'uid' | 'cid'>,
//     attempts: <number>,
//     timestamp: <next retry timestamp>,
//     digest: <string>,
//     payload: <JSON string>,
// }
```

For **immediate sends**, score = `Date.now()` (available now). For **retries**, score = `Date.now() + backoff`.

### 4. Modified `ActivityPub.send()`

**`send()` is fire-and-forget.** It pushes tasks to the Redis queue and returns immediately. The caller doesn't await, doesn't track results, doesn't handle retries.

Current flow:
```js
setImmediate(() => {
    batch.processArray(inboxes, async (inboxBatch) => {
        await Promise.all(inboxBatch.map(async (uri) => {
            const ok = await ActivityPub._sendMessage(uri, keyData, payload, digest);
            if (!ok) { /* retry queue logic */ }
        }));
        /* bulk write retry queue */
    }, batchSettings);
});
```

New flow:
```js
// Fire-and-forget — push to queue, return immediately
const queueEntries = inboxes.map(uri => ({
    queueId: createHash('sha256').update(`${type}:${id}:${uri}`).digest('hex'),
    uri, id, type, attempts: 1, timestamp: Date.now(),
    digest, payload: JSON.stringify(payload),
}));

await Promise.all([
    db.sortedSetAddBulk(queueEntries.map(e => ['ap:retry:queue', Date.now(), e.queueId])),
    db.setObjectBulk(queueEntries.map(e => [`ap:retry:queue:${e.queueId}`, e])),
]);
// Done — drain loop handles dispatch, workers handle sending,
// result handler handles analytics/retry
```

**Result handling** (main process, wired via `SendPool` — triggered by worker IPC callbacks, not by `send()`):
```js
// When worker reports result:
if (result.success) {
    ActivityPub.analytics.send({ type: payloadType, target: uri });
    db.delete(`ap:retry:queue:${queueId}`);
    db.sortedSetRemove('ap:retry:queue', queueId);
} else {
    // Exponential backoff: 1min, 2min, 4min, 8min, ... capped at 1 hour
    const backoffMs = Math.min(oneMinute * Math.pow(2, attempts - 1), 60 * 60 * 1000);
    const nextTryOn = Date.now() + backoffMs;
    db.sortedSetAdd('ap:retry:queue', nextTryOn, queueId);
    db.setObjectField(`ap:retry:queue:${queueId}`, 'attempts', attempts + 1);
    db.setObjectField(`ap:retry:queue:${queueId}`, 'timestamp', nextTryOn);
}
```

### 5. Worker drain loop

Workers don't poll Redis directly. Instead, the **main process** is the queue consumer:
1. Main process periodically checks `ap:retry:queue` for due tasks (`getSortedSetRangeByScore('-inf', Date.now())`)
2. Dispatches available tasks to free workers via IPC
3. Tracks in-flight tasks in `SendPool.busy`
4. On result, handles analytics/retry as above

This keeps Redis access in the main process (where `db` module works) and workers are pure HTTP senders.

**Drain loop — two modes:**
- **Active:** Queue has due tasks → runs in a tight loop with `setImmediate` yield between batches. Each iteration pulls available tasks (up to number of free workers) and dispatches, then yields to the event loop before the next iteration. This prevents main thread starvation while still draining quickly.
- **Idle:** Queue is empty or no due tasks → `setTimeout` for 10 seconds, then check again. If new tasks appeared, switch back to active.

Replaces the hourly retry cron job (`'0 * * * *'`, 50 items). The cron job in `jobs.js` becomes redundant and can be removed.

### 6. `jobs.js` retry cron — removed

The drain loop replaces the hourly retry cron job (`'0 * * * *'`, 50 items max). The `retryFailedMessages()` function and its cron registration in `jobs.js` are removed — the unified queue + continuous drain handles both immediate sends and retries.

`_sendMessage()` is removed from the main process with it. No code duplication.

### 7. CI mode

Unchanged — early-returns before any queue/worker logic. Tests set `ActivityPub._sent` map.

## File Structure

```
src/activitypub/
  ├── index.js          (modified — SendPool inline, send() is fire-and-forget,
  │                      result handler for analytics/retry)
  ├── send.js           (new — child process: sign + POST + report boolean)
  ├── signatures.js     (unchanged)
  ├── analytics.js      (unchanged)
  ├── jobs.js           (modified — retry cron removed; drain loop replaces it)
  └── ...
```

## Implementation Order

### Phase 1: Worker process (`send.js`)
1. Extract signing: pure function `(keyPem, keyId, url, digest)` → headers (from `signatures.js`)
2. Wire `process.on('message')` handler: receive task → sign → `undici` fetch POST → send result
3. Inline SSRF protection: `checkHostname()` + `lookup()` + TTL cache from `request.js` (depends only on `dns.promises`, `ipaddr.js`, local `Map`)
4. Emit `{ type: 'ready' }` after startup
5. Handle `{ type: 'shutdown' }` — abort in-flight task (if any), exit immediately
6. Handle malformed messages, uncaught exceptions

**Post-implementation findings (Phase 1 review):**
- ~~**`crypto` import unused in worker**~~ — **FIXED**: Removed `crypto` import. Only needed in main process for `crypto.randomUUID()`.
- ~~**Dead code: `payloadObj` parsed but never used**~~ — **FIXED**: Removed intermediate `JSON.parse(payload)` call.
- ~~**Missing `redirect: 'manual'`**~~ — **FIXED**: Added `redirect: 'manual'` to `fetch()` to prevent HTTP-based SSRF bypass.
- ~~**Missing response size limit**~~ — **FIXED**: Added `maxBodyLength: 10 * 1024 * 1024` (10MB) to `fetch()`.
- ~~**`checkCache` never cleaned up**~~ — **FIXED**: Added 5-minute `setInterval` cleanup that deletes expired entries.
- ~~**`for...in` avoided**~~ — **FIXED**: Used `forEach` instead of `for...in` (eslint rule compliance).
- **DNS `lookup` reuse still missing** — the worker does SSRF check, then `fetch` does its own DNS lookup. The original `request.js` stores the DNS `lookup` array in the cache and reuses it for the actual request to prevent DNS rebinding between check and request. **Future work**: create an undici `Agent` with a custom `lookup` function that returns cached results. For now, `redirect: 'manual'` + SSRF check provides defense-in-depth.
- **Shutdown doesn't truly abort in-flight fetch** — worker sends `ack` but the 10s `AbortSignal.timeout` is the only abort mechanism. Not "abort immediately" as the plan states. **Future work**: track an `AbortController` per task, call `abort()` on shutdown message, then exit.

### Phase 2: Pool management + integration
1. Fork workers (pattern from `minifier.js`: `pool[]`, `free[]`), wait for `ready` message before marking available
2. `busy: Map<worker, taskId>` — track in-flight tasks per worker
3. `pending: Map<taskId, { queueId, uri, payloadType, ... }>`, `taskTimers: Map<taskId, Timer>` — 30s stuck detection
4. On worker `exit`: move in-flight task back to Redis queue (`ap:retry:queue` with score `Date.now()`), fork replacement
5. On worker `error`: log, handle via exit path
6. Drain loop: `draining` flag prevents concurrent loops. Active (tight loop with `setImmediate` yield) while queue has items, idle (10s `setTimeout`) when empty. `getSortedSetRangeByScore('ap:retry:queue', 0, 50, '-inf', Date.now())` → batch fetch task data + key data → dispatch to free workers. Start drain loop after pool init; stop on graceful shutdown.
7. Result handler: on result → analytics (success) or re-queue with exponential backoff (failure). Backoff formula: `Math.min(1min * 2^(attempts-1), 1 hour)`.
8. Graceful shutdown: stop drain loop, send `{ type: 'shutdown' }` to workers (workers abort in-flight and exit), wait 10s, then `kill('SIGTERM')` → `kill('SIGKILL')` after 2s.
9. `send()` converted to fire-and-forget: push all inboxes to `ap:retry:queue` with score `Date.now()`, start drain loop. `batch.processArray` removed.

**Post-implementation findings (Phase 2 review):**
- ~~**`cpus()` destructuring**~~ — **FIXED**: Changed from `const { cpus } = require('os')` to `const os = require('os')` + `os.cpus()` to avoid prefer-destructuring eslint error.
- ~~**`fork` destructuring**~~ — **FIXED**: Changed from `require('child_process').fork` to `const { fork } = require('child_process')`.
- **Await-inside-loop warnings** — `no-await-in-loop` triggers on `await` inside `while (SendPool.draining)` loop. These are false positives (the rule targets `for/forEach/map` loops, not `while` loops). Three warnings remain: `getSortedSetRangeByScore`, `Promise.all` for task data, `Promise.all` for key data. All are in the main drain loop control flow and are intentional.
- **Key data fetched per-task in drain loop** — `ActivityPub.getPrivateKey()` is called for each task during drain. This is acceptable because it's batched via `Promise.all` and the key data is small/cached by the `db` module. Future optimization: cache key data per `(type, id)` pair.
- **CI mode preserved** — `send()` still early-returns with `ActivityPub._sent.set()` when `process.env.CI` is set, ensuring tests are unaffected.
- **Shutdown integrated into start.js** — `ActivityPub.shutdown()` called during NodeBB shutdown flow, after webserver destroy and analytics write, before database close.
- **SendPool extracted to `send.js`** — `SendPool` logic (371 lines) moved from `index.js` to `send.js` to reduce `index.js` bloat. `send.js` imports `db` and `winston` directly. `ActivityPub` reference resolved via `SendPool._activityPub` parameter passed to `SendPool.init(ActivityPub)` at end of `index.js`.
- ~~**`send.js` renamed to `sendWorker.js`**~~ — **FIXED**: Worker process file renamed to `sendWorker.js`; `send.js` now holds `SendPool` logic. Worker path in `SendPool.forkWorker()` updated to `path.join(__dirname, 'sendWorker.js')`.

### Phase 4: Cleanup
1. Remove `retryFailedMessages()` and its cron registration from `jobs.js`
2. Remove `_sendMessage()` from main process (no longer needed)

### Phase 5: Testing
1. Unit test `sendWorker.js` (mock fetch, verify signing + HTTP POST + SSRF check)
2. Unit test `SendPool` (fork lifecycle, ready signal, crash recovery, result handling)
3. Integration test: send via worker, verify Redis queue entries, verify analytics on success, verify retry on failure
4. Test worker crash recovery (in-flight task re-queued to Redis)
5. Test graceful shutdown (drain + timeout)
6. Verify drain loop handles retries (failed task re-queued with backoff)

## Key Decisions & Trade-offs

| Decision | Choice | Rationale |
|----------|--------|-----------|
| File layout | `send.js` (SendPool, 371 lines) + `sendWorker.js` (worker, 308 lines) + `index.js` (ActivityPub, 728 lines) | Pool extracted to `send.js` to reduce `index.js` bloat; worker renamed to `sendWorker.js` |
| Queue location | Redis (`ap:retry:queue`) | Persistent, restart-safe, reuses existing mechanism |
| Queue consumer | Main process (not worker) | Workers stay simple; main process has `db` module |
| Drain mechanism | Active: tight loop with `setImmediate` yield / Idle: 10-second `setTimeout` | Replaces hourly retry cron; runs continuously while queue has items, yields to event loop between batches |
| SSRF protection | Inlined in worker | `request.js` depends on `nconf` + `plugins` (not available in fork); SSRF check only needs `dns.promises` + `ipaddr.js` + `Map` |
| Task ID | `crypto.randomUUID()` (main process) | No collision across batches or concurrent `send()` calls |
| Worker `crypto` | **Not imported** | Worker only needs `undici`, `@misskey-dev/node-http-message-signatures`, `dns`, `ipaddr.js`, `winston` |
| Per-task timeout | `AbortSignal.timeout(10000)` in worker | Same as current `_sendMessage` timeout; sufficient for a single HTTP POST |
| Shutdown timeout | `setTimeout` + `SIGTERM` → `SIGKILL` after 10s | Enforced hard limit |
| `_sendMessage()` | Removed entirely | Worker handles all sends; drain loop handles retries; no code duplication |
| Backpressure | Worker pool size limits concurrency | `maxWorkers = cpus() - 1`; Redis queue absorbs excess |
| Queue depth warning | Log when queue > 1000 | Observability without hard rejection |

## Risks & Mitigations

1. **Worker ready race** — Pool waits for `{ type: 'ready' }` message before marking worker as free. Worker emits ready after all initialization (SSRF cache, etc.) is complete.

2. **Worker crash / in-flight task loss** — `SendPool.busy` maps worker → taskId. On `exit`, task is moved back to Redis queue with score `Date.now()` (immediate retry on next drain). Tasks are idempotent — duplicate AP sends are harmless (receivers deduplicate by activity `id`).

3. **`request.js` not available in fork** — SSRF check is inlined (only `dns.promises`, `ipaddr.js`, local `Map`). No `nconf` or `plugins` dependency.

4. **Graceful shutdown** — On SIGTERM, stop drain loop, send `{ type: 'shutdown' }` to workers (workers abort in-flight and exit immediately), wait for in-flight tasks (10s via `setTimeout`), then `kill('SIGTERM')` → `SIGKILL`. Uses minifier's `pendingRequests` pattern.

5. **Stuck worker detection** — `taskTimers` Map gives each dispatched task a 30-second timer. If a timer fires (task in-flight >30s), the task is moved back to Redis and the worker is killed. Prevents a hung worker from silently occupying a slot.
6. **SSRF check vs. DNS rebinding** — Worker inlines `checkHostname()` for SSRF validation, but the actual `fetch` call does its own DNS resolution. Between the check and the request, DNS could change (DNS rebinding attack). Mitigation: (a) store DNS lookup results in the cache and pass them to undici via a custom dispatcher, or (b) at minimum use `redirect: 'manual'` to prevent HTTP-based SSRF bypass. (c) Add response size limit to prevent memory exhaustion.
7. **Shutdown abort latency** — `{ type: 'shutdown' }` acknowledgment is sent immediately, but the in-flight fetch is only aborted via the 10s `AbortSignal.timeout`. For truly immediate abort, track an `AbortController` per task and call `abort()` when shutdown is received.

8. **Queue depth unbounded** — Redis queue absorbs all excess. Log warning when queue depth > 1000. No hard rejection — federation is fire-and-forget by nature.

9. **No code duplication** — `_sendMessage()` is removed from the main process. Worker handles all sends; drain loop handles retries via the unified Redis queue.

10. **Analytics timing** — Analytics are called per-result as workers report back (not after all sends complete). This provides timely metrics even for large follower sets.

## Out of Scope (for now)

- Moving `resolveInboxes()` to worker (it's already async and DB-bound; the bottleneck is HTTP)
- Support for clustered/multi-instance NodeBB (current design is single-process; cluster support would need Redis pub/sub for result coordination)