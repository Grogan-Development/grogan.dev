# auth.md

You are an agent. This is Nero v1 on `https://nero.grogan.dev/`.

**Humans authenticate only through WorkOS AuthKit.** This host does not run an OAuth authorization server, does not mint ID-JAGs or access_tokens, and does not accept `Authorization: Bearer` on control-plane APIs.

v1 is one allowlisted human. Nero does not provision users. AuthKit account creation is disabled.

Resource (Nero APIs): `https://nero.grogan.dev/`

- Control plane: `https://nero.grogan.dev/api/workspaces` (list, create, wake, stop, heartbeat)
- Workspace daemon (once wired): `https://nero.grogan.dev/w/{workspaceId}/`

## Step 1 — Discover

This file is the discovery document:

```http
GET /auth.md
Host: nero.grogan.dev
```

A 401 on `/api/workspaces*` points here:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://nero.grogan.dev/auth.md"
```

`resource_metadata` is this markdown skill, not a JSON Protected Resource Metadata document. Do not fetch other discovery URLs on this host.

Send the human to the **AuthKit hosted UI**:

```http
GET /auth/login
Host: grogan.dev
```

```http
GET /auth/login
Host: nero.grogan.dev
```

Both start WorkOS AuthKit (`provider=authkit`, PKCE). After AuthKit, the browser lands on `https://nero.grogan.dev/` with a `wos-session` cookie (`Domain=grogan.dev`). That cookie is the only credential the control plane accepts.

## Step 2 — Pick a method

There is only one method: **AuthKit, for the allowlisted human**.

Do not use `identity_assertion`, `service_auth`, or `anonymous`. Those registration types are not enabled. This host will not accept an ID-JAG, an email as agent identity, or an anonymous agent.

## Step 3 — Register

Agents do not register with Nero. The human signs in with AuthKit.

1. Open `https://grogan.dev/auth/login` or `https://nero.grogan.dev/auth/login`.
2. Complete AuthKit (sign-in only; the email must be on Nero's allowlist).
3. AuthKit redirects to `/auth/callback`. Nero sets `wos-session` and sends the browser to `https://nero.grogan.dev/`.

If the email is not allowlisted, callback returns 403 and no session is set. Stop there.

## Step 4 — Claim ceremony

There is no device-code claim page and no `user_code`. Completing AuthKit login **is** the claim: the allowlisted human owns the session.

Do not tell the human to type a code into Nero. Do not open a `/claim` URL.

## Step 5 — Exchange the assertion

There is nothing to exchange. This host does not issue a service-signed `identity_assertion` and has no token endpoint.

Do not send `Authorization: Bearer <token>` to Nero APIs. A Bearer header is ignored; the request is unauthorized the same as a missing cookie.

## Step 6 — Use the session

Call Nero APIs with the human AuthKit session cookie. `/api/workspaces*` requires that session.

```http
GET /api/workspaces
Host: nero.grogan.dev
Cookie: wos-session=<sealed session>
```

```http
POST /api/workspaces
Host: nero.grogan.dev
Cookie: wos-session=<sealed session>
Content-Type: application/json

{ "name": "optional" }
```

```http
POST /api/workspaces/{id}/wake
Host: nero.grogan.dev
Cookie: wos-session=<sealed session>
```

Guest keep-awake (`POST /api/workspaces/{id}/job-heartbeat`) is a separate host token for `nero-run` inside the workspace. It is not an agent access_token and is not obtained from this file.

Workspace `/w/{workspaceId}/` is not wired in v1 yet (Caddy 501).

If you get a 401, return to [Step 1](#step-1--discover) and send the human through AuthKit again. Do not retry with a Bearer token.

## Errors

| Code / status | Where | What to do |
| --- | --- | --- |
| `401 unauthorized` | `/api/workspaces*` | No valid `wos-session`, or the email is not allowlisted. Read `WWW-Authenticate` and send the human to AuthKit (`GET /auth/login`). |
| `403 forbidden` | `/auth/callback` | Signed-in email is not on the allowlist. Stop. |
| `400` | `/auth/login`, `/auth/callback` | Bad host, missing code, or invalid state/PKCE. Restart at `GET /auth/login`. |
| `501` | `/w/*` | Workspace proxy not wired. |

## Revocation

The human signs out at `GET https://nero.grogan.dev/auth/logout` (or `https://grogan.dev/auth/logout`). That expires `wos-session`. There is no token revocation endpoint on this host.
