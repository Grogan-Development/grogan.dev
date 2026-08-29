---
name: loom
description: Loom — the git/repo server this workspace is a customer of. Clone repos, manage feature contracts, submit candidates, read CI evidence and the event log.
---

# Loom: the fast git + feature-contract server

Loom (loom.grogan.dev) is the source of truth for code, refs, features,
evidence, and events. Nero workspaces are **git customers** of Loom: plain
`git clone`/`push` works, and structured work goes through the `loom` CLI.

## Environment (already set in your shell)

- `LOOM_URL` — the server base URL.
- `LOOM_TOKEN` — a scoped bearer token (git/features/events perms). It is
  **not** the owner token: owner-only gates (feature approve/accept, deploys)
  belong to the human.

## Git

Clone with the project/repo path (encode `/` as `%2F` only in API paths —
for git, the normal URL form works):

```
git clone "$LOOM_URL/git/<project>/<repo>.git"
```

Push rules: only `refs/heads/workspaces/*` and `refs/heads/candidates/*`
accept direct pushes. Protected refs (like `refs/main`) move **only** through
the feature two-gate flow below — a direct push to a protected ref is
rejected by the pre-receive hook. Default branch is `main`.

## Feature contracts (instead of pull requests)

Work lands through two gates, so main only ever moves with evidence:

1. **Create** the contract: `loom feature create --file feature.toml`
   (or pipe JSON to stdin). It carries a title, scenarios, and a
   `target_ref` (usually `refs/main`).
2. The human **approves** it (owner gate): `loom feature approve <id>`.
3. Do the work: branch from the target as `candidates/<id>`, commit, and
   push — or land a native source commit.
4. **Submit** it: `loom candidate create --feature <id> --base <oid> --head <oid>`.
   Loom verifies, materializes, runs CI (reads `loom-ci.toml` in the tree),
   and caches results by source digest — identical trees never re-run CI.
5. The human **accepts** (owner gate): `loom feature accept <id>` — the
   protected ref advances atomically and mirrors outbound to git.

## Everyday commands

```
loom status                       # cwd, env, feature listing
loom repo list / repo show <name> # catalog of repositories
loom project list                 # projects (repos are project/repo)
loom feature list / show <id>     # feature contracts
loom evidence --feature <id>      # CI evidence attached to a feature
loom insights --feature <id>      # feature insights
loom events [--follow] [--since ID] [--feature ID]  # durable event log (SSE)
loom comment --feature <id> --body "..." --author agent:nero
loom review ...                   # review findings
loom backup <destination.tar>     # full backup tarball
```

Auth comes from the env; `loom login --url ... --token ...` can persist it to
`~/.config/loom/credentials` if you need to differ from the workspace token.

## Notes

- If `loom` is missing, say so instead of guessing: it ships in the image but
  the workspace may predate it.
- CI configuration lives in `loom-ci.toml` at the repo root; humans run the
  same non-deploy pipeline with `./scripts/ci.sh`.
- Feature IDs look like `f-...`; events carry `feature_id` for filtering.
