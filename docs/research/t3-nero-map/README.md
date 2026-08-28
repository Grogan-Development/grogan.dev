# T3 → Nero change map

Upstream: `pingdotgg/t3code` `0009aacdf146e0532327fa3d9d0109d5adca68b9`.

Law: **copy the listed tree, then apply the file-level change maps.** Do not rewrite the UI. Do not copy T3 server. After adapt there is no T3 product left (Connect, five harnesses, Clerk-for-T3, self-update, T3 branding).

Nero remains a Pi-like coding harness (bash + files, GLM-5.3-Flash streamed via OpenRouter pinned to Baseten) wearing this skin. See root `PLAN.md`.

## Copy-set (closed)

`apps/web` depends on **only** `@t3tools/client-runtime`, `@t3tools/contracts`, `@t3tools/shared`. Also take `native/libghostty-vt` (web terminal WASM pin) and the slim workspace roots in `00-copy-set.md` (pnpm/vite-plus/`vp`).

**Do not copy:** `apps/server`, `apps/desktop`, `apps/mobile`, `apps/marketing`, `infra/relay`, `packages/effect-acp`, `packages/effect-codex-app-server`, `packages/ssh`, `packages/tailscale`, `packaging/`, `native/resource-monitor`, `experiments/`. See `09-do-not-copy.md`.

T3 Connect is not one folder. After copy, **delete** nested Connect/Clerk/DPoP/relay files inside web + runtime + contracts + shared (`09`, `02`, `08`).

## Route map

T3 `environment` (one connected agent server) = Nero **workspace** (one Docker+ZFS box). Not a T3 project.

Replace `/$environmentId/$threadId` with `/w/$workspaceId/$threadId`. Drop `/pair` and `/connect`. `/` is workspace picker or last-workspace redirect. Details: `03-web-shell-auth-env.md`.

## Single provider

`ServerConfig.providers` is one row: `instanceId` + `driver` = `nero`, model `zai-org/GLM-5.3-Flash`. `ProviderDriverKind` is an open slug. Delete the Providers wizard and self-update. Skills/slash stay as names from that snapshot. Details: `01-contracts-rpc.md`, `07-settings-providers.md`.

## What the skin already is

Right panel tabs: preview | terminal | files | file | diff | pull-request | agents. Chat is the main column. Terminal drawer (`mod+j`) is extra, not a tab.

- **Threads** — copy `ChatView` / composer / sidebar; drop worktree-first-send, OpenCode plan mode, multi-provider picker (`04-threads-chat.md`). Shared cwd.
- **Files / diffs / git** — copy Pierre tree, diffs, PR inbox (restub `pullRequests.*` to `gh` in the workspace). Delete worktree chrome; `cwd` is always workspace root (`05-files-diffs-git.md`).
- **Terminal** — copy Ghostty WASM + `terminal.*` RPCs. Works on web today (`06-terminal-preview-browser.md`).
- **URL preview / “browser” tab** — **desktop-only in T3.** Web shows “Preview is only available in the T3 Code desktop app.” Pixels are an Electron `<webview>`. Nero **must implement** in-browser preview (iframe / stream of workspace ports and the agent seat). Do not ship the empty desktop gate.
- **Seat** — T3 has no virtual display. Mini-player is window chrome. Nero seat is new surface behind the same preview tab (or a sibling tab), not T3 Connect.

## RPC

97 `WS_METHODS` + 8 orchestration methods + 23 client commands, each tagged IMPLEMENT / ADAPT / DELETE in `01-contracts-rpc.md`. Dead names: `projects.list` / `add` / `remove`. Nero implements every method the **adapted** UI still calls. Delete methods only with the UI that called them.

Client-runtime: keep `/ws` + HTTP snapshots + bearer ticket; delete `./relay` (`02-client-runtime.md`).

## Build

Copy Vite+ (`vp`, `vite-plus@0.2.2`). Web does not import `apps/server`; dropping it does not break `vp build` for web. Do not copy `t3.json` / `scripts/dev-runner.ts`. Nero runner sets PORT and single-origin proxy to the **Nero** harness (`11-build.md`).

## Slice index

| File | Slice |
| --- | --- |
| [00-copy-set.md](00-copy-set.md) | Package roots |
| [01-contracts-rpc.md](01-contracts-rpc.md) | Every RPC / command |
| [02-client-runtime.md](02-client-runtime.md) | Connection / snapshots |
| [03-web-shell-auth-env.md](03-web-shell-auth-env.md) | Router, env → workspace, auth |
| [04-threads-chat.md](04-threads-chat.md) | Chat, composer, sidebar |
| [05-files-diffs-git.md](05-files-diffs-git.md) | Files, diffs, git, PR |
| [06-terminal-preview-browser.md](06-terminal-preview-browser.md) | Terminal, preview, assets |
| [07-settings-providers.md](07-settings-providers.md) | Settings, one provider |
| [08-shared.md](08-shared.md) | `@t3tools/shared` modules |
| [09-do-not-copy.md](09-do-not-copy.md) | Hard skip list |
| [10-web-glue.md](10-web-glue.md) | UI kit, hooks, lib, state |
| [11-build.md](11-build.md) | `vp` / vite-plus |

Any later plan is required to follow these tables, not a vibes subset.
