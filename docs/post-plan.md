# Nero post-plan roadmap

What to build **after** Nero v1 is complete and the tracked issues in
`docs/issues.md` are resolved. This file is roadmap only — no defects.

**Decision recorded (2026-08-28):** OpenRouter is retired after v1. All inference
moves to a self-built **Nero Router** (§1) with Z.ai as the main provider (§2),
a composer fast mode flipping to Baseten (§2), and subscription routing for
ChatGPT Pro and Grok (§3–4). The v1 OpenRouter-Baseten pin law holds only until
§1–2 land; that plan change happens here, not in v1.

Precedent research (Aug 2026): models.dev, Z.ai/Baseten docs, and how Zed,
OpenCode, Hermes (Nous), Cline, and Warp route subscriptions. Key sources are
linked inline.

**Status:** v1 is implemented and merged to main @ `5afbd24`. Sections 1–4
formalize the locally proven `claudeg` / `claudex` / `claudez` wrappers (Grok
OIDC, Codex OAuth, Z.ai-via-Baseten) into the router.

---

## 1. Nero Router (own router; OpenRouter retired)

- **Goal:** one routing layer for all model traffic, built from a models.dev
  catalog plus a hand-picked provider/model allowlist. No OpenRouter middleman,
  no upstream fallback surprises.
- **Catalog backbone — models.dev** (SST/anomalyco, MIT): TOML database of
  providers/models with pricing, context limits, modalities, and capability flags
  (tool_call, reasoning, attachments). Consume a **commit-pinned snapshot** of
  [api.json](https://models.dev/api.json) (or the offline `@opencode-ai/models`
  SDK) vendored in-repo, with an optional refresh job — never live-fetch at
  runtime. It is metadata-only: it gives model IDs/pricing/limits and partial
  endpoint hints, but **not** auth schemes, streaming details, rate limits, or
  health. OpenCode uses it exactly this way for 75+ providers.
- **Hand-picked override layer (ours):** per provider — canonical endpoint, auth
  method + credential resolution, transport quirks, rate limits, retry/timeout
  policy, cost caps, and router precedence/fallback order. Capability gating from
  models.dev flags (e.g., refuse image input on text-only `glm-5.3`).
- **Canonical model mapping:** Nero slugs → per-provider slugs. Known: the v1
  OpenRouter slug `z-ai/glm-5.3-flash`, Z.ai first-party `glm-5.3-flash`, Baseten
  `zai-org/GLM-5.3-Flash`. One internal name, many providers.
- **Placement:** start as a library inside `apps/daemon` (replacing
  `openrouter.ts`'s role), extract into a standalone service only if the portal
  or multiple daemons need it. Don't build the service first.
- **Takes:** pinned catalog + override schema, transport adapters (OpenAI-compat,
  Anthropic-compat, Responses), selection/fallback policy, cost/quota tracking,
  and migration of the v1 harness call sites.

## 2. Provider attach: Z.ai main, Baseten fast mode

**Main — Z.ai GLM Coding Plan** ([z.ai/subscribe](https://z.ai/subscribe),
[devpack docs](https://docs.z.ai/devpack/overview)):

- Endpoint: `https://api.z.ai/api/coding/paas/v4` (OpenAI-compat). **Gotcha:** the
  coding endpoint is what spends plan quota — the generic `/api/paas/v4` silently
  burns pay-as-you-go credits. Anthropic-compat also exists at `api.z.ai/api/anthropic`
  if a future agent wants Claude-protocol.
- Auth: `Z.AI_API_KEY` bearer; plan tiers (Lite/Pro/Max) bucket credits in
  rolling 5h + weekly windows; off-peak (outside Mon–Fri 14:00–18:00 SGT) costs
  half credits. Injection path reuses the guest env work from the v1 secret work.
- Models: `glm-5.3` (1M ctx, **text-only**), `glm-5.3-flash` (~1M ctx, natively
  multimodal — this is Nero's vision path), legacy slugs auto-route.
- **Vision caveat for the shot pipeline:** on the coding plan, vision is exposed
  as a "Vision Understanding" MCP with its own credit multiplier — inline image
  parts may not count as plan usage. Baseten flash takes plain OpenAI-style
  image messages. The harness image path must be tested against both.

**Fast mode — Baseten direct** ([Model APIs](https://docs.baseten.co/inference/model-apis/overview)):

- Endpoint: `https://inference.baseten.co/v1/chat/completions`, `BASETEN_API_KEY`,
  model `zai-org/GLM-5.3-Flash` (~$0.15/$0.50 per Mtok; cached in $0.03).
- UI: a **user-selected toggle in the composer** ("fast mode") that routes the
  thread's turns to Baseten while enabled. Per-token spend instead of plan quota;
  native inline images; historically best time-to-first-token on GLM.

| | Z.ai Coding Plan (main) | Baseten (fast mode) |
|---|---|---|
| Billing | Subscription credits, 5h/weekly windows | Per-token |
| Vision | MCP path, multiplies credits | Inline image messages |
| Protocol | OpenAI + Anthropic compat | OpenAI compat |
| Rate shape | Quota resets + throttles | Standard API limits |

**Fallback order:** plan quota (coding endpoint) → Z.ai PAYG on 429/exhaust →
fast mode only when the user flips it (never automatic — the toggle is the user's
cost control).

## 3. Subscription routing: ChatGPT Pro (Codex OAuth)

**Viable, and the pattern is established.** Zed (sanctioned partner,
[blog](https://zed.dev/blog/chatgpt-subscription-in-zed)), Cline, Roo, OpenCode,
and Hermes all reuse OpenAI's Codex OAuth; OpenAI publicly tolerates
subscription access for third-party tools.

- **Auth:** OAuth PKCE browser flow with loopback callback
  (`localhost:1455/auth/callback`), token endpoint `auth.openai.com/oauth/token`,
  the public Codex client_id. **Keep Nero's own token store** — never touch
  `~/.codex/auth.json` (refresh tokens are single-use/rotating; sharing the file
  invalidates sessions).
- **Inference:** `chatgpt.com/backend-api/codex` (Responses-shaped) against the
  plan's 5-hour + weekly windows. Pro is 5×/20× Plus quota. The router needs a
  Responses-protocol adapter; codex models are NOT reachable with an API key on
  subscription quota — the OAuth session is the product.
- **Posture:** sanctioned for Zed, gray-but-tolerated for unregistered tools.
  Consider pinging OpenAI for partnership once the router is real.

## 4. Subscription routing: Grok Heavy — VIABLE (official path)

Corrected verdict (an earlier pass wrongly marked Heavy "no programmatic
route"): **Grok Build, xAI's official coding harness, is open source**, and it
is the sanctioned way to run Grok Heavy inside a harness — it authenticates
with xAI OIDC (`https://auth.x.ai`, first-party client) against subscription
quota, Heavy included. This works today; the local `claudeg` setup proves it
end to end.

- **Local reference (working now):** `~/.local/bin/claudeg` — Claude Code with a
  Grok brain via `claude-code-proxy` (brew `raine/claude-code-proxy`) on
  `127.0.0.1:18765`. `claudeg-sync-auth` imports the Grok CLI login
  (`~/.grok/auth.json`: OIDC tokens keyed `issuer::client_id`, JWT-expiry
  tracked, refresh token present) into the proxy's grok backend; model defaults
  `grok-4.6` main / `grok-4.5` fast. Companion wrappers: `claudex`
  (ChatGPT/Codex) and `claudez` (Z.ai GLM via Baseten).
- **Nero Router implementation:** an xAI OIDC auth adapter (browser/device flow
  mirroring Grok Build's open-source client; Nero-owned token store with
  rotating-refresh handling; a fast-path importer for `~/.grok/auth.json` so
  existing logins just work) plus a Grok transport adapter. Transport split to
  respect: the **OIDC subscription session is what serves Heavy**; the
  pay-per-token `api.x.ai` catalog serves non-heavy (`grok-4.6`) only. Router
  policy: Heavy models route over the OIDC path; `grok-4.6` may fall back to the
  metered API.
- **ToS posture:** this rides the official open-source harness's own auth path —
  cleaner than the third-party Codex client_id reuse in §3.

## 5. Seat judge (video/audio)

- **Goal:** record seat sessions (frames at turn boundaries or continuously) and
  run a judge model over the recording to score or veto agent behavior.
- **Takes:** frame capture on the seat compositor or a KasmVNC stream tap,
  storage on the workspace dataset, judge-model calls (now routable via §1),
  and a policy for what judging can do (annotate vs. abort a turn).
- **Open questions:** judge model choice, retention, latency budget — judging
  must not stall the interactive loop.

## 6. Docker-in-Docker

- **Goal:** agents build/run containers inside their workspace (render farms,
  service stacks, test harnesses).
- **Takes:** nested daemon or rootless (podman) in the guest image, storage +
  cgroup policy on `grid`, security review — the workspace already holds an
  agent; nested Docker widens what escape means.
- **Open questions:** rootless vs. privileged; whether nested containers share
  the workspace's 64G cap.

## 7. Multi-user AuthKit directory

- **Goal:** directory-backed users with per-user workspaces, replacing the
  single-allowlisted-human model (`NERO_ALLOWED_EMAILS`).
- **Takes:** directory roles/orgs, per-user admission budgets (the ~two-awake
  invariant is global for one human today), workspace ownership in the control
  plane, and rewriting the "single human" claims in `auth.md` (§9).
- Data isolation is already per-workspace (dataset + container); the work is
  control-plane and policy.

## 8. GPU for the seat

- **Goal:** real GL in the seat (Blender viewport/renders, Chromium compositing)
  instead of llvmpipe.
- **Takes:** Grid-01 hardware decision (passthrough vs. time-sliced), drivers in
  the guest image, cgroup device controls, and GPU as a new scarce resource in
  the admission math (like the 64G budget), with llvmpipe fallback when none
  are free.

## 9. Checkpoints → time-travel product

- **Goal:** browse a thread's checkpoint timeline, diff any two turns, restore a
  workspace to a checkpoint, inline diffs in ChatView.
- **Takes:** UI over the existing store (`apps/daemon/src/checkpoints.ts` —
  per-turn git trees, revert RPC, supersede, secret excludes), wiring
  `orchestration.getTurnDiff`/`getFullThreadDiff` to it, retention policy.
- Highest-leverage feature that falls out of v1 for free; the store is already
  built and tested.

## 10. Full agentic auth (beyond honest-v1 auth.md)

- **Goal:** agents authenticate as agents — per-agent credentials minted and
  scoped (read-only vs. turn-capable), revocation, and a `WWW-Authenticate` that
  points at a real token endpoint instead of a doc that says "don't."
- **Takes:** WorkOS agentic auth end-to-end, a credential store in the control
  plane, per-agent scopes, rewriting `auth.md` + the 401 challenge path.
- Interacts with §7 (per-agent admission policy) and §1 (per-agent model budgets
  through the router).

---

Explicitly **not** on the roadmap (excluded by the plan, unchanged): T3
desktop/mobile clients. The adapted skin is web-only for Nero.
