# 11 — Build / tooling (vp, Vite+, web-only)

Primary-source map of how T3 Code **builds the web app**, what of that toolchain Nero must copy, and what actually breaks if `apps/server` is absent.

Source: `pingdotgg/t3code` HEAD `0009aacdf146e0532327fa3d9d0109d5adca68b9` at `/tmp/t3code-upstream`. No previous Nero tree was consulted. Aligns with [`00-copy-set.md`](./00-copy-set.md) (copy web + client-runtime + contracts + shared; no T3 server) and [`09-do-not-copy.md`](./09-do-not-copy.md).

Policy: Nero is a **website skin**. Copy the T3 frontend toolchain, then CHANGE MAP names (`@t3tools` → Nero scope, `T3CODE_*` → Nero env). Do not invent a parallel Vite 6 / Vitest / ESLint / Prettier stack on day one.

---

## Verdict

**Copy Vite+ (`vp` + local `vite-plus`).** It is the whole frontend toolchain, not a Vite wrapper you can peel off.

Dropping `apps/server` **does not** break:

- `vp run --filter @t3tools/web build` (static SPA into `apps/web/dist`)
- `vp run --filter @t3tools/web typecheck`
- `vp run --filter @t3tools/web test`
- hosted Vercel install/build (already does not compile `t3`)

Dropping `apps/server` **does** break T3-shaped local product:

- root `vp run dev` / `pnpm dev` (dev-runner always starts package `t3`)
- root `vp run start` (`--filter t3`)
- minting pairing tokens (`node apps/server/src/bin.ts pair`)
- serving the built SPA from the published CLI (`npx t3` copies `apps/web/dist` → `apps/server/dist/client`)
- Vite’s single-origin proxy target (`T3CODE_PORT` → `/api`, `/oauth`, `/.well-known`, `/ws`)

Libraries in the copy-set (`contracts`, `shared`, `client-runtime`) have **no `build` / `pack` task**. Vite resolves their `exports` to `src/*.ts`. Nero does not need `vp pack` unless it later publishes those packages.

---

## 1. What Vite+ is here

Vite+ is two pieces ([viteplus.dev](https://viteplus.dev/guide/)):

| Piece | Role in this repo |
| --- | --- |
| Global `vp` CLI | Installed via `curl -fsSL https://vite.plus \| bash`. Not in the git tree. CI: `voidzero-dev/setup-vp@v1`. Vercel: `npm install -g vite-plus`. |
| Local `vite-plus@0.2.2` | Root + every workspace that tests or bundles. Catalog-pinned. |

`vp` is **not** pnpm with extra flags. It is:

| Surface | T3 usage |
| --- | --- |
| Package manager | `vp i` / `vp install` → pnpm 11 from `"packageManager": "pnpm@11.10.0"` |
| Task runner | `vp run` / `vpr` (alias). Root scripts are `vp run --filter …`. `vpr typecheck` in CI. |
| App bundler | `vp dev` / `vp build` / `vp preview` = Vite 8 (Rolldown) via the catalog alias |
| Tests | `vp test` = bundled Vitest 4; imports are `vite-plus/test`, never `vitest` |
| Lint / format | `vp lint` = Oxlint, `vp fmt` = Oxfmt, `vp check` = both. Config lives in root `vite.config.ts`, not `.oxlintrc` / Prettier. |
| Git hooks | `vp config --no-agent` in `prepare`; `staged` block formats on commit |
| Library pack | `vp pack` = tsdown. **Server + desktop only.** Web never calls it. |
| Node / env | `vp env` can manage Node. Repo still pins `"engines": { "node": "^24.13.1" }`. |

Built-in `vp dev` / `vp test` / `vp build` are **not** the `package.json` scripts. `vp run dev` / `vpr dev` **are**. Web’s scripts are thin wrappers (`"dev": "vp dev"`), so `vp run --filter @t3tools/web dev` ends up in the builtin. Root `"dev"` is **not** that — it is `node scripts/dev-runner.ts dev`.

Catalog alias (must keep, or plugins resolve a second Vite):

```yaml
# pnpm-workspace.yaml
catalog:
  vite: npm:@voidzero-dev/vite-plus-core@0.2.2
  vite-plus: 0.2.2
overrides:
  vite: "catalog:"
packageExtensions:
  vite-plus@*:
    dependencies:
      vite: "catalog:"
peerDependencyRules:
  allowAny: [vite]
  allowedVersions:
    vite: "*"
```

Every workspace that lists `vite-plus` also lists `vite: "catalog:"` as a direct devDependency so pnpm does not auto-install upstream Vite next to Vite+ core.

`@effect/vitest` is patched to re-export `vite-plus/test` instead of `vitest` (`patches/@effect__vitest@4.0.0-beta.103.patch`). Dropping Vite+ without dropping that patch splits the test runner.

---

## 2. Workspace the web build actually walks

`pnpm-workspace.yaml` today: `apps/*`, `infra/*`, `oxlint-plugin-t3code`, `packages/*`, `scripts`.

Web’s runtime workspace graph is closed ([`00-copy-set.md`](./00-copy-set.md)):

```
@t3tools/web
  → @t3tools/client-runtime → @t3tools/contracts, @t3tools/shared
  → @t3tools/contracts
  → @t3tools/shared → @t3tools/contracts
```

Tooling-only edges (not `workspace:*` in `apps/web/package.json`, but required to compile/check):

| Edge | Why |
| --- | --- |
| `apps/web/vite.config.ts` → `scripts/lib/public-config.ts` | relative import; `loadRepoEnv()` |
| `apps/web/tsconfig.json` `include` | `../../scripts/lib/public-config.ts` |
| `apps/web/vite.config.ts` → `@t3tools/shared/devProxy` | `DEV_PROXIED_PATH_PREFIXES` |
| root `vite.config.ts` → `./oxlint-plugin-t3code/index.ts` | `lint.jsPlugins` |
| root `prepare` → `scripts/clean-tsgo-backups.mjs` | `effect-tsgo patch` hygiene |
| `apps/web/vercel.ts` → `scripts/apply-web-brand-assets.ts` | hosted channel icons **after** `vp build` |

Nero workspace after shrink (names adapted):

```
apps/web
packages/client-runtime
packages/contracts
packages/shared
# optional: oxlint-plugin (if keeping vp lint rules)
# not a workspace member: scripts/lib/public-config.ts — inline into apps/web
```

Do **not** keep `apps/*` / `packages/*` globs if those directories still contain leftover T3 apps. Name the four packages explicitly.

`@t3tools/scripts` as a workspace package is **not** required for `vp build`. Vercel only filters it because the post-build brand script and its Effect CLI deps live there. If Nero drops channel icons, drop that filter.

---

## 3. Command graph (today vs Nero)

### 3.1 First checkout

```bash
curl -fsSL https://vite.plus | bash   # global vp
vp i                                  # pnpm install
vp run dev                            # NOT the web app alone
```

`t3.json` `runOnWorktreeCreate`:

```
vp i && ln -sf $T3CODE_PROJECT_ROOT/.env .env && ln -sf $T3CODE_PROJECT_ROOT/infra/relay/.env infra/relay/.env && node apps/web/scripts/warm-dep-cache.ts
```

**Delete `t3.json`.** It is T3-the-product’s project file (`t3.codes/schema`), not Vite config. The relay `.env` symlink is Connect. Warm-dep-cache is worth keeping as a Nero setup script.

`prepare` (root `package.json`):

```
node scripts/clean-tsgo-backups.mjs && effect-tsgo patch && vp config --no-agent
```

Copy the backup cleaner. Keep `effect-tsgo patch` as long as typecheck is `tsgo --noEmit`. `--no-agent` = git hooks without writing agent instruction files.

### 3.2 Dev

| Command | What it actually runs |
| --- | --- |
| `vp run dev` / `pnpm dev` | `scripts/dev-runner.ts` → `vp run --filter=@t3tools/contracts --filter=@t3tools/web --filter=t3 --parallel dev` |
| `vp run dev:web` | same runner, `--filter=@t3tools/web` only, still sets `T3CODE_PORT` as if a backend existed |
| `vp run --filter @t3tools/web dev` | Vite on `PORT` (default 5733). **No pairing URL, no backend.** |
| `vp -C apps/web dev` | same builtin, skips root script |

Dev-runner extras Nero should **not** copy (`scripts/dev-runner.ts`, `scripts/lib/dev-share.ts`): worktree `.t3` home, hashed port offsets, Tailscale share, `T3CODE_BUNDLED_DEV=1` default on `--share`, pairing URL print. Contracts has **no `dev` script** — the `--filter=@t3tools/contracts` in `MODE_ARGS.dev` is a no-op today.

What web Vite **does** need from a runner (keep the contract, rewrite the process):

| Env | Purpose |
| --- | --- |
| `PORT` | Vite bind (base 5733) |
| `T3CODE_PORT` | proxy target `http://localhost:<port>/` |
| `T3CODE_SINGLE_ORIGIN_DEV=1` | force empty `VITE_HTTP_URL` / `VITE_WS_URL` even if `.env` has them |
| `T3CODE_BUNDLED_DEV` | experimental Rolldown-bundled dev (cold graph over LAN) |
| `T3CODE_DEV_ALLOWED_HOSTS` | extra `server.allowedHosts` (`.ts.net` is hardcoded) |
| `T3CODE_WEB_SOURCEMAP` | `true` / `hidden` / `false` |
| `HOST` | **do not set** for browser dev — pins HMR to that host |

AGENTS.md rule still applies after copy: never bake `VITE_HTTP_URL` / `VITE_WS_URL` for browser dev.

### 3.3 Build / check / test

| Command | Web-only meaning |
| --- | --- |
| `vp run --filter @t3tools/web build` | `vp build` → `apps/web/dist`. The **only** production JS Nero needs from this tree. |
| `vp run --filter @t3tools/web typecheck` | `tsgo --noEmit` (Effect’s TypeScript-Go, not `tsc`) |
| `vp run --filter @t3tools/web test` | `vp test run --passWithNoTests --project unit` |
| `vp run -r typecheck` / `vpr typecheck` | every workspace `typecheck` script, concurrency 2 |
| `vp lint` / `vp fmt` / `vp check` | root `vite.config.ts`. This repo sets `lint.options.typeCheck: false` — `vp check` is format+lint only |
| `vp run --filter @t3tools/web build:ghostty-wasm` | Zig rebuild of committed wasm; not on the default `build` path |
| root `vp run build` | fans out `build` to every workspace that **defines** it: web, marketing, desktop, **server**. Server’s `build` is a Vite Task (`dependsOn: ["@t3tools/web#build"]`) then copies `apps/web/dist` → `apps/server/dist/client`. |
| `build:contracts` | `vp run --filter @t3tools/contracts build` — contracts has **no** `build` script. Dead. |

Hosted web (already server-free):

```ts
// apps/web/vercel.ts
installCommand:
  "npm install -g vite-plus && vp install --ignore-scripts --filter '@t3tools/scripts...' --filter '@t3tools/web...'"
buildCommand:
  'vp run --filter @t3tools/web build && node ../../scripts/apply-web-brand-assets.ts --channel "${VITE_HOSTED_APP_CHANNEL:-latest}"'
```

CI web preview (`.github/workflows/web-preview.yml`) is the same filter pair via `setup-vp` `run-install`. Full CI still installs the whole monorepo and `vp run build:desktop`.

---

## 4. Config files (copy / adapt / delete)

### 4.1 Root `vite.config.ts`

Workspace-level Vite+ config. **Copy, then shrink.**

| Block | Keep for Nero? |
| --- | --- |
| `resolve.alias["~"]` → `apps/web/src` | yes (matches web `tsconfig` paths) |
| `test` (node env, 60s timeouts, excludes) | yes |
| `staged["*"]` = `vp fmt …` | yes |
| `fmt` ignorePatterns | yes; drop `apps/mobile/**` |
| `lint` plugins + `jsPlugins: oxlint-plugin-t3code` | yes if keeping Oxlint; else drop plugin and custom `t3code/*` rules |
| `lint.rules` `eslint/no-restricted-imports` for `@t3tools/client-runtime` root | **adapt** the package name |
| `t3code/no-mobile-uniwind-theme-escape-hatches` | delete with mobile |
| `t3code/no-native-title-tooltip` | keep (web Tooltip) |
| `lint.options.typeAware/typeCheck: false` | keep until tsgolint + `@effect/tsgo` integrate |

This file is **not** the web app config. `vp -C apps/web dev` uses `apps/web/vite.config.ts`. Root config still owns lint/fmt/staged for the whole repo.

### 4.2 `apps/web/vite.config.ts`

This **is** the app. Copy and retarget.

Plugins (order): custom Brotli-5 `devCompressionPlugin` (serve only) → `tanstackRouter()` → `react()` → `@rolldown/plugin-babel` + `reactCompilerPreset` → `tailwindcss()`.

Notable options:

- `assetsInclude: ["**/*.wasm"]` — Ghostty
- `optimizeDeps.include` — Clerk, Pierre diffs, `effect/Array`, `effect/Order`, `react-dom/client`
- `resolve.tsconfigPaths: true` + `dedupe: ["react", "react-dom"]`
- `experimental.bundledDev` from `T3CODE_BUNDLED_DEV`
- `server.warmup.clientFiles: ["./src/main.tsx"]`
- `server.allowedHosts`: `.ts.net` plus `T3CODE_DEV_ALLOWED_HOSTS`
- proxy: one entry per `DEV_PROXIED_PATH_PREFIXES`; `/ws` sets `ws: true`
- `build.outDir: "dist"`, sourcemap from `T3CODE_WEB_SOURCEMAP`
- `test.projects`: unit project, `src/**/*.test.{ts,tsx}`, 15s timeouts

`define` bakes public env at config-eval time (not Vite’s automatic `VITE_*` scan), so single-origin can **force empty** HTTP/WS URLs:

`VITE_WS_URL`, `VITE_HTTP_URL`, `VITE_T3CODE_RELAY_URL`, `VITE_CLERK_*`, `VITE_RELAY_OTLP_*`, `VITE_HOSTED_APP_URL`, `VITE_HOSTED_APP_CHANNEL`, `APP_VERSION`.

Nero CHANGE MAP: drop Clerk/relay/hosted-channel defines; keep HTTP/WS empty in browser dev; point proxy at the Nero harness.

`loadRepoEnv()` duplicates Clerk/relay keys into `T3CODE_*`, `VITE_*`, and `EXPO_PUBLIC_*`. After Connect dies, this helper can shrink to a handful of Nero public keys or go away.

### 4.3 Package Vite configs in the copy-set

| File | Purpose |
| --- | --- |
| `packages/client-runtime/vite.config.ts` | tests only (`environment: "node"`, `src/**/*.test.ts`) |
| `packages/contracts` | **none** — `vp test run` uses root defaults |
| `packages/shared` | **none** — same |
| `apps/server/vite.config.ts` | `mergeConfig(root, { run.tasks.build.dependsOn: ["@t3tools/web#build"], pack: … })` — **do not copy** |
| `apps/desktop/vite.config.ts` | `dependsOn: ["t3#build"]` + `vp pack` Electron — **do not copy** |

### 4.4 tsconfig graph

There is **no** root `tsconfig.json`. Project references are not used as a solution. Each package extends `tsconfig.base.json` and typechecks itself with `tsgo --noEmit`.

`tsconfig.base.json` (copy):

- `module`/`moduleResolution`: `NodeNext`
- `noEmit`, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`
- `erasableSyntaxOnly` + `verbatimModuleSyntax` (web **turns these off**)
- `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- `@effect/language-service` plugin with a large `diagnosticSeverity` map (not a package.json dependency; editor-only)

| Package | Extends | Extra |
| --- | --- | --- |
| `apps/web` | base | `composite`, `module: Preserve`, `moduleResolution: Bundler`, `jsx: react-jsx`, `lib: ES2023+DOM`, `paths: { "~/*": ["./src/*"] }`. Relaxes Effect `globalDate/Console/Random/Timers/Fetch` to `off`. Includes `src`, `vite.config.ts`, `vercel.ts`, `test`, `scripts/warm-dep-cache.ts`, `scripts/lib/public-config.ts`. |
| `packages/client-runtime` | base | `include: ["src"]` only |
| `packages/contracts` | base | empty `compilerOptions` override |
| `packages/shared` | base | `types: ["node"]` — Nero should drop this if Node-only modules are deleted ([`08-shared.md`](./08-shared.md)) |

`tsgo` comes from `@effect/tsgo` + `@typescript/native-preview` (catalog). `typescript: ~6.0.3` is also catalog-pinned. Do not switch these scripts to `tsc` without a separate decision — Effect code in this repo is written against tsgo + the language-service plugin.

### 4.5 Other web files that look like tooling

| File | Copy? |
| --- | --- |
| `apps/web/index.html` | yes (boot splash + `/src/main.tsx`); rebrand |
| `apps/web/components.json` | shadcn/coss/spell registries; optional |
| `apps/web/vercel.ts` | only if Nero hosts a SPA on Vercel |
| `apps/web/src/vite-env.d.ts` | `/// <reference types="vite-plus/client" />` — keep |
| `apps/web/src/vite-plus-browser-matchers.d.ts` | `vite-plus/test` `expect.element` — keep if tests stay |
| `apps/web/src/routeTree.gen.ts` | committed; TanStack plugin regenerates; fmt-ignored |
| `apps/web/public/mockServiceWorker.js` | MSW worker; root `package.json` `msw.workerDirectory` |
| `apps/web/THIRD_PARTY_NOTICES.md` | legal |

---

## 5. Scripts the web build actually uses

Copy **files**, not the `@t3tools/scripts` package (that package.json pulls `@t3tools/tailscale`, electron-asar, pngjs).

| Script | Used by | Nero |
| --- | --- | --- |
| `scripts/lib/public-config.ts` | `apps/web/vite.config.ts`, web tsconfig include | **copy then inline** into `apps/web` (or a tiny `packages/build-config`). Strip Clerk/relay/Expo aliases. |
| `scripts/clean-tsgo-backups.mjs` | root `prepare` | **copy**. Prevents `effect-tsgo patch` hitting 101 backups on cached `node_modules` (Vercel). |
| `apps/web/scripts/warm-dep-cache.ts` | `t3.json` setup | **copy**. Calls `vite.optimizeDeps` against the web root. Each worktree must warm its own cache (config hash includes absolute path). |
| `apps/web/scripts/build-libghostty-wasm.sh` + `ghostty-write-pty.zig` | manual `build:ghostty-wasm` | **copy**. Cache dir `~/.cache/t3code` → Nero name. Needs Zig 0.15.2 + Ghostty source at `native/libghostty-vt/VERSION`. Default `vp build` uses committed wasm and does **not** run this. |
| `scripts/apply-web-brand-assets.ts` + `scripts/lib/brand-assets.ts` | Vercel `buildCommand` | copy only if Nero has channel icons; else drop and put marks in `apps/web/public` |
| `scripts/dev-runner.ts` + `lib/dev-share.ts` | root `dev` / `dev:web` / `dev:share` | **delete** (agrees with `00-copy-set`). Write a Nero runner that only sets `PORT` + harness port + `T3CODE_SINGLE_ORIGIN_DEV`. |
| `scripts/export-brand-icons.ts` | `icons:export` | optional; assets pipeline |
| everything else under `scripts/` | desktop/mobile/release/Connect | **delete** |

`native/libghostty-vt/` is not a JS workspace member but **is** a build input for wasm rebuilds. Copy it ([`00-copy-set.md`](./00-copy-set.md), [`06-terminal-preview-browser.md`](./06-terminal-preview-browser.md)).

---

## 6. Catalog, patches, allowBuilds (web-only cut)

Keep (web + runtime + contracts + shared + tests):

| Catalog / pin | Who |
| --- | --- |
| `vite`, `vite-plus` | toolchain |
| `effect`, `@effect/atom-react`, `@effect/vitest`, `@effect/platform-node` (dev), `@effect/tsgo` | runtime + tests + typecheck |
| `typescript`, `@typescript/native-preview`, `@types/node` | tsgo |
| `@noble/curves`, `@noble/hashes`, `jose`, `yaml` | shared (yaml only if `schemaYaml` is kept; [`08-shared.md`](./08-shared.md) says drop it) |
| `@clerk/react`, `@clerk/electron`, `@clerk/shared` | **delete after Connect/Clerk CHANGE MAP**; listed here because web `main.tsx` imports them **today** |
| `@legendapp/list`, `@pierre/diffs` | web UI |

Patches **required** for a faithful copy:

- `patches/effect@4.0.0-beta.103.patch`
- `patches/@effect__vitest@4.0.0-beta.103.patch`
- `patches/@legendapp__list@3.3.5.patch`
- `patches/@pierre%2Fdiffs@1.3.0-beta.10.patch`

Patches **not** for this tree: Clerk Expo, Expo/RN, `@ff-labs/fff-node` (server).

`allowBuilds` after drop-server: keep `esbuild: true`. Drop `electron`, `node-pty`, `msgpackr-extract`, `sharp` unless something else still needs them. `msw: false` can stay (worker is committed).

`minimumReleaseAgeExclude` is a long Clerk/Effect/Alchemy list — trim to what remains.

---

## 7. What breaks if we drop `apps/server`

Web **does not import** `apps/server`. The reverse is true: package `t3` has `@t3tools/web` as a **devDependency**, Vite Task `dependsOn: ["@t3tools/web#build"]`, and `apps/server/scripts/cli.ts` copies `apps/web/dist` → `dist/client` (warns and continues if missing).

### Still green (compile / unit)

- Install with `--filter @t3tools/web...` (and the three packages).
- `vp build` / `typecheck` / `test` in web, client-runtime, contracts, shared.
- Oxlint/Oxfmt (ignore globs that mention `apps/server` are harmless).
- Hosted static deploy (Vercel already omits `t3`).
- Committed Ghostty wasm.

### Red or lying (product / dev)

| Symptom | Why |
| --- | --- |
| `vp run dev` fails or tries to run `t3#dev` | root script + `MODE_ARGS.dev` includes `--filter=t3`. `t3`’s `dev` is `node --watch src/bin.ts`. |
| `vp run start` fails | `"start": "vp run --filter t3 start"` |
| Vite starts, UI boots, RPC/HTTP get `index.html` | no `T3CODE_PORT` → no proxy; SPA fallback serves HTML for `/api` and `/ws`. This is the failure `DEV_PROXIED_PATH_PREFIXES` exists to prevent. |
| Pairing URL is gone | minted by the server CLI, not Vite. |
| `npx t3` / published CLI gone | that **is** `apps/server`. Nero must serve `apps/web/dist` itself (CDN, Nero control plane, or a one-line static server). |
| `t3.json` setup `ln … infra/relay/.env` fails | Connect; delete the file. |
| Version skew UI | client `APP_VERSION` compared to server config over RPC — needs a Nero equivalent or deletion. |
| oxlint `no-manual-effect-runtime-in-tests` baseline | lists many `apps/server/…` paths. Harmless leftovers; trim the map. |

### Runtime shape Nero must replace

The SPA is a **client** of Effect RPC over `/ws` plus HTTP snapshots under `/api` ([`02-client-runtime.md`](./02-client-runtime.md)). Without **some** harness implementing `packages/contracts` (`WsRpcGroup`, `EnvironmentHttpApi`), `vp build` still produces a bundle that can only show chrome / pairing / empty catalog.

That harness is **not** this copy. Do not accidentally keep `apps/server` “just so `vp run dev` works.”

---

## 8. Must-copy tooling vs optional

### Must copy (web will not build/check as T3 web otherwise)

1. Global `vp` (install instruction, not a git path) + local `vite-plus` + `vite` catalog alias to `@voidzero-dev/vite-plus-core@0.2.2`
2. `pnpm-workspace.yaml` (shrunk) + `packageManager: pnpm@11.10.0` + catalog/overrides/packageExtensions/peerDependencyRules as above
3. Root `package.json` (trimmed scripts + `prepare` + `engines.node ^24.13.1`)
4. Root `vite.config.ts` (lint/fmt/test/staged + `~` alias)
5. `tsconfig.base.json` + the four package `tsconfig.json`s
6. `apps/web/vite.config.ts`, `package.json`, `index.html`
7. `packages/{client-runtime,contracts,shared}/package.json` (source `exports`, `typecheck`/`test` scripts, `vite-plus` + `@effect/vitest` devDeps)
8. `packages/client-runtime/vite.config.ts`
9. Four patches listed in §6
10. `scripts/clean-tsgo-backups.mjs` (or fold into `prepare`)
11. `scripts/lib/public-config.ts` until inlined
12. `@effect/tsgo`, `@typescript/native-preview`, `effect-tsgo patch`

### Copy if Nero keeps T3’s check/dev UX

- `oxlint-plugin-t3code` (rename plugin `t3code` → `nero`; drop uniwind rule; trim server baselines)
- `apps/web/scripts/warm-dep-cache.ts`
- `native/libghostty-vt` + wasm rebuild scripts
- `assets/{dev,nightly,prod}/*web*` then rebrand
- `.github/workflows/web-preview.yml` pattern (`setup-vp` + `vp dlx vercel`)

### Do not copy for build

- `apps/server` (including its `vite.config.ts` `pack` / `run.tasks`)
- `scripts/dev-runner.ts`
- `t3.json`
- `vp pack` config, `cli-external-packages.ts`, desktop artifact scripts
- `infra/relay`, Alchemy, `workerd` allowBuilds
- root scripts `build:desktop`, `dist:desktop:*`, `migrate-dev-db`, `start`

### Do not rewrite on day one

Replacing Vite+ with stock Vite 8 + Vitest 4 + Oxlint + Oxfmt + pnpm is possible but is a **second product**: every `from "vite-plus"`, every `from "vite-plus/test"`, the `@effect/vitest` patch, catalog alias, `prepare` hook, Vercel install, and CI action. Copy first; CHANGE MAP names; only then consider leaving Vite+.

---

## 9. Nero CHANGE MAP (tooling only)

| T3 | Nero |
| --- | --- |
| `@t3tools/web` | Nero web package name |
| `@t3tools/client-runtime` / `contracts` / `shared` | same scope rename; update lint restricted-import |
| `@t3tools/oxlint-plugin-t3code` / plugin id `t3code` | Nero plugin id |
| `@t3tools/monorepo` | Nero root name |
| `T3CODE_*` env | Nero prefix; keep the single-origin **behavior** |
| `VITE_T3CODE_RELAY_URL`, `VITE_CLERK_*`, `VITE_HOSTED_APP_*` | delete with Connect |
| `t3.json` | delete; optional Nero worktree setup = `vp i` + warm-dep-cache |
| `scripts/dev-runner.ts` | small runner: Vite + proxy to Nero harness port |
| `DEV_PROXIED_PATH_PREFIXES` | keep list in sync with **Nero** HTTP/WS paths |
| `~/.cache/t3code` in Ghostty script | Nero cache dir |
| `app.t3.codes` in `vercel.ts` / `DEFAULT_HOSTED_APP_URL` | `nero.grogan.dev` or drop hosted-static mode |
| `msw.workerDirectory: apps/web/public` | keep if MSW tests stay |

---

## 10. First-pass copy list (tooling slice)

Do this, then CHANGE MAP. App source copy-set is [`00-copy-set.md`](./00-copy-set.md).

```
package.json                         # shrink scripts
pnpm-workspace.yaml                  # four (or five) members; trim catalog
tsconfig.base.json
vite.config.ts                       # drop mobile globs; rename lint rule
apps/web/package.json
apps/web/tsconfig.json
apps/web/vite.config.ts
apps/web/index.html
apps/web/vercel.ts                   # optional
apps/web/scripts/warm-dep-cache.ts
apps/web/scripts/build-libghostty-wasm.sh
apps/web/scripts/ghostty-write-pty.zig
packages/client-runtime/{package.json,tsconfig.json,vite.config.ts}
packages/contracts/{package.json,tsconfig.json}
packages/shared/{package.json,tsconfig.json}
scripts/clean-tsgo-backups.mjs
scripts/lib/public-config.ts         # then inline
patches/effect@4.0.0-beta.103.patch
patches/@effect__vitest@4.0.0-beta.103.patch
patches/@legendapp__list@3.3.5.patch
patches/@pierre%2Fdiffs@1.3.0-beta.10.patch
native/libghostty-vt/
```

Regenerate `pnpm-lock.yaml`. Do not copy it.

Proof after copy (no T3 server, no T3 home):

```bash
vp i
vp run --filter <nero-web> typecheck
vp run --filter <nero-web> test
vp run --filter <nero-web> build
# dist/index.html + hashed assets exist
# then: point Vite proxy at Nero harness and vp run --filter <nero-web> dev
```

Do not run repo-wide `vp check` / `vpr typecheck` on a half-shrunk tree that still lists missing `apps/*` members.

---

## Sources

- `/tmp/t3code-upstream/package.json`, `pnpm-workspace.yaml`, `t3.json`, `tsconfig.base.json`, `vite.config.ts`
- `/tmp/t3code-upstream/apps/web/{package.json,tsconfig.json,vite.config.ts,vercel.ts,index.html}`
- `/tmp/t3code-upstream/apps/web/scripts/{warm-dep-cache.ts,build-libghostty-wasm.sh}`
- `/tmp/t3code-upstream/packages/{client-runtime,contracts,shared}/package.json`
- `/tmp/t3code-upstream/packages/client-runtime/{tsconfig.json,vite.config.ts}`
- `/tmp/t3code-upstream/apps/server/{package.json,vite.config.ts,scripts/cli.ts}` (server→web edge only)
- `/tmp/t3code-upstream/scripts/{dev-runner.ts,apply-web-brand-assets.ts,clean-tsgo-backups.mjs,lib/public-config.ts,lib/brand-assets.ts}`
- `/tmp/t3code-upstream/docs/internals/{scripts.md,workspace-layout.md,ci.md}`
- `/tmp/t3code-upstream/.github/workflows/{ci.yml,web-preview.yml}`
- https://viteplus.dev/guide/ (Vite+ command surface, `vp` vs `vp run`, catalog alias rules)
