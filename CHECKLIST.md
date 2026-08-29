# Nero daemon remaining RPCs

Every `WsRpcGroup` method has a handler in this PR so a live `/ws` session does not die on an unknown tag. This list is leftover **IMPLEMENT** work versus methods that stay **DELETE** with the UI that called them.

## TODO (keep handler; flesh out later)

| Method                                                               | Notes                                                                                                                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `git.runStackedAction`                                               | Commit works. Push needs a remote. PR creation needs `gh`.                                                                                      |
| `git.resolvePullRequest`                                             | Typed `GitManagerError` until `gh` is on the image.                                                                                             |
| `git.preparePullRequestThread`                                       | Same.                                                                                                                                           |
| `pullRequests.*`                                                     | List returns empty; detail/mutations return `cli-missing`. Wire `gh` in a follow-up.                                                            |
| `sourceControl.lookupRepository` / `publishRepository`               | Typed errors; clone uses `git clone`.                                                                                                           |
| `review.getDiffPreview` / `review.getDiffFileContents`               | Working-tree `git diff` only.                                                                                                                   |
| `orchestration.getTurnDiff` / `getFullThreadDiff`                    | Shadow-git snapshots at turn start/end; range diffs include untracked files and survive restart.                                                |
| `orchestration.getWorkflowScript`                                    | `not-found` until workflow scripts exist.                                                                                                       |
| `thread.approval.respond` / `thread.user-input.respond`              | Approval waits in the GLM loop (`full-access` auto-runs). User-input respond is still a no-op.                                                  |
| `previewAutomation.*`                                                | Connected stub session. PR 7 fills KasmVNC / seat automation.                                                                                   |
| `subscribeDiscoveredLocalServers`                                    | Empty list; stream completes after one frame.                                                                                                   |
| `assets.createUrl` / `attachments.*`                                 | Local unsigned URLs; no blob HTTP store yet (id and URL now match).                                                                             |
| `server.upsertKeybinding` / `server.removeKeybinding`                | **IMPLEMENT**. Handlers succeed with the empty in-memory `keybindings` array; they do not persist.                                              |
| `subscribeVcsStatus`                                                 | **IMPLEMENT**. Initial snapshot plus 2s `localUpdated` poll; not a git-watcher hub.                                                             |
| `server.getTraceDiagnostics` and the rest of the diagnostics cluster | Typed empty snapshots.                                                                                                                          |
| `server.getUsageSummary`                                             | Empty buckets (`UsageProviderKind` is still T3 CLI-shaped).                                                                                     |
| `subscribeAuthAccess`                                                | WS snapshot is empty pairing/clients.                                                                                                           |
| Pairing HTTP (`/api/auth/pairing-token`, `/api/auth/pairing-links`)  | Implemented: mint/list after Bearer/`NERO_ACCESS_TOKEN`. `browser-session` and `/oauth/token` reject empty bodies. Revoke routes are still 404. |
| `thread.turn.start` assistant                                        | Pi harness streams GLM-5.3-Flash via OpenRouter (Baseten pin), with bash/file tools.                                                            |

## DELETE (UI deletion is PR 5)

These tags are in `WsRpcGroup` and have handlers that return a typed empty/error so the socket does not crash:

| Method                                                                                     | Why                                             |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `server.updateProvider`                                                                    | T3 CLI-update UI.                               |
| `server.updateServer` / `server.updateServerWithProgress`                                  | T3 self-update.                                 |
| `server.getSettings`                                                                       | No client caller; `getConfig` is the read path. |
| `server.reportHostPowerState` / `server.getBackgroundPolicy` / `subscribeBackgroundPolicy` | No web caller.                                  |
| `cloud.getRelayClientStatus` / `cloud.installRelayClient`                                  | T3 Connect.                                     |
| `provider.uploadFeedback`                                                                  | Codex feedback UI.                              |

Dead names **not** in `WsRpcGroup` (no handler, leftover from `WS_METHODS`): `projects.list`, `projects.add`, `projects.remove`.
