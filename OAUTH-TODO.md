# OAuth Provider — Deferred Work

The OAuth2/OIDC provider enforces a **deny-by-default** posture on the Write
API (`/api/v3/*`): a Bearer/OAuth token may only reach routes that map to a
scope it holds. Routes with no scope mapping are denied (403). Cookie sessions
and ACP tokens (which never set `req.oauth`) are unaffected.

The scope model is intentionally **limited** for now. The following are
deferred.

## 1. Complete the scope model

`ROUTE_SCOPES` in `src/oauth/index.js` currently covers six resources
(`users`, `categories`, `topics`, `posts`, `groups`, `admin`). The remaining
core Write API resources are **denied by default** to Bearer/OAuth tokens
until a scope is added for each:

- `tags`
- `notifications`
- `chats`
- `files`
- `flags`
- `search`
- `intents`
- `utilities`
- `ping`
- `plugins`

To make a resource reachable, add a `<resource>:read` / `<resource>:write`
entry to `ROUTE_SCOPES`, register the scope(s) in `oauth.scopes`, and add the
translation key(s).

## 2. Plugin-mounted route handling

Plugins can mount routes under `/api/v3/*`. Today those routes are **denied by
default** (no carve-out) — a Bearer/OAuth token cannot reach a plugin route
regardless of its scopes. Decide whether plugins should be able to declare
scopes for their own routes (and the mechanism for doing so), or whether
deny-by-default for plugin routes is the intended permanent posture.
