import * as Path from "node:path";
import * as Process from "node:process";

import {
  type DiscoveredLocalServerList,
  ExternalLauncherUnsupportedEditorError,
  OrchestrationDispatchCommandError,
  OrchestrationGetSnapshotError,
  OrchestrationGetWorkflowScriptError,
  ProjectId,
  ProviderDriverKind,
  PullRequestUnavailableError,
  RelayClientInstallFailedError,
  ServerProviderUpdateError,
  ServerSelfUpdateError,
  type TerminalEvent,
  type PreviewEvent,
  WsRpcGroup,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import type { Daemon } from "./daemon.ts";
import * as Empty from "./empty.ts";
import { liveQueue, trySync } from "./effect-util.ts";
import {
  browseFilesystem,
  listProjectEntries,
  readProjectFile,
  searchProjectContents,
  searchProjectEntries,
  writeProjectFile,
} from "./files.ts";
import {
  cloneRepository,
  discoverSourceControl,
  lookupRepository,
  preparePullRequestThread,
  publishRepository,
  resolvePullRequest,
  reviewDiffFileContents,
  reviewDiffPreview,
  stackedActionEvents,
  vcsCreateRef,
  vcsCreateWorktree,
  vcsInit,
  vcsListRefs,
  vcsPull,
  vcsRefreshStatus,
  vcsRemoveWorktree,
  vcsStatus,
  vcsSwitchRef,
} from "./git.ts";
import { laterMs, nextToken, nowIso } from "./runtime.ts";

const prUnavailable = () =>
  new PullRequestUnavailableError({
    reason: "cli-missing",
    provider: "github",
  });

export const makeRpcLayer = (daemon: Daemon) =>
  WsRpcGroup.toLayer({
    "server.probe": () => Effect.succeed({}),
    "server.getConfig": () => Effect.succeed(daemon.serverConfig()),
    "server.refreshProviders": () => Effect.succeed({ providers: daemon.serverConfig().providers }),
    "server.updateProvider": () =>
      Effect.fail(
        new ServerProviderUpdateError({
          provider: ProviderDriverKind.make("nero"),
          reason: "Nero does not update CLI provider binaries.",
        }),
      ),
    "server.updateServer": () =>
      Effect.fail(new ServerSelfUpdateError({ reason: "Nero does not self-update." })),
    "server.updateServerWithProgress": () =>
      Stream.fail(new ServerSelfUpdateError({ reason: "Nero does not self-update." })),
    "server.upsertKeybinding": () =>
      Effect.succeed({ keybindings: daemon.serverConfig().keybindings, issues: [] }),
    "server.removeKeybinding": () =>
      Effect.succeed({ keybindings: daemon.serverConfig().keybindings, issues: [] }),
    "server.getSettings": () => Effect.succeed(daemon.serverConfig().settings),
    "server.updateSettings": (input) => Effect.succeed(daemon.updateSettings(input.patch)),
    "server.discoverSourceControl": () => Effect.succeed(discoverSourceControl()),
    "server.getTraceDiagnostics": () =>
      Effect.succeed(
        Empty.traceDiagnostics(Path.join(daemon.options.dataDir, "logs", "traces.jsonl")),
      ),
    "server.getProcessDiagnostics": () => Effect.succeed(Empty.processDiagnostics(daemon.pid())),
    "server.getProcessResourceHistory": (input) =>
      Effect.succeed(Empty.processResourceHistory(input.windowMs, input.bucketMs)),
    "server.getResourceTelemetryHistory": (input) =>
      Effect.succeed(Empty.resourceTelemetryHistory(input.windowMs, input.bucketMs)),
    "server.retryResourceTelemetry": () =>
      Effect.succeed({ accepted: true, snapshot: Empty.resourceTelemetry() }),
    "server.getUsageSummary": (input) =>
      Effect.succeed(
        Empty.usageSummary({
          sinceDay: input.sinceDay,
          untilDay: input.untilDay,
          timeZone: input.timeZone,
        }),
      ),
    "server.signalProcess": (input) =>
      Effect.succeed({
        pid: input.pid,
        signal: input.signal,
        signaled: false,
        message: Option.some("Process signalling is disabled in Nero v1."),
      }),
    "server.reportClientActivity": () => Effect.void,
    "server.reportHostPowerState": () => Effect.void,
    "server.getBackgroundPolicy": () => Effect.succeed(Empty.backgroundPolicy()),
    "cloud.getRelayClientStatus": () =>
      Effect.succeed({
        status: "unsupported" as const,
        platform: Process.platform,
        arch: Process.arch,
        version: "0.0.0",
      }),
    "cloud.installRelayClient": () =>
      Stream.fail(
        new RelayClientInstallFailedError({
          reason: "unsupported_platform",
          message: "T3 Connect relay is not part of Nero.",
        }),
      ),
    "pullRequests.list": () =>
      Effect.succeed({
        viewers: {},
        providers: [],
        entries: [],
        errors: [],
        truncated: false,
        nextCursors: {},
      }),
    "pullRequests.listStats": () => Effect.succeed({ stats: [] }),
    "pullRequests.detail": () => Effect.fail(prUnavailable()),
    "pullRequests.activity": () => Effect.fail(prUnavailable()),
    "pullRequests.threadComments": () => Effect.succeed({ comments: [], nextCursor: null }),
    "pullRequests.diffFileContents": () => Effect.succeed({ oldContents: "", newContents: "" }),
    "pullRequests.runAction": () => Effect.fail(prUnavailable()),
    "pullRequests.update": () => Effect.fail(prUnavailable()),
    "pullRequests.comment": () => Effect.fail(prUnavailable()),
    "pullRequests.updateComment": () => Effect.fail(prUnavailable()),
    "pullRequests.submitReview": () => Effect.fail(prUnavailable()),
    "pullRequests.replyToThread": () => Effect.fail(prUnavailable()),
    "pullRequests.setThreadResolution": () => Effect.fail(prUnavailable()),
    "pullRequests.setReaction": () => Effect.fail(prUnavailable()),
    "pullRequests.invalidate": () => Effect.void,
    "pullRequests.reviewerCandidates": () => Effect.succeed({ candidates: [], truncated: false }),
    "pullRequests.requestReviewers": () => Effect.fail(prUnavailable()),
    "sourceControl.lookupRepository": (input) => trySync(() => lookupRepository(input)),
    "sourceControl.cloneRepository": (input) => trySync(() => cloneRepository(input)),
    "sourceControl.publishRepository": (input) => trySync(() => publishRepository(input)),
    "projects.listEntries": (input) => trySync(() => listProjectEntries(input)),
    "projects.readFile": (input) => trySync(() => readProjectFile(input)),
    "projects.searchContents": (input) => trySync(() => searchProjectContents(input)),
    "projects.searchEntries": (input) => trySync(() => searchProjectEntries(input)),
    "projects.writeFile": (input) => trySync(() => writeProjectFile(input)),
    "shell.openInEditor": (input) =>
      Effect.fail(new ExternalLauncherUnsupportedEditorError({ editor: input.editor })),
    "filesystem.browse": (input) =>
      trySync(() => browseFilesystem(input, daemon.options.workspaceRoot)),
    "assets.createUrl": (input) => {
      const expiresAt = DateTime.toEpochMillis(laterMs(10 * 60_000));
      if (input.resource._tag === "workspace-file") {
        return Effect.succeed({
          relativeUrl: `/api/assets/workspace?threadId=${encodeURIComponent(input.resource.threadId)}&path=${encodeURIComponent(input.resource.path)}`,
          expiresAt,
          sourcePath: input.resource.path,
        });
      }
      if (input.resource._tag === "attachment") {
        return Effect.succeed({
          relativeUrl: `/api/attachments/${encodeURIComponent(input.resource.attachmentId)}`,
          expiresAt,
        });
      }
      return Effect.succeed({
        relativeUrl: `/api/assets/favicon?cwd=${encodeURIComponent(input.resource.cwd)}`,
        expiresAt,
      });
    },
    "attachments.createUploadUrl": (input) =>
      Effect.succeed({
        attachmentId: nextToken("att").replaceAll("_", ""),
        relativeUrl: `/api/attachments/${nextToken("up").replaceAll("_", "")}`,
        expiresAt: DateTime.toEpochMillis(laterMs(10 * 60_000)),
      }),
    "attachments.delete": () => Effect.void,
    "provider.uploadFeedback": () => Effect.succeed({ feedbackId: "noop" }),
    subscribeVcsStatus: (input) => {
      const snapshot = vcsStatus(input);
      return Stream.succeed({
        _tag: "snapshot" as const,
        local: snapshot,
        remote: {
          hasUpstream: snapshot.hasUpstream,
          aheadCount: snapshot.aheadCount,
          behindCount: snapshot.behindCount,
          pr: snapshot.pr,
        },
      });
    },
    "vcs.pull": (input) => trySync(() => vcsPull(input)),
    "vcs.refreshStatus": (input) => trySync(() => vcsRefreshStatus(input)),
    "git.runStackedAction": (input) => Stream.fromIterable(stackedActionEvents(input)),
    "git.resolvePullRequest": (input) => trySync(() => resolvePullRequest(input)),
    "git.preparePullRequestThread": (input) => trySync(() => preparePullRequestThread(input)),
    "vcs.listRefs": (input) => trySync(() => vcsListRefs(input)),
    "vcs.createWorktree": (input) => trySync(() => vcsCreateWorktree(input)),
    "vcs.removeWorktree": (input) =>
      trySync(() => {
        vcsRemoveWorktree(input);
      }),
    "vcs.createRef": (input) => trySync(() => vcsCreateRef(input)),
    "vcs.switchRef": (input) => trySync(() => vcsSwitchRef(input)),
    "vcs.init": (input) =>
      trySync(() => {
        vcsInit(input);
      }),
    "review.getDiffPreview": (input) => trySync(() => reviewDiffPreview(input)),
    "review.getDiffFileContents": (input) => trySync(() => reviewDiffFileContents(input)),
    "terminal.open": (input) => trySync(() => daemon.terminals.open(input)),
    "terminal.attach": (input) =>
      Effect.gen(function* () {
        const snapshot = daemon.terminals.attach(input);
        const session = daemon.terminals.get(input.threadId, input.terminalId);
        const queue = yield* liveQueue([{ type: "snapshot" as const, snapshot }], (listener) => {
          if (session === undefined) return () => undefined;
          const wrapped = (event: { type: string }) => {
            if (event.type === "started") return;
            listener(event as never);
          };
          session.listeners.add(wrapped as never);
          return () => {
            session.listeners.delete(wrapped as never);
          };
        });
        return queue;
      }),
    "terminal.write": (input) =>
      trySync(() => {
        daemon.terminals.write(input.threadId, input.terminalId, input.data);
      }),
    "terminal.resize": (input) =>
      trySync(() => {
        daemon.terminals.resize(input.threadId, input.terminalId, input.cols, input.rows);
      }),
    "terminal.clear": (input) =>
      trySync(() => {
        daemon.terminals.clear(input.threadId, input.terminalId);
      }),
    "terminal.restart": (input) => trySync(() => daemon.terminals.restart(input)),
    "terminal.close": (input) =>
      trySync(() => {
        daemon.terminals.close(input.threadId, input.terminalId, input.deleteHistory);
      }),
    subscribeTerminalEvents: () =>
      liveQueue<TerminalEvent>([], (listener) => {
        const wrapped = (
          event: Parameters<
            typeof daemon.terminals.globalListeners extends Set<infer L> ? L : never
          >[0],
        ) => {
          listener(event as never);
        };
        daemon.terminals.globalListeners.add(wrapped as never);
        return () => {
          daemon.terminals.globalListeners.delete(wrapped as never);
        };
      }),
    subscribeTerminalMetadata: () =>
      liveQueue(
        [{ type: "snapshot" as const, terminals: [...daemon.terminals.list()] }],
        (listener) => {
          const wrapped = (event: unknown) => {
            listener(event as never);
          };
          daemon.terminals.metadataListeners.add(wrapped as never);
          return () => {
            daemon.terminals.metadataListeners.delete(wrapped as never);
          };
        },
      ),
    "preview.open": (input) => Effect.succeed(daemon.previewOpen(input)),
    "preview.navigate": (input) => Effect.succeed(daemon.previewNavigate(input)),
    "preview.resize": (input) => Effect.succeed(daemon.previewResize(input)),
    "preview.refresh": () => Effect.void,
    "preview.close": (input) =>
      Effect.sync(() => {
        daemon.previewClose(input.threadId, input.tabId);
      }),
    "preview.list": (input) => Effect.succeed(daemon.previewList(input.threadId)),
    "preview.reportStatus": () => Effect.void,
    "previewAutomation.connect": () =>
      liveQueue(
        [
          {
            type: "connected" as const,
            connectionId: nextToken("pauto").slice(0, 64),
          },
        ],
        () => () => undefined,
      ),
    "previewAutomation.respond": () => Effect.void,
    "previewAutomation.focusHost": () => Effect.void,
    subscribePreviewEvents: () =>
      liveQueue<PreviewEvent>([], (listener) => daemon.previewHub.subscribe(listener)),
    subscribeDiscoveredLocalServers: () => {
      const list: DiscoveredLocalServerList = {
        servers: [],
        scannedAt: nowIso(),
      };
      return Stream.succeed(list);
    },
    subscribeServerConfig: () =>
      liveQueue(
        [{ version: 1 as const, type: "snapshot" as const, config: daemon.serverConfig() }],
        (listener) => daemon.configHub.subscribe(listener as never),
      ),
    subscribeServerLifecycle: () => {
      const environment = daemon.environment();
      const welcome: import("@t3tools/contracts").ServerLifecycleStreamEvent = {
        version: 1,
        sequence: 0,
        type: "welcome",
        payload: {
          environment,
          cwd: daemon.options.workspaceRoot,
          projectName: "Workspace",
          bootstrapProjectId: ProjectId.make("workspace"),
        },
      };
      const ready: import("@t3tools/contracts").ServerLifecycleStreamEvent = {
        version: 1,
        sequence: 1,
        type: "ready",
        payload: {
          at: nowIso(),
          environment,
        },
      };
      return liveQueue([welcome, ready], (listener) => daemon.lifecycleHub.subscribe(listener));
    },
    subscribeAuthAccess: () =>
      liveQueue(
        [
          {
            version: 1 as const,
            revision: 1,
            type: "snapshot" as const,
            payload: { pairingLinks: [], clientSessions: [] },
          },
        ],
        (listener) => daemon.authHub.subscribe(listener as never),
      ),
    subscribeBackgroundPolicy: () => Stream.succeed(Empty.backgroundPolicy()),
    subscribeResourceTelemetry: () => Stream.succeed(Empty.resourceTelemetry()),
    "orchestration.dispatchCommand": (command) =>
      trySync(() => daemon.dispatch(command)).pipe(
        Effect.mapError((error) => {
          if (error instanceof OrchestrationDispatchCommandError) return error;
          return new OrchestrationDispatchCommandError({
            message: error instanceof Error ? error.message : "Dispatch failed.",
            cause: error,
          });
        }),
      ),
    "orchestration.getWorkflowScript": (input) =>
      Effect.fail(
        new OrchestrationGetWorkflowScriptError({
          reason: "not-found",
          scriptPath: input.scriptPath,
        }),
      ),
    "orchestration.getTurnDiff": (input) =>
      Effect.succeed({
        fromTurnCount: input.fromTurnCount,
        toTurnCount: input.toTurnCount,
        threadId: input.threadId,
        diff: "",
      }),
    "orchestration.getFullThreadDiff": (input) =>
      Effect.succeed({
        fromTurnCount: 0,
        toTurnCount: input.toTurnCount,
        threadId: input.threadId,
        diff: "",
      }),
    "orchestration.searchThreads": (input) =>
      Effect.succeed(daemon.searchThreads(input.query, input.limit)),
    "orchestration.getArchivedShellSnapshot": () => Effect.succeed(daemon.shellSnapshot(true)),
    "orchestration.subscribeShell": (input) =>
      liveQueue(
        daemon.subscribeShellItems(input.afterSequence, input.requestCompletionMarker),
        (listener) => daemon.shellHub.subscribe(listener as never),
      ),
    "orchestration.subscribeThread": (input) => {
      const items = daemon.subscribeThreadItems(
        input.threadId,
        input.afterSequence,
        input.requestCompletionMarker,
      );
      if (items === undefined) {
        return Effect.fail(new OrchestrationGetSnapshotError({ message: "Thread not found." }));
      }
      return liveQueue(items, (listener) =>
        daemon.threadHub(input.threadId).subscribe(listener as never),
      );
    },
  });
