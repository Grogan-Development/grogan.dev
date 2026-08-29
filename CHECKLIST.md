# Nero daemon remaining RPCs

Every `WsRpcGroup` method has a handler in this PR so a live `/ws` session does not die on an unknown tag. This list is the leftover **IMPLEMENT** work versus methods that stay **DELETE** with the UI that called them.

## TODO (keep handler; flesh out later)

| Method                                                               | Notes                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `git.runStackedAction`                                               | Commit works. Push needs a remote. PR creation needs `gh` (later with PR workspace). |
| `git.resolvePullRequest`                                             | Typed `GitManagerError` until `gh` is on the image.                                  |
| `git.preparePullRequestThread`                                       | Same.                                                                                |
| `pullRequests.*`                                                     | List returns empty; detail/mutations return `cli-missing`. Wire `gh` in a follow-up. |
| `sourceControl.lookupRepository` / `publishRepository`               | Typed errors; clone uses `git clone`.                                                |
| `review.getDiffPreview` / `review.getDiffFileContents`               | Working-tree `git diff` only.                                                        |
| `orchestration.getTurnDiff` / `getFullThreadDiff`                    | Empty diff string; checkpoints land with the GLM loop (PR 8).                        |
| `orchestration.getWorkflowScript`                                    | `not-found` until workflow scripts exist.                                            |
| `previewAutomation.*`                                                | Connected stub session. PR 7 fills KasmVNC / seat automation.                        |
| `subscribeDiscoveredLocalServers`                                    | Empty list.                                                                          |
| `assets.createUrl` / `attachments.*`                                 | Local unsigned URLs; no blob store yet.                                              |
| `server.getTraceDiagnostics` and the rest of the diagnostics cluster | Typed empty snapshots.                                                               |
| `server.getUsageSummary`                                             | Empty buckets (`UsageProviderKind` is still T3 CLI-shaped).                          |
| `subscribeAuthAccess` + pairing HTTP                                 | Ticket + bearer + `NERO_DEV_BYPASS` work. Pairing directory is empty.                |
| `thread.turn.start` assistant                                        | Stub reply. PR 8 streams GLM via OpenRouter.                                         |

## DELETE (handler present so the socket does not crash; UI deletion is PR 5)

| Method                                                                                     | Why                                             |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `server.updateProvider`                                                                    | T3 CLI-update UI.                               |
| `server.updateServer` / `server.updateServerWithProgress`                                  | T3 self-update.                                 |
| `server.getSettings`                                                                       | No client caller; `getConfig` is the read path. |
| `server.reportHostPowerState` / `server.getBackgroundPolicy` / `subscribeBackgroundPolicy` | No web caller.                                  |
| `cloud.getRelayClientStatus` / `cloud.installRelayClient`                                  | T3 Connect.                                     |
| `provider.uploadFeedback`                                                                  | Codex feedback UI.                              |
| `projects.list` / `projects.add` / `projects.remove`                                       | Dead names, not in `WsRpcGroup`.                |
