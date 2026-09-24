# ActivityPub Polls (`Question`) — Implementation Plan

Handling of the ActivityPub `Question` object type (polls) per
[FEP-9967](https://codeberg.org/fediverse/fep/src/branch/main/fep/9967/fep-9967.md),
integrated with the `nodebb-plugin-poll` plugin (`/plugins/nodebb-plugin-poll/`).

---

## Background: how `Question` is handled today

`Question` is **already** in `acceptedPostTypes` (`src/activitypub/index.js:61`), so it is
accepted as a valid post type. But it is then processed **identically to a `Note`**, and all
poll-specific data is discarded.

### Inbound path (`Create(Question)` → post)

1. `Controller.postInbox` (`src/controllers/activitypub/index.js`) → `filter:activitypub.create`
   hook (unclaimed) → `activitypub.inbox.create(req)`
2. `inbox.create` → `activitypub.notes.assert(0, object, { cid })`
3. `notes.assert` → `getParentChain` → **`Mocks.post(object)`** (`src/activitypub/mocks.js:424`)
4. `Mocks.post` destructures only standard note fields (`id, url, attributedTo, inReplyTo,
   content, to, cc, tag, ...`). **`oneOf`/`anyOf`, `endTime`/`closed`, `votersCount` are never
   read and are thrown away.**
5. The post is created via `topics.post()` → `Posts.create()` → `filter:post.create` hook
   (`src/posts/create.js:60`).

### The poll plugin

`nodebb-plugin-poll` stores polls in a structure separate from posts:

- `poll:<pollId>` object — fields: `pollId`, `title`, `uid`, `pid`, `deleted`, `end`,
  `maximumVotesPerUser`, `timestamp`, `options` (JSON `[{id, title}]`)
- `post:<pid>.pollIds` — JSON array of poll ids
- Vote sorted-sets: `poll:<pollId>:voters`, `poll:<pollId>:options:<optionId>:votes`,
  `poll:<pollId>:anon:voters`

The plugin only populates these from **local** composer submissions, via its
`filter:post.create` / `filter:post.edit` hooks reading `data.polls`. Federated `Question`
data never reaches it.

### Outbound path (local post → federation)

`Out.create.note` / `Out.update.note` (`src/activitypub/out.js`) → `Mocks.notes.public`
(`src/activitypub/mocks.js:689`) always serializes as `Note`/`Article`. Local polls are
federated as plain notes with no poll data. `Mocks.notes.public` fires a
`filter:activitypub.mocks.note` hook at its end (`mocks.js:944`) — a natural plugin hook point.

### The gap

Poll mechanics exist in the plugin but are completely disconnected from the ActivityPub layer in
both directions. `Question` is ingested as a content-less-of-poll-meaning note and local polls
are never emitted as `Question`.

---

## Guiding constraint

Keep the heavy lifting in the plugin. The only core change is a **small, surgical edit to
`Mocks.post`** to preserve poll fields through the existing post-creation flow (which already
fires `filter:post.create` / `filter:post.edit` — the hooks the plugin already uses).
`_activitypub` is already threaded through `notes.assert` → `topics.post`/`reply` →
`Posts.create`/`edit` → the plugin hooks, so carrying poll data there requires no new plumbing.

---

## Phase 1 — Ingest + view remote polls ✅ READY TO IMPLEMENT

**Scope:** `Create(Question)` → topic + post + a poll record marked `remote`;
`Update(Question)` → refresh results/end time; poll renders with options + current results
(from the ingested counts), **results-only** (no vote buttons). No local voting, no outbound
vote federation.

### Changes

| File | Change |
|------|--------|
| `src/activitypub/mocks.js` | `Mocks.post`: destructure `oneOf, anyOf, endTime, closed, votersCount`; carry them in `_activitypub` **only when present** (type-agnostic — regular notes simply won't have them). e.g. `...(oneOf && { oneOf }), ...(anyOf && { anyOf }), ...((endTime \|\| closed) && { endTime: endTime \|\| closed }), ...(votersCount !== undefined && { votersCount })`. **Only core edit.** |
| `plugins/nodebb-plugin-poll/lib/hooks.js` | `postCreate`: if `data._activitypub` has `oneOf`/`anyOf`, build a poll — options (stable id = short hash of option `name`), `end` from `endTime`/`closed` (ms), `remote=1`, `remoteVotes` (`{[optionId]: replies.totalItems}` as JSON), `remoteVotersCount`; append to `post.pollIds`. `postEdit`: on `Update(Question)`, refresh `remoteVotes`/`end`/options on the **existing** poll (reconcile by option id, no duplicate). |
| `plugins/nodebb-plugin-poll/lib/poll.js` | `getInfo`: for `remote` polls, set per-option `voteCount` from `remoteVotes` and total `voteCount` = their sum. |
| `plugins/nodebb-plugin-poll/lib/vote.js` | `canVote` / `canUpdateVote`: return `false` for `remote` polls (gate before the ended/deleted checks). |
| `plugins/nodebb-plugin-poll/public/js/poll/view.js` + `templates/poll/view.tpl` | When `pollData.info.remote`, force the results panel and hide all vote/update/remove buttons. |
| `test/activitypub/helpers.js` | Add `helpers.mocks.question()` factory (mirrors `note()`, adds `oneOf`/`anyOf`/`endTime`/`votersCount`). |
| `test/activitypub/inbox.js` | `Create(Question)` → assert topic+post created **and** `poll:<id>` exists with correct options, `remote=1`, `remoteVotes`. `Update(Question)` → assert counts refresh. |

No `plugin.json` change in this phase.

### Notes / details

- **Option id stability:** use a short hash of the option `name` (FEP guarantees `name` is
  unique within a poll) so ids survive `Update`s even if option order changes.
- **`hasVoted`** is naturally `false` for remote polls (empty local vote set), so the frontend
  only needs a `remote` check to skip the voting panel — the only frontend logic change.
- **`maximumVotesPerUser`:** `1` for `oneOf` (single choice), `options.length` for `anyOf`
  (multi choice). Stored for completeness even though voting is deferred.
- **Count source:** displayed counts come from `remoteVotes` (the ingested `replies.totalItems`),
  not the local vote sorted-sets (which we can't populate — we don't know remote voters' uids).

### Testing

- Extend `test/activitypub/inbox.js` with a `Create(Question)` case and an `Update(Question)`
  case (see table). Keep the existing inbox suite green.

---

## Phase 2 — Outbound `Question` serialization ⚠️ NEEDS TECHNICAL REVIEW PRIOR TO IMPLEMENTATION

**Scope:** When a **local** post with polls is created/updated, federate it as a `Question`
object (not a plain `Note`/`Article`).

### Approach

- New plugin hook `filter:activitypub.mocks.note` (fired at the end of `Mocks.notes.public`,
  `mocks.js:944`). If the post has `pollIds`, transform the serialized object:
  - `type: 'Question'`
  - `oneOf` (single) or `anyOf` (multi) built from the poll options, each with
    `replies: { type: 'Collection', totalItems: <voteCount> }`
  - `endTime` from `poll.end`; `votersCount` from the voter count
- Register the hook in `plugin.json`.

### Open questions (resolve in review)

- Interaction with the existing `isArticle` branch in `Mocks.notes.public` (main posts serialize
  as `Article` with a `preview`). A main post that is a poll would become a `Question` — confirm
  consumers handle `Question` where an `Article`/`Note` is expected, and whether `preview`/
  `summary` should be dropped.
- Which poll on a post wins if a post has multiple polls (`pollIds` is an array). FEP-9967 models
  one `Question` = one poll; decide serialization for the multi-poll case.
- `updated` property maintenance on vote changes (see Phase 3).

---

## Phase 3 — Local voting on remote polls + FEP-9967 outbound vote federation ⚠️ NEEDS TECHNICAL REVIEW PRIOR TO IMPLEMENTATION

**Scope:** Allow local users to vote on **remote** polls; federate each vote out per FEP-9967's
*Vote object*.

### Approach

- `lib/vote.js`: `canVote`/`canUpdateVote` allow remote polls (gate only on `ended`/`deleted`).
- `lib/sockets.js` → `Sockets.vote` / `Sockets.updateVote`: after `Vote.add`/`Vote.update`
  succeeds, if the poll is remote, federate the vote:
  - Resolve URIs already available on the post/poll:
    - **Question id** = the post's remote `pid`/`url` (remote pids are URLs)
    - **Poll author** = the post's `uid` (remote actor URL)
    - **Voter** = `${nconf.get('url')}/uid/${socket.uid}`
  - For each selected option, build the vote Note and send via
    `activitypub.send('uid', voterUid, [pollAuthor], { type: 'Create', object: voteNote })`
    (plugin can `nodebb.require('./src/activitypub')`).
  - Vote Note shape (FEP-9967): `type: 'Note'`, `attributedTo` = voter, `inReplyTo` = Question id,
    `name` = chosen option text, `to` = [poll author], **no `content`**.
  - **Stable, idempotent vote `id`** so re-sends dedupe remotely, e.g.
    `${nconf.get('url')}/uid/${uid}#activity/vote/${encodeURIComponent(questionId)}/${encodeURIComponent(optionName)}`.
  - **Multi-choice (`anyOf`):** one `Create(voteNote)` per selected option.
- `Sockets.removeVote` on a remote poll → send `Undo(Create(voteNote))` with the same stable id
  (FEP has no first-class "remove vote"; Undo is the mechanism).

### Display / reconciliation (design decision)

- Displayed per-option count = `remoteVotes` baseline **+** local vote sorted-set counts, so a
  local voter sees their vote reflect immediately.
- **Double-count risk:** once the remote processes our federated vote and sends
  `Update(Question)`, its `totalItems` already includes our vote; adding local votes on top then
  over-counts.
  - **v1 (simple):** on `Update(Question)`, refresh `remoteVotes` to the new totals and accept a
    small over-count bounded by the number of local voters.
  - **v2 (accurate):** track which local votes have been acknowledged by a remote `Update` and
    exclude those from the on-top count.
- Ship v1, note v2 as follow-up.

### Open questions (resolve in review)

- Debouncing/coalescing of outbound votes (FEP allows debouncing result `Update`s; we send votes,
  but confirm rate/queue behavior via `activitypub.send`).
- Vote `id` scheme and idempotency guarantees across vote updates/removals.
- Interaction with anonymous voting (`allowAnonVoting`) — FEP votes are attributed to the voter
  actor; confirm anon votes are not federated (or how they'd be represented).

---

## Phase 4 — Receiving votes on polls we authored ⚠️ NEEDS TECHNICAL REVIEW PRIOR TO IMPLEMENTATION

**Scope:** Inbound side of FEP-9967 — when a remote actor votes on a **local** poll (federated out
in Phase 2), receive the vote and update the local poll's counts.

### Approach

- Intercept `filter:activitypub.create` (fired in `postInbox` before dispatch). Detect the FEP-9967
  vote shape: a `Note` with `name` + `inReplyTo` and **no `content`**, where `inReplyTo` resolves
  to a local post that has a poll.
- Match `name` to a poll option; apply FEP-9967's receiving checks (poll active, vote id not
  already registered, actor not already voted [single-choice], option not already voted
  [multi-choice]); increment the option's count.
- Publish an `Update(Question)` with refreshed results back to the voter + audience (FEP-9967
  *Publishing results*).

### Open questions (resolve in review)

- **Reliability:** the FEP explicitly flags the vote shape as unreliable — a normal reply can look
  exactly like a vote. A `Respond` activity is being discussed as a replacement. Decide whether to
  implement the ambiguous `Note`-shape detection at all, or wait for `Respond`.
- Distinguishing a genuine vote from a reply whose text happens to match an option name.
- Where received votes are stored (local vote sorted-sets use numeric local uids; remote voters
  are URL uids — confirm the sorted-set members handle URL uids).

---

## Reference: key files

| Area | File |
|------|------|
| Accepted post types | `src/activitypub/index.js` (`acceptedPostTypes`) |
| Inbound dispatch | `src/controllers/activitypub/index.js` (`postInbox`, `filter:activitypub.<type>`) |
| Inbound create/update | `src/activitypub/inbox.js` (`inbox.create`, `inbox.update`) |
| Assertion / chain | `src/activitypub/notes.js` (`Notes.assert`, `Notes.getParentChain`) |
| Object → post payload | `src/activitypub/mocks.js` (`Mocks.post`, `Mocks.notes.public`, `Mocks.activities.create`) |
| Outbound federation | `src/activitypub/out.js` (`Out.create.note`, `Out.update.note`) |
| Post create/edit hooks | `src/posts/create.js` (`filter:post.create`), `src/posts/edit.js` (`filter:post.edit`) |
| Plugin entry | `plugins/nodebb-plugin-poll/library.js`, `plugin.json` |
| Plugin hooks | `plugins/nodebb-plugin-poll/lib/hooks.js` |
| Plugin poll model | `plugins/nodebb-plugin-poll/lib/poll.js` |
| Plugin votes | `plugins/nodebb-plugin-poll/lib/vote.js` |
| Plugin sockets | `plugins/nodebb-plugin-poll/lib/sockets.js` |
| Plugin frontend | `plugins/nodebb-plugin-poll/public/js/poll/*.js`, `templates/poll/*.tpl` |
| Test mocks | `test/activitypub/helpers.js` |
| Inbox tests | `test/activitypub/inbox.js` |

## FEP-9967 quick reference

- **Question object:** `oneOf` (single choice) or `anyOf` (multi choice); each option is a `Note`
  with `name` + `replies.totalItems` (vote count). `endTime` (or `closed`) = poll end.
  `votersCount` = distinct voters.
- **Vote object:** `Note` with `id`, `attributedTo` (voter), `inReplyTo` (Question id), `name`
  (chosen option), `to` (poll author); **no `content`**. Wrapped in `Create`, sent to the author.
  Multi-choice = one activity per option.
- **Receiving a vote:** author checks permission / active / not-already-registered, then updates
  the option's `totalItems` and `updated`, and publishes `Update(Question)`.
- **Closing:** poll closed once `endTime` reached; `closed` may be added explicitly.
