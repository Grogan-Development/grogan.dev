import * as Fs from "node:fs";
import * as Path from "node:path";
import * as Process from "node:process";

import {
  AuthAdministrativeScopes,
  type AuthAccessStreamEvent,
  type AuthPairingCredentialResult,
  type AuthPairingLink,
  type AuthSessionState,
  type AuthWebSocketTicketResult,
  type ChatAttachment,
  type ClientOrchestrationCommand,
  DEFAULT_SERVER_SETTINGS,
  ServerSettings,
  type DispatchResult,
  type ExecutionEnvironmentDescriptor,
  type OrchestrationEvent,
  type OrchestrationProject,
  type OrchestrationProjectShell,
  type OrchestrationSearchThreadsResult,
  type OrchestrationShellSnapshot,
  type OrchestrationShellStreamItem,
  type OrchestrationThread,
  type OrchestrationThreadDetailSnapshot,
  type OrchestrationThreadShell,
  type OrchestrationThreadStreamItem,
  type PreviewEvent,
  type PreviewSessionSnapshot,
  type PreviewListResult,
  type PreviewOpenInput,
  type PreviewNavigateInput,
  type PreviewReportStatusInput,
  type PreviewResizeInput,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerConfig,
  type ServerConfigStreamEvent,
  type ServerLifecycleStreamEvent,
  type ServerSettingsPatch,
  ThreadId,
  EventId,
  MessageId,
  TurnId,
  CommandId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import type { DaemonOptions } from "./runtime.ts";
import {
  DAEMON_VERSION,
  NERO_DRIVER,
  NERO_INSTANCE_ID,
  NERO_MODEL,
  SESSION_COOKIE,
  ensureDir,
  laterMs,
  nextToken,
  nowIso,
  nowUtc,
  platformArch,
  platformOs,
  readJson,
  writeJsonAtomic,
} from "./runtime.ts";
import { HumanDrivingLock } from "./seat-lock.ts";
import { TerminalHub } from "./terminal.ts";

/** Collaborative preview tab that is the agent seat (KasmVNC), not a URL browser. */
export const SEAT_PREVIEW_TAB_ID = "seat";
export const SEAT_VNC_URL = "/vnc/";
export const SEAT_VNC_TITLE = "Agent seat";

export class Hub<T> {
  readonly listeners = new Set<(item: T) => void>();

  emit(item: T): void {
    for (const listener of this.listeners) listener(item);
  }

  subscribe(listener: (item: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

type Ticket = {
  readonly ticket: string;
  readonly expiresAtMs: number;
  readonly sessionId: string;
};

type Session = {
  readonly sessionId: string;
  readonly token: string;
  readonly expiresAtMs: number;
};

type PairingRecord = {
  readonly id: string;
  readonly credential: string;
  readonly label: string | undefined;
  readonly createdAt: DateTime.Utc;
  readonly expiresAt: DateTime.Utc;
};

type PreviewSession = PreviewSessionSnapshot;

type Persisted = {
  readonly version: 1;
  readonly sequence: number;
  readonly projects: ReadonlyArray<OrchestrationProject>;
  readonly threads: ReadonlyArray<OrchestrationThread>;
  readonly settings: typeof ServerSettings.Type;
};

const DEFAULT_PROJECT_ID = ProjectId.make("workspace");

const neroModel = {
  instanceId: ProviderInstanceId.make(NERO_INSTANCE_ID),
  model: NERO_MODEL,
};

const decodeSettings = (value: unknown): ServerSettings =>
  patchedSettings(Schema.decodeUnknownSync(ServerSettings)(value ?? {}));

const patchedSettings = (base: typeof ServerSettings.Type): typeof ServerSettings.Type => ({
  ...base,
  textGenerationModelSelection: neroModel,
  providerInstances: {
    ...base.providerInstances,
    [ProviderInstanceId.make(NERO_INSTANCE_ID)]: {
      driver: ProviderDriverKind.make(NERO_DRIVER),
      displayName: "Nero",
      enabled: true,
      config: {},
    },
  },
});

const attachmentFromUnknown = (raw: unknown): ChatAttachment | undefined => {
  if (raw === null || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const type = value.type;
  const name = typeof value.name === "string" ? value.name : "attachment";
  const mimeType = typeof value.mimeType === "string" ? value.mimeType : "application/octet-stream";
  const sizeBytes = typeof value.sizeBytes === "number" ? value.sizeBytes : 1;
  const id = typeof value.id === "string" ? value.id : nextToken("att").replaceAll(".", "");
  if (type === "image") {
    return { type: "image", id, name, mimeType, sizeBytes };
  }
  if (type === "file") {
    return { type: "file", id, name, mimeType, sizeBytes };
  }
  return undefined;
};

export class Daemon {
  readonly options: DaemonOptions;
  readonly terminals = new TerminalHub();
  readonly shellHub = new Hub<OrchestrationShellStreamItem>();
  readonly threadHubs = new Map<string, Hub<OrchestrationThreadStreamItem>>();
  readonly configHub = new Hub<ServerConfigStreamEvent>();
  readonly lifecycleHub = new Hub<ServerLifecycleStreamEvent>();
  readonly previewHub = new Hub<PreviewEvent>();
  readonly authHub = new Hub<AuthAccessStreamEvent>();
  readonly vcsListeners = new Set<(cwd: string) => void>();

  private sequence = 0;
  private projects = new Map<string, OrchestrationProject>();
  private threads = new Map<string, OrchestrationThread>();
  private settings: typeof ServerSettings.Type;
  private readonly tickets = new Map<string, Ticket>();
  private readonly sessions = new Map<string, Session>();
  private readonly pairing = new Map<string, PairingRecord>();
  private readonly previews = new Map<string, PreviewSession>();
  private previewRevision = 0;
  readonly serverEpoch = nextToken("epoch");
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  readonly humanDriving: HumanDrivingLock;

  constructor(options: DaemonOptions) {
    this.options = options;
    this.humanDriving = new HumanDrivingLock(options.seatLockPath, options.seatHoldBin);
    this.settings = patchedSettings(DEFAULT_SERVER_SETTINGS);
    ensureDir(options.dataDir);
    ensureDir(Path.join(options.dataDir, "logs"));
    ensureDir(Path.join(options.dataDir, "attachments"));
    this.restore();
    if (this.projects.size === 0) {
      this.seedWorkspace();
    }
  }

  private persistPath(): string {
    return Path.join(this.options.dataDir, "orchestration.json");
  }

  private restore(): void {
    const raw = readJson(this.persistPath());
    if (raw === undefined || raw === null || typeof raw !== "object") return;
    const state = raw as Persisted;
    if (state.version !== 1) return;
    this.sequence = state.sequence;
    this.settings = decodeSettings(state.settings);
    for (const project of state.projects) this.projects.set(project.id, project);
    for (const thread of state.threads) this.threads.set(thread.id, thread);
  }

  private schedulePersist(): void {
    if (this.persistTimer !== undefined) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined;
      this.persistNow();
    }, 50);
  }

  persistNow(): void {
    const payload: Persisted = {
      version: 1,
      sequence: this.sequence,
      projects: [...this.projects.values()],
      threads: [...this.threads.values()],
      settings: this.settings,
    };
    writeJsonAtomic(this.persistPath(), payload);
  }

  private seedWorkspace(): void {
    const at = nowIso();
    const project: OrchestrationProject = {
      id: DEFAULT_PROJECT_ID,
      title: "Workspace",
      workspaceRoot: this.options.workspaceRoot,
      defaultModelSelection: neroModel,
      defaultThreadEnvMode: "local",
      scripts: [],
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    };
    this.projects.set(project.id, project);
    this.schedulePersist();
  }

  environment(): ExecutionEnvironmentDescriptor {
    return {
      environmentId: this.options.environmentId,
      label: this.options.label,
      platform: { os: platformOs(), arch: platformArch() },
      serverVersion: DAEMON_VERSION,
      capabilities: {
        repositoryIdentity: true,
        connectionProbe: true,
        attachmentUploads: true,
        fileAttachments: { maxUploadBytes: 50 * 1024 * 1024 },
        pullRequests: true,
        threadSettlement: true,
        threadSnooze: true,
        threadPinning: true,
        threadPinReorder: true,
        threadTitleRegeneration: true,
        threadPullRequestLinking: true,
      },
    };
  }

  authDescriptor() {
    return {
      policy: this.options.devBypass ? ("unsafe-no-auth" as const) : ("remote-reachable" as const),
      bootstrapMethods: ["one-time-token" as const],
      sessionMethods: ["browser-session-cookie" as const, "bearer-access-token" as const],
      sessionCookieName: SESSION_COOKIE,
    };
  }

  serverConfig(): ServerConfig {
    return {
      environment: this.environment(),
      auth: this.authDescriptor(),
      cwd: this.options.workspaceRoot,
      keybindingsConfigPath: Path.join(this.options.dataDir, "keybindings.json"),
      keybindings: [],
      issues: [],
      providers: [
        {
          instanceId: ProviderInstanceId.make(NERO_INSTANCE_ID),
          driver: ProviderDriverKind.make(NERO_DRIVER),
          displayName: "Nero",
          enabled: true,
          installed: true,
          version: DAEMON_VERSION,
          status: "ready",
          auth: { status: "authenticated", type: "api-key", label: "Nero" },
          checkedAt: nowIso(),
          availability: "available",
          models: [
            {
              slug: NERO_MODEL,
              name: "GLM-5.3 Flash",
              isCustom: false,
              isDefault: true,
              capabilities: null,
            },
          ],
          slashCommands: [],
          skills: [],
        },
      ],
      availableEditors: [],
      observability: {
        logsDirectoryPath: Path.join(this.options.dataDir, "logs"),
        localTracingEnabled: false,
        otlpTracesEnabled: false,
        otlpMetricsEnabled: false,
      },
      settings: this.settings,
      shellResumeCompletionMarker: true,
      threadResumeCompletionMarker: true,
      threadSnapshotPagination: true,
    };
  }

  updateSettings(patch: ServerSettingsPatch): typeof ServerSettings.Type {
    this.settings = patchedSettings({
      ...this.settings,
      ...patch,
      providers: this.settings.providers,
      providerInstances: patch.providerInstances ?? this.settings.providerInstances,
    } as typeof ServerSettings.Type);
    this.schedulePersist();
    this.configHub.emit({
      version: 1,
      type: "settingsUpdated",
      payload: { settings: this.settings },
    });
    return this.settings;
  }

  sessionState(authenticated: boolean): AuthSessionState {
    return authenticated
      ? {
          authenticated: true,
          auth: this.authDescriptor(),
          scopes: [...AuthAdministrativeScopes],
          sessionMethod: "bearer-access-token",
          expiresAt: laterMs(24 * 60 * 60 * 1000),
        }
      : { authenticated: false, auth: this.authDescriptor() };
  }

  authorizeHttp(
    headers: Record<string, string | undefined>,
    cookies: Record<string, string | undefined>,
  ): boolean {
    if (this.options.devBypass) return true;
    const authorization = headers.authorization ?? headers.Authorization;
    if (authorization?.toLowerCase().startsWith("bearer ")) {
      const token = authorization.slice(7).trim();
      if (this.options.accessToken !== undefined && token === this.options.accessToken) return true;
      for (const session of this.sessions.values()) {
        if (session.token === token && session.expiresAtMs > DateTime.toEpochMillis(nowUtc()))
          return true;
      }
    }
    const cookie = cookies[SESSION_COOKIE];
    if (cookie !== undefined) {
      const session = this.sessions.get(cookie);
      if (session !== undefined && session.expiresAtMs > DateTime.toEpochMillis(nowUtc()))
        return true;
    }
    return false;
  }

  authorizeWebsocket(
    url: string,
    headers: Record<string, string | undefined>,
    cookies: Record<string, string | undefined>,
  ): boolean {
    if (this.options.devBypass) return true;
    try {
      const parsed = new URL(url, "http://nero.local");
      const ticket = parsed.searchParams.get("wsTicket");
      if (ticket !== null) {
        const record = this.tickets.get(ticket);
        if (record !== undefined && record.expiresAtMs > DateTime.toEpochMillis(nowUtc())) {
          this.tickets.delete(ticket);
          return true;
        }
        return false;
      }
    } catch {
      return false;
    }
    return this.authorizeHttp(headers, cookies);
  }

  issueTicket(): AuthWebSocketTicketResult {
    const ticket = nextToken("tkt");
    const expiresAt = laterMs(60_000);
    this.tickets.set(ticket, {
      ticket,
      expiresAtMs: DateTime.toEpochMillis(expiresAt),
      sessionId: "local",
    });
    return { ticket, expiresAt };
  }

  issueSession(): { token: string; expiresAt: DateTime.Utc } {
    const token = nextToken("sess");
    const expiresAt = laterMs(24 * 60 * 60 * 1000);
    this.sessions.set(token, {
      sessionId: token,
      token,
      expiresAtMs: DateTime.toEpochMillis(expiresAt),
    });
    return { token, expiresAt };
  }

  acceptPairingCredential(credential: string): boolean {
    if (credential.length === 0) return false;
    if (this.options.accessToken !== undefined && credential === this.options.accessToken) {
      return true;
    }
    const now = DateTime.toEpochMillis(nowUtc());
    for (const record of this.pairing.values()) {
      if (record.credential === credential && DateTime.toEpochMillis(record.expiresAt) > now) {
        return true;
      }
    }
    return false;
  }

  issuePairing(label: string | undefined): AuthPairingCredentialResult {
    const id = nextToken("pair");
    const credential = nextToken("cred");
    const createdAt = nowUtc();
    const expiresAt = laterMs(24 * 60 * 60 * 1000);
    this.pairing.set(id, { id, credential, label, createdAt, expiresAt });
    return label === undefined
      ? { id, credential, expiresAt }
      : { id, credential, label, expiresAt };
  }

  pairingLinks(): AuthPairingLink[] {
    const now = DateTime.toEpochMillis(nowUtc());
    const links: AuthPairingLink[] = [];
    for (const record of this.pairing.values()) {
      if (DateTime.toEpochMillis(record.expiresAt) <= now) continue;
      links.push({
        id: record.id,
        credential: record.credential,
        scopes: [...AuthAdministrativeScopes],
        subject: "nero",
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        ...(record.label === undefined ? {} : { label: record.label }),
      });
    }
    return links;
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  threadHub(threadId: string): Hub<OrchestrationThreadStreamItem> {
    const existing = this.threadHubs.get(threadId);
    if (existing !== undefined) return existing;
    const hub = new Hub<OrchestrationThreadStreamItem>();
    this.threadHubs.set(threadId, hub);
    return hub;
  }

  private emitThreadEvent(thread: OrchestrationThread, event: OrchestrationEvent): void {
    this.threadHub(thread.id).emit({ kind: "event", event });
    this.shellHub.emit({
      kind: "thread-upserted",
      sequence: event.sequence,
      thread: this.toThreadShell(thread),
    });
  }

  private emitProject(project: OrchestrationProject, sequence: number): void {
    this.shellHub.emit({
      kind: "project-upserted",
      sequence,
      project: this.toProjectShell(project),
    });
  }

  toProjectShell(project: OrchestrationProject): OrchestrationProjectShell {
    return {
      id: project.id,
      title: project.title,
      workspaceRoot: project.workspaceRoot,
      defaultModelSelection: project.defaultModelSelection,
      defaultThreadEnvMode: project.defaultThreadEnvMode,
      faviconPath: project.faviconPath,
      scripts: project.scripts,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  toThreadShell(thread: OrchestrationThread): OrchestrationThreadShell {
    const latestUser = [...thread.messages].reverse().find((message) => message.role === "user");
    return {
      id: thread.id,
      projectId: thread.projectId,
      title: thread.title,
      modelSelection: thread.modelSelection,
      runtimeMode: thread.runtimeMode,
      interactionMode: thread.interactionMode,
      branch: thread.branch,
      worktreePath: thread.worktreePath,
      linkedPullRequest: thread.linkedPullRequest,
      latestTurn: thread.latestTurn,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      archivedAt: thread.archivedAt,
      settledOverride: thread.settledOverride,
      settledAt: thread.settledAt,
      unsettledAt: thread.unsettledAt,
      snoozedUntil: thread.snoozedUntil,
      snoozedAt: thread.snoozedAt,
      pinnedAt: thread.pinnedAt,
      pinOrderKey: thread.pinOrderKey,
      titleRegeneration: thread.titleRegeneration,
      session: thread.session,
      latestUserMessageAt: latestUser?.createdAt ?? null,
      hasPendingApprovals: false,
      hasPendingUserInput: false,
      hasActionableProposedPlan: thread.proposedPlans.some((plan) => plan.implementedAt === null),
    };
  }

  shellSnapshot(includeArchived: boolean): OrchestrationShellSnapshot {
    const projects = [...this.projects.values()]
      .filter((project) => project.deletedAt === null)
      .map((project) => this.toProjectShell(project));
    const threads = [...this.threads.values()]
      .filter((thread) => thread.deletedAt === null)
      .filter((thread) =>
        includeArchived ? thread.archivedAt !== null : thread.archivedAt === null,
      )
      .map((thread) => this.toThreadShell(thread));
    return {
      snapshotSequence: this.sequence,
      projects,
      threads,
      updatedAt: nowIso(),
    };
  }

  threadSnapshot(threadId: string): OrchestrationThreadDetailSnapshot | undefined {
    const thread = this.threads.get(threadId);
    if (thread === undefined || thread.deletedAt !== null) return undefined;
    return { snapshotSequence: this.sequence, thread };
  }

  readModel() {
    return {
      snapshotSequence: this.sequence,
      projects: [...this.projects.values()].filter((project) => project.deletedAt === null),
      threads: [...this.threads.values()].filter((thread) => thread.deletedAt === null),
      updatedAt: nowIso(),
    };
  }

  subscribeShellItems(
    afterSequence: number | undefined,
    requestCompletionMarker: boolean | undefined,
  ): OrchestrationShellStreamItem[] {
    const items: OrchestrationShellStreamItem[] = [
      { kind: "snapshot", snapshot: this.shellSnapshot(false) },
    ];
    if (requestCompletionMarker === true) items.push({ kind: "synchronized" });
    void afterSequence;
    return items;
  }

  subscribeThreadItems(
    threadId: string,
    afterSequence: number | undefined,
    requestCompletionMarker: boolean | undefined,
  ): OrchestrationThreadStreamItem[] | undefined {
    const snapshot = this.threadSnapshot(threadId);
    if (snapshot === undefined) return undefined;
    const items: OrchestrationThreadStreamItem[] = [{ kind: "snapshot", snapshot }];
    if (requestCompletionMarker === true) items.push({ kind: "synchronized" });
    void afterSequence;
    return items;
  }

  private eventBase(
    commandId: string | null,
    aggregateKind: "project" | "thread",
    aggregateId: ProjectId | ThreadId,
  ) {
    return {
      sequence: this.nextSequence(),
      eventId: EventId.make(nextToken("evt")),
      aggregateKind,
      aggregateId,
      occurredAt: nowIso(),
      commandId: commandId === null ? null : CommandId.make(commandId),
      causationEventId: null,
      correlationId: commandId === null ? null : CommandId.make(commandId),
      metadata: {},
    };
  }

  dispatch(command: ClientOrchestrationCommand): DispatchResult {
    switch (command.type) {
      case "project.create": {
        const at = command.createdAt;
        const project: OrchestrationProject = {
          id: command.projectId,
          title: command.title,
          workspaceRoot: command.workspaceRoot,
          defaultModelSelection: command.defaultModelSelection ?? neroModel,
          scripts: [],
          createdAt: at,
          updatedAt: at,
          deletedAt: null,
        };
        if (command.createWorkspaceRootIfMissing === true) {
          Fs.mkdirSync(Path.resolve(command.workspaceRoot), { recursive: true });
        }
        this.projects.set(project.id, project);
        const event: OrchestrationEvent = {
          ...this.eventBase(command.commandId, "project", project.id),
          type: "project.created",
          payload: {
            projectId: project.id,
            title: project.title,
            workspaceRoot: project.workspaceRoot,
            defaultModelSelection: project.defaultModelSelection,
            scripts: project.scripts,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          },
        };
        this.emitProject(project, event.sequence);
        break;
      }
      case "project.meta.update": {
        const project = this.requireProject(command.projectId);
        const updated: OrchestrationProject = {
          ...project,
          title: command.title ?? project.title,
          workspaceRoot: command.workspaceRoot ?? project.workspaceRoot,
          defaultModelSelection:
            command.defaultModelSelection === undefined
              ? project.defaultModelSelection
              : command.defaultModelSelection,
          defaultThreadEnvMode:
            command.defaultThreadEnvMode === undefined
              ? project.defaultThreadEnvMode
              : command.defaultThreadEnvMode,
          faviconPath:
            command.faviconPath === undefined ? project.faviconPath : command.faviconPath,
          scripts: command.scripts ?? project.scripts,
          updatedAt: nowIso(),
        };
        this.projects.set(updated.id, updated);
        const event: OrchestrationEvent = {
          ...this.eventBase(command.commandId, "project", updated.id),
          type: "project.meta-updated",
          payload: {
            projectId: updated.id,
            title: command.title,
            workspaceRoot: command.workspaceRoot,
            defaultModelSelection: command.defaultModelSelection,
            defaultThreadEnvMode: command.defaultThreadEnvMode,
            faviconPath: command.faviconPath,
            scripts: command.scripts,
            updatedAt: updated.updatedAt,
          },
        };
        this.emitProject(updated, event.sequence);
        break;
      }
      case "project.delete": {
        const project = this.requireProject(command.projectId);
        const deletedAt = nowIso();
        this.projects.set(project.id, { ...project, deletedAt, updatedAt: deletedAt });
        this.shellHub.emit({
          kind: "project-removed",
          sequence: this.nextSequence(),
          projectId: project.id,
        });
        break;
      }
      case "thread.create": {
        const thread = this.createThread({
          threadId: command.threadId,
          projectId: command.projectId,
          title: command.title,
          modelSelection: command.modelSelection,
          runtimeMode: command.runtimeMode,
          interactionMode: command.interactionMode,
          branch: command.branch,
          worktreePath: command.worktreePath,
          createdAt: command.createdAt,
          commandId: command.commandId,
        });
        void thread;
        break;
      }
      case "thread.delete": {
        const thread = this.requireThread(command.threadId);
        const deletedAt = nowIso();
        this.threads.set(thread.id, { ...thread, deletedAt, updatedAt: deletedAt });
        const sequence = this.nextSequence();
        this.shellHub.emit({ kind: "thread-removed", sequence, threadId: thread.id });
        this.threadHub(thread.id).emit({
          kind: "event",
          event: {
            ...this.eventBase(command.commandId, "thread", thread.id),
            sequence,
            type: "thread.deleted",
            payload: { threadId: thread.id, deletedAt },
          },
        });
        break;
      }
      case "thread.archive": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const archivedAt = nowIso();
          return {
            thread: { ...thread, archivedAt, updatedAt: archivedAt },
            type: "thread.archived",
            payload: { threadId: thread.id, archivedAt, updatedAt: archivedAt },
          };
        });
        break;
      }
      case "thread.unarchive": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const updatedAt = nowIso();
          return {
            thread: { ...thread, archivedAt: null, updatedAt },
            type: "thread.unarchived",
            payload: { threadId: thread.id, updatedAt },
          };
        });
        break;
      }
      case "thread.settle": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const settledAt = nowIso();
          return {
            thread: { ...thread, settledOverride: "settled", settledAt, updatedAt: settledAt },
            type: "thread.settled",
            payload: { threadId: thread.id, settledAt, updatedAt: settledAt },
          };
        });
        break;
      }
      case "thread.unsettle": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const updatedAt = nowIso();
          return {
            thread: {
              ...thread,
              settledOverride: "active",
              settledAt: null,
              unsettledAt: updatedAt,
              updatedAt,
            },
            type: "thread.unsettled",
            payload: { threadId: thread.id, reason: "user", updatedAt },
          };
        });
        break;
      }
      case "thread.snooze": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const snoozedAt = nowIso();
          return {
            thread: {
              ...thread,
              snoozedUntil: command.snoozedUntil,
              snoozedAt,
              updatedAt: snoozedAt,
            },
            type: "thread.snoozed",
            payload: {
              threadId: thread.id,
              snoozedUntil: command.snoozedUntil,
              snoozedAt,
              updatedAt: snoozedAt,
            },
          };
        });
        break;
      }
      case "thread.unsnooze": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const updatedAt = nowIso();
          return {
            thread: { ...thread, snoozedUntil: null, snoozedAt: null, updatedAt },
            type: "thread.unsnoozed",
            payload: { threadId: thread.id, reason: "user", updatedAt },
          };
        });
        break;
      }
      case "thread.pin": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const pinnedAt = nowIso();
          return {
            thread: {
              ...thread,
              pinnedAt,
              pinOrderKey: command.orderKey ?? thread.pinOrderKey,
              updatedAt: pinnedAt,
            },
            type: "thread.pinned",
            payload: {
              threadId: thread.id,
              pinnedAt,
              pinOrderKey: command.orderKey,
              updatedAt: pinnedAt,
            },
          };
        });
        break;
      }
      case "thread.unpin": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const updatedAt = nowIso();
          return {
            thread: { ...thread, pinnedAt: null, pinOrderKey: null, updatedAt },
            type: "thread.unpinned",
            payload: { threadId: thread.id, updatedAt },
          };
        });
        break;
      }
      case "thread.pin.reorder": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const updatedAt = nowIso();
          return {
            thread: { ...thread, pinOrderKey: command.orderKey, updatedAt },
            type: "thread.pin-reordered",
            payload: { threadId: thread.id, orderKey: command.orderKey, updatedAt },
          };
        });
        break;
      }
      case "thread.meta.update": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const updatedAt = nowIso();
          const title =
            command.regenerateTitle === true
              ? thread.messages.find((message) => message.role === "user")?.text.slice(0, 80) ||
                thread.title
              : (command.title ?? thread.title);
          const next: OrchestrationThread = {
            ...thread,
            title,
            modelSelection: command.modelSelection ?? thread.modelSelection,
            branch: command.branch === undefined ? thread.branch : command.branch,
            worktreePath:
              command.worktreePath === undefined ? thread.worktreePath : command.worktreePath,
            linkedPullRequest:
              command.linkedPullRequest === undefined
                ? thread.linkedPullRequest
                : command.linkedPullRequest,
            titleRegeneration: null,
            updatedAt,
          };
          return {
            thread: next,
            type: "thread.meta-updated",
            payload: {
              threadId: thread.id,
              title: command.title,
              regenerateTitle: command.regenerateTitle,
              modelSelection: command.modelSelection,
              branch: command.branch,
              worktreePath: command.worktreePath,
              linkedPullRequest: command.linkedPullRequest,
              updatedAt,
            },
          };
        });
        break;
      }
      case "thread.runtime-mode.set": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const updatedAt = nowIso();
          return {
            thread: { ...thread, runtimeMode: command.runtimeMode, updatedAt },
            type: "thread.runtime-mode-set",
            payload: { threadId: thread.id, runtimeMode: command.runtimeMode, updatedAt },
          };
        });
        break;
      }
      case "thread.interaction-mode.set": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const updatedAt = nowIso();
          return {
            thread: { ...thread, interactionMode: command.interactionMode, updatedAt },
            type: "thread.interaction-mode-set",
            payload: { threadId: thread.id, interactionMode: command.interactionMode, updatedAt },
          };
        });
        break;
      }
      case "thread.turn.start": {
        this.startTurn(command);
        break;
      }
      case "thread.turn.interrupt": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const createdAt = command.createdAt;
          const latestTurn =
            thread.latestTurn === null
              ? thread.latestTurn
              : { ...thread.latestTurn, state: "interrupted" as const, completedAt: createdAt };
          return {
            thread: {
              ...thread,
              latestTurn,
              session:
                thread.session === null
                  ? null
                  : { ...thread.session, status: "interrupted", updatedAt: createdAt },
              updatedAt: createdAt,
            },
            type: "thread.turn-interrupt-requested",
            payload: { threadId: thread.id, turnId: command.turnId, createdAt },
          };
        });
        break;
      }
      case "thread.approval.respond":
      case "thread.user-input.respond": {
        break;
      }
      case "thread.checkpoint.revert": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const userTurns = thread.messages.filter((message) => message.role === "user");
          const keepUsers = Math.max(0, userTurns.length - command.turnCount);
          const cutoff = userTurns[keepUsers]?.createdAt;
          const messages =
            cutoff === undefined
              ? []
              : thread.messages.filter((message) => message.createdAt < cutoff);
          const updatedAt = nowIso();
          return {
            thread: { ...thread, messages, latestTurn: null, updatedAt },
            type: "thread.reverted",
            payload: { threadId: thread.id, turnCount: command.turnCount },
          };
        });
        break;
      }
      case "thread.session.stop": {
        this.patchThread(command.threadId, command.commandId, (thread) => {
          const createdAt = command.createdAt;
          return {
            thread: {
              ...thread,
              session:
                thread.session === null
                  ? null
                  : {
                      ...thread.session,
                      status: "stopped",
                      activeTurnId: null,
                      updatedAt: createdAt,
                    },
              updatedAt: createdAt,
            },
            type: "thread.session-stop-requested",
            payload: { threadId: thread.id, createdAt },
          };
        });
        break;
      }
      default:
        break;
    }
    this.schedulePersist();
    return { sequence: this.sequence };
  }

  private requireProject(projectId: string): OrchestrationProject {
    const project = this.projects.get(projectId);
    if (project === undefined || project.deletedAt !== null) {
      throw new Error(`Unknown project ${projectId}`);
    }
    return project;
  }

  private requireThread(threadId: string): OrchestrationThread {
    const thread = this.threads.get(threadId);
    if (thread === undefined || thread.deletedAt !== null) {
      throw new Error(`Unknown thread ${threadId}`);
    }
    return thread;
  }

  private createThread(input: {
    readonly threadId: string;
    readonly projectId: string;
    readonly title: string;
    readonly modelSelection: OrchestrationThread["modelSelection"];
    readonly runtimeMode: OrchestrationThread["runtimeMode"];
    readonly interactionMode: OrchestrationThread["interactionMode"];
    readonly branch: string | null;
    readonly worktreePath: string | null;
    readonly createdAt: string;
    readonly commandId: string;
  }): OrchestrationThread {
    this.requireProject(input.projectId);
    const thread: OrchestrationThread = {
      id: ThreadId.make(input.threadId),
      projectId: ProjectId.make(input.projectId),
      title: input.title,
      modelSelection: input.modelSelection,
      runtimeMode: input.runtimeMode,
      interactionMode: input.interactionMode,
      branch: input.branch,
      worktreePath: input.worktreePath,
      latestTurn: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      archivedAt: null,
      settledOverride: null,
      settledAt: null,
      deletedAt: null,
      messages: [],
      proposedPlans: [],
      activities: [],
      checkpoints: [],
      session: null,
    };
    this.threads.set(thread.id, thread);
    const event: OrchestrationEvent = {
      ...this.eventBase(input.commandId, "thread", thread.id),
      type: "thread.created",
      payload: {
        threadId: thread.id,
        projectId: thread.projectId,
        title: thread.title,
        modelSelection: thread.modelSelection,
        runtimeMode: thread.runtimeMode,
        interactionMode: thread.interactionMode,
        branch: thread.branch,
        worktreePath: thread.worktreePath,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      },
    };
    this.emitThreadEvent(thread, event);
    return thread;
  }

  private patchThread(
    threadId: string,
    commandId: string,
    mutate: (thread: OrchestrationThread) =>
      | {
          readonly thread: OrchestrationThread;
          readonly type: OrchestrationEvent["type"];
          readonly payload: never;
        }
      | {
          readonly thread: OrchestrationThread;
          readonly type: string;
          readonly payload: unknown;
        },
  ): OrchestrationThread {
    const current = this.requireThread(threadId);
    const next = mutate(current);
    this.threads.set(next.thread.id, next.thread);
    const event = {
      ...this.eventBase(commandId, "thread", next.thread.id),
      type: next.type,
      payload: next.payload,
    } as OrchestrationEvent;
    this.emitThreadEvent(next.thread, event);
    return next.thread;
  }

  private startTurn(
    command: Extract<ClientOrchestrationCommand, { type: "thread.turn.start" }>,
  ): void {
    let thread = this.threads.get(command.threadId);
    if (thread === undefined && command.bootstrap?.createThread !== undefined) {
      const bootstrap = command.bootstrap.createThread;
      thread = this.createThread({
        threadId: command.threadId,
        projectId: bootstrap.projectId,
        title: bootstrap.title,
        modelSelection: bootstrap.modelSelection,
        runtimeMode: bootstrap.runtimeMode,
        interactionMode: bootstrap.interactionMode,
        branch: bootstrap.branch,
        worktreePath: bootstrap.worktreePath,
        createdAt: bootstrap.createdAt,
        commandId: command.commandId,
      });
    }
    if (thread === undefined) this.requireThread(command.threadId);
    thread = this.requireThread(command.threadId);
    const at = command.createdAt;
    const turnId = TurnId.make(nextToken("trn"));
    const attachments = command.message.attachments
      .map((item) => attachmentFromUnknown(item))
      .filter((item): item is ChatAttachment => item !== undefined);
    const userMessage = {
      id: MessageId.make(command.message.messageId),
      role: "user" as const,
      text: command.message.text,
      attachments,
      turnId,
      streaming: false,
      createdAt: at,
      updatedAt: at,
    };
    const assistantId = MessageId.make(nextToken("msg"));
    const assistantText =
      "Nero v1 stub: the GLM loop lands in a later PR. Your message was recorded.";
    const assistantMessage = {
      id: assistantId,
      role: "assistant" as const,
      text: assistantText,
      turnId,
      streaming: false,
      createdAt: at,
      updatedAt: at,
    };
    const session = {
      threadId: thread.id,
      status: "ready" as const,
      providerName: "Nero",
      providerInstanceId: ProviderInstanceId.make(NERO_INSTANCE_ID),
      runtimeMode: command.runtimeMode,
      activeTurnId: null,
      lastError: null,
      updatedAt: at,
    };
    const next: OrchestrationThread = {
      ...thread,
      modelSelection: command.modelSelection ?? thread.modelSelection,
      runtimeMode: command.runtimeMode,
      interactionMode: command.interactionMode,
      title:
        thread.messages.length === 0 && thread.title === "New thread"
          ? command.message.text.slice(0, 72) || thread.title
          : thread.title,
      messages: [...thread.messages, userMessage, assistantMessage],
      latestTurn: {
        turnId,
        state: "completed",
        requestedAt: at,
        startedAt: at,
        completedAt: at,
        assistantMessageId: assistantId,
      },
      session,
      updatedAt: at,
    };
    this.threads.set(next.id, next);
    const userEvent: OrchestrationEvent = {
      ...this.eventBase(command.commandId, "thread", next.id),
      type: "thread.message-sent",
      payload: {
        threadId: next.id,
        messageId: userMessage.id,
        role: "user",
        text: userMessage.text,
        attachments,
        turnId,
        streaming: false,
        createdAt: at,
        updatedAt: at,
      },
    };
    this.emitThreadEvent(next, userEvent);
    const startEvent: OrchestrationEvent = {
      ...this.eventBase(command.commandId, "thread", next.id),
      type: "thread.turn-start-requested",
      payload: {
        threadId: next.id,
        messageId: userMessage.id,
        modelSelection: command.modelSelection,
        titleSeed: command.titleSeed,
        runtimeMode: command.runtimeMode,
        interactionMode: command.interactionMode,
        createdAt: at,
      },
    };
    this.emitThreadEvent(next, startEvent);
    const assistantEvent: OrchestrationEvent = {
      ...this.eventBase(command.commandId, "thread", next.id),
      type: "thread.message-sent",
      payload: {
        threadId: next.id,
        messageId: assistantId,
        role: "assistant",
        text: assistantText,
        turnId,
        streaming: false,
        createdAt: at,
        updatedAt: at,
      },
    };
    this.emitThreadEvent(next, assistantEvent);
  }

  searchThreads(query: string, limit: number | undefined): OrchestrationSearchThreadsResult {
    const needle = query.toLowerCase();
    const matches: {
      threadId: OrchestrationSearchThreadsResult["matches"][number]["threadId"];
      projectId: OrchestrationSearchThreadsResult["matches"][number]["projectId"];
      source: OrchestrationSearchThreadsResult["matches"][number]["source"];
      snippet: string;
      messageCreatedAt: string | null;
    }[] = [];
    const cap = limit ?? 20;
    for (const thread of this.threads.values()) {
      if (thread.deletedAt !== null) continue;
      const project = this.projects.get(thread.projectId);
      if (project === undefined) continue;
      for (const message of thread.messages) {
        const index = message.text.toLowerCase().indexOf(needle);
        if (index < 0) continue;
        const start = Math.max(0, index - 40);
        matches.push({
          threadId: thread.id,
          projectId: thread.projectId,
          source: message.role === "assistant" ? "assistant" : "user",
          snippet: message.text.slice(start, start + 240),
          messageCreatedAt: message.createdAt,
        });
        if (matches.length >= cap) return { matches };
      }
    }
    return { matches };
  }

  previewOpen(input: PreviewOpenInput): PreviewSessionSnapshot {
    // One seat: never mint URL/file preview tabs the panel would still render as Kasm.
    const existing = this.previews.get(`${input.threadId}:${SEAT_PREVIEW_TAB_ID}`);
    if (existing !== undefined) {
      if (input.viewport !== undefined && existing.viewport !== input.viewport) {
        return this.previewResize({
          threadId: input.threadId,
          tabId: SEAT_PREVIEW_TAB_ID,
          viewport: input.viewport,
        });
      }
      return existing;
    }
    const at = nowIso();
    const snapshot: PreviewSessionSnapshot = {
      threadId: input.threadId,
      tabId: SEAT_PREVIEW_TAB_ID,
      navStatus: { _tag: "Success", url: SEAT_VNC_URL, title: SEAT_VNC_TITLE },
      canGoBack: false,
      canGoForward: false,
      viewport: input.viewport,
      updatedAt: at,
    };
    this.previews.set(`${input.threadId}:${SEAT_PREVIEW_TAB_ID}`, snapshot);
    this.previewRevision += 1;
    this.previewHub.emit({
      type: "opened",
      threadId: input.threadId,
      tabId: SEAT_PREVIEW_TAB_ID,
      createdAt: at,
      serverEpoch: this.serverEpoch,
      revision: this.previewRevision,
      snapshot,
    });
    return snapshot;
  }

  previewNavigate(input: PreviewNavigateInput): PreviewSessionSnapshot {
    const key = `${input.threadId}:${input.tabId}`;
    const current = this.previews.get(key);
    if (current === undefined) {
      return this.previewOpen({ threadId: input.threadId });
    }
    const snapshot: PreviewSessionSnapshot = {
      ...current,
      navStatus: { _tag: "Success", url: SEAT_VNC_URL, title: SEAT_VNC_TITLE },
      updatedAt: nowIso(),
    };
    this.previews.set(key, snapshot);
    this.previewRevision += 1;
    this.previewHub.emit({
      type: "navigated",
      threadId: input.threadId,
      tabId: input.tabId,
      createdAt: snapshot.updatedAt,
      serverEpoch: this.serverEpoch,
      revision: this.previewRevision,
      snapshot,
    });
    return snapshot;
  }

  previewResize(input: PreviewResizeInput): PreviewSessionSnapshot {
    const key = `${input.threadId}:${input.tabId}`;
    const current = this.previews.get(key);
    if (current === undefined) {
      return this.previewOpen({ threadId: input.threadId, viewport: input.viewport });
    }
    const snapshot: PreviewSessionSnapshot = {
      ...current,
      viewport: input.viewport,
      updatedAt: nowIso(),
    };
    this.previews.set(key, snapshot);
    this.previewRevision += 1;
    this.previewHub.emit({
      type: "resized",
      threadId: input.threadId,
      tabId: input.tabId,
      createdAt: snapshot.updatedAt,
      serverEpoch: this.serverEpoch,
      revision: this.previewRevision,
      snapshot,
    });
    return snapshot;
  }

  previewClose(threadId: string, tabId: string | undefined): void {
    const keys = [...this.previews.keys()].filter((key) =>
      tabId === undefined ? key.startsWith(`${threadId}:`) : key === `${threadId}:${tabId}`,
    );
    for (const key of keys) {
      const snapshot = this.previews.get(key);
      this.previews.delete(key);
      if (snapshot === undefined) continue;
      this.previewRevision += 1;
      this.previewHub.emit({
        type: "closed",
        threadId: snapshot.threadId,
        tabId: snapshot.tabId,
        createdAt: nowIso(),
        serverEpoch: this.serverEpoch,
        revision: this.previewRevision,
      });
    }
  }

  previewList(threadId: string): PreviewListResult {
    const sessions = [...this.previews.values()].filter((session) => session.threadId === threadId);
    return { sessions, serverEpoch: this.serverEpoch, revision: this.previewRevision };
  }

  previewReportStatus(input: PreviewReportStatusInput): void {
    const key = `${input.threadId}:${input.tabId}`;
    const current = this.previews.get(key);
    if (current === undefined) return;
    const snapshot: PreviewSessionSnapshot = {
      ...current,
      navStatus: input.navStatus,
      canGoBack: input.canGoBack,
      canGoForward: input.canGoForward,
      updatedAt: nowIso(),
    };
    this.previews.set(key, snapshot);
    this.previewRevision += 1;
    this.previewHub.emit({
      type: "navigated",
      threadId: snapshot.threadId,
      tabId: snapshot.tabId,
      createdAt: snapshot.updatedAt,
      serverEpoch: this.serverEpoch,
      revision: this.previewRevision,
      snapshot,
    });
  }

  setHumanDriving(driving: boolean): Promise<{ driving: boolean }> {
    return this.humanDriving.setDriving(driving);
  }

  dispose(): void {
    this.humanDriving.dispose();
  }

  pid(): number {
    return Process.pid;
  }
}
