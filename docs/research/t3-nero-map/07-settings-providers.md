# 07 — T3 web settings, providers, models

Primary-source map of `apps/web/src` settings, provider instances, model picker, usage, and observability. File-level **copy / adapt / delete** for Nero.

Nero lock for this slice:

- Single harness: provider id `nero`.
- Single shipped model for now: **GLM-5.3-Flash** on Baseten. A Nero-owned list may replace the one-model UI later.
- Delete multi-harness settings, provider CLI install/update, and T3 self-update.
- Keep skills / slash if they are names and copy from `ServerProvider` / `ServerConfig`, not harness catalogs.

No previous Nero / code-broker / grid-01 product code was consulted. Paths below are absolute under `/tmp/t3code-upstream`.

---

## 1. What T3 actually ships

Settings is a routed workspace, not a modal. `/settings` redirects to `/settings/general`. Sidebar order and search titles both come from `SETTINGS_SECTION_LABELS` / `SETTINGS_SEARCH_ITEMS`.

| Path | Panel | What it is |
|---|---|---|
| `/settings/general` | `GeneralSettingsPanel` | App prefs + text-generation model + About/version + link to diagnostics + legacy toggles |
| `/settings/appearance` | `AppearanceSettingsPanel` | Theme, contrast, glass, fonts, word wrap, environment identification |
| `/settings/keybindings` | `KeybindingsSettingsPanel` | Full keybinding editor against server-resolved config |
| `/settings/providers` | `ProviderSettingsPanel` | Multi-environment, multi-driver instance list + add-instance wizard + CLI update |
| `/settings/integrations` | `IntegrationsSettingsPanel` | Embedded browser defaults (viewport, zoom, appearance, floating preview, agent browser access) |
| `/settings/source-control` | `SourceControlSettings` + `SourceControlWritingSettingsSection` | GitHub/GitLab auth discovery, fetch interval, **writer model picker** |
| `/settings/connections` | `ConnectionsSettings` | Pairing, QR, scopes, SSH/WSL, remote environments |
| `/settings/archived` | `ArchivedThreadsPanel` | Unarchive / delete archived threads |
| `/settings/diagnostics` | `DiagnosticsSettingsPanel` | Not in the sidebar. Linked from General → About. Traces, processes, resource telemetry |
| `/usage` | `UsagePage` | Cost/token charts keyed by `UsageProviderKind` (`codex` / `claude` / `grok`) |

Search catalog lives in `components/settings/settingsSearch.ts`. Restore-defaults on the General header only resets the dirty-label set in `useSettingsRestore` (not keybindings, not provider instances, not source-control writing).

Provider identity on the wire is **instance-scoped**, not driver-scoped. `ServerProvider[]` is one snapshot per configured instance (`codex`, `codex_personal`, …). UI projection is `ProviderInstanceEntry` in `providerInstances.ts`. The composer, settings list, project default model, text-generation model, and source-control writer all share `ProviderModelPicker`.

Skills and slash commands are **not** a local catalog. They arrive on the selected instance snapshot (`selectedProviderStatus.skills` / `.slashCommands`) and are searched by name / description.

---

## 2. Nero decisions implied by this map

| T3 behavior | Nero |
|---|---|
| Five drivers + custom instances + coming-soon drivers | One `nero` instance. No add-provider wizard. |
| Per-instance custom models, hide/favorite/reorder | One model now; later a Nero-owned list. Drop hide/favorite/reorder unless Nero needs it. |
| CLI install, PATH probe, version advisory, one-click `server.updateProvider` | Delete. Baseten is not a local CLI harness. |
| `enableProviderUpdateChecks` + toasts + sidebar pill | Delete. |
| Desktop Electron updater + hosted channel + `npx t3@version` self-update | Delete T3 self-update. Keep a static version label if Nero wants an About row. |
| OpenCode “plan” agent heal, `/plan` `/default`, TraitsPicker ultrathink | Delete with legacy plan mode unless Nero redefines plan. |
| `$` skill menu + `/` slash (built-ins + provider commands + optional skills) | Keep. Source is ServerConfig/snapshot names. Keep `showSkillsInSlashMenu`. Drop `/model` if there is only one model. |
| Usage page split by Codex/Claude/Grok | Adapt to Nero (single series) or hide until Nero has a usage contract. |
| Provider health interval (background activity) | Adapt: drop CLI health, keep Git/background policy if Nero still probes anything. |

---

## 3. Settings IA — file-level

### 3.1 Routes

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/routes/settings.tsx` | **COPY** | Auth gate, redirect `/settings` → general, Escape-to-back, restore-defaults chrome. Strip restore of `enableProviderUpdateChecks` / text-gen defaults as those settings shrink. |
| `/tmp/t3code-upstream/apps/web/src/routes/settings.general.tsx` | **COPY** | Thin route. |
| `/tmp/t3code-upstream/apps/web/src/routes/settings.appearance.tsx` | **COPY** | Thin route. |
| `/tmp/t3code-upstream/apps/web/src/routes/settings.keybindings.tsx` | **COPY** | Thin route. |
| `/tmp/t3code-upstream/apps/web/src/routes/settings.providers.tsx` | **DELETE** (or replace) | Entire page is multi-harness. If Nero needs a status page, it is a new thin panel, not this one. |
| `/tmp/t3code-upstream/apps/web/src/routes/settings.integrations.tsx` | **COPY** | Browser prefs. Independent of harnesses. |
| `/tmp/t3code-upstream/apps/web/src/routes/settings.source-control.tsx` | **COPY** | Git hosting, not agent harness. |
| `/tmp/t3code-upstream/apps/web/src/routes/settings.connections.tsx` | **COPY** | Pairing/remote. Nero remote story may later replace this, but it is not multi-harness. |
| `/tmp/t3code-upstream/apps/web/src/routes/settings.archived.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/routes/settings.diagnostics.tsx` | **COPY** | Hidden diagnostics page. |
| `/tmp/t3code-upstream/apps/web/src/routes/usage.tsx` | **ADAPT** | Keep route only if Nero ships usage; otherwise delete with the usage components. |

### 3.2 Shell, search, layout

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/components/settings/settingsSearch.ts` | **ADAPT** | Drop `provider-update-checks`, maybe `providers`, `text-generation-model` if one model is not user-selectable. Keep `skills-in-slash-menu`. Drop `/settings/providers` from `SettingsPath` if the page dies. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/settingsSearch.test.ts` | **ADAPT** | Follow catalog. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/SettingsSidebarNav.tsx` | **ADAPT** | Drop Providers nav item if the page dies. Search UI itself copies. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/SettingsBreadcrumb.tsx` | **ADAPT** | Labels follow `SETTINGS_SECTION_LABELS` + diagnostics. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/settingsLayout.tsx` | **COPY** | Page container, rows, search-target pulse, policy tooltip, relative-time tick. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/settingsLayout.test.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/itemRows.ts` | **COPY** | Shared row classnames (also used by cloud connect list). |

---

## 4. `components/settings` — panels

### 4.1 General / appearance / restore (`SettingsPanels.tsx`)

One large module: restore-defaults, appearance, general, archive.

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/components/settings/SettingsPanels.tsx` | **ADAPT** | **Keep:** project grouping, auto-settle, time format, whitespace diffs, skills-in-slash, background activity (minus provider-health copy), new-thread env mode, add-project dir, archive/delete/quit confirms, appearance panel, archive panel. **Delete inside this file:** `enableProviderUpdateChecks` row; `AboutVersionSection` desktop/hosted updater (channel picker, download/install via `desktopBridge`); `ProviderModelPicker` + `TraitsPicker` for text-generation unless Nero still needs a hidden default. **Delete or fold:** `LegacyFeaturesSection` (plan mode, token streaming, legacy sidebar) — plan mode is OpenCode-shaped. Static version `code` row can stay. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/SettingsPanels.logic.ts` | **ADAPT** | Keep grouping, typography-dirty, browser-dirty, background-activity helpers, diagnostics description. **Delete** `buildProviderInstanceUpdatePatch` (writes `providers[driver]` + `providerInstances[id]`). Drop `providerHealthRefreshInterval` from restore/dirty if Nero has no CLI probe. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/SettingsPanels.logic.test.ts` | **ADAPT** | |

`AboutVersionSection` (same file) is the T3 **self-update** UI: Electron channel (`latest` vs nightly), `checkForUpdate` / `downloadUpdate` / `quitAndInstall`, hosted-app channel URL. **Delete** for Nero. A version string is enough.

### 4.2 Providers page — delete cluster

This is the multi-harness settings surface. Nero should not port the wizard, per-driver schemas, custom instances, env-var editor, or CLI update buttons.

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderSettingsPanel.tsx` | **DELETE** | Environment tabs, add-provider, instance list/editor, `server.updateProvider`, refresh probes, health-check interval. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderSettingsPanel.logic.ts` | **DELETE** | Environment option ordering + operate-scope access classification. Only used by this panel. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderSettingsPanel.logic.test.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderSettingsPanel.environment.test.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/providerDriverMeta.ts` | **DELETE** | Hardcoded Codex / Claude / Cursor / Grok / OpenCode client defs + schemas + icons. Nero is not a fifth entry in this list. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/AddProviderInstanceDialog.tsx` | **DELETE** | Wizard: driver → identity slug → schema config. Includes “coming soon” Copilot/Gemini/ACP/Pi. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/AddProviderInstanceDialog.logic.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/AddProviderInstanceDialog.test.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/AddProviderInstanceDialog.environment.test.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/AddProviderInstanceWizardSteps.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/AddProviderInstanceWizardSteps.test.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderInstanceCard.tsx` | **DELETE** | Per-instance card: enable switch, accent, env vars, custom models, hide/favorite/reorder, copy CLI update command, one-click update. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderInstanceCard.test.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderModelsSection.tsx` | **DELETE** | Custom model CRUD + favorites + hide + reorder. Placeholders are per T3 driver. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderSettingsForm.tsx` | **DELETE** | Generic form from driver schema annotations (`CodexSettings`, `ClaudeSettings`, …). |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderSettingsForm.test.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProviderAccentColorPicker.tsx` | **DELETE** | Distinguishes multiple instances of the same driver. Unused with one `nero`. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/providerSettingsTabs.ts` | **DELETE** | Models vs Configuration tab chrome on the instance card. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/providerStatus.ts` | **DELETE** (or tiny adapt) | CLI install/auth/version-advisory copy (“CLI not detected on PATH”, “Update available: install vX”). Nero status, if any, is Baseten/auth, not PATH. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/RedactedSensitiveText.tsx` | **COPY** | Used for provider auth email; also generally useful. Keep if connections/diagnostics still redact. |

If Nero later needs a single “Nero / GLM-5.3-Flash” status row (connected, last error), that is a **new** 50-line panel, not a fork of `ProviderSettingsPanel`.

### 4.3 Other settings panels — not harnesses

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/components/settings/ThemeSettings.tsx` | **COPY** | Theme library. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ThemeEditorHost.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ThemeEditorPanel.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/themeEditorStore.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/themeEditorStore.test.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ThemeImportDialog.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ThemeImportDialog.test.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ThemeColorPicker.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ThemePreviewCircles.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ThemeSearchSection.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ThemeWireframe.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/themeInspector.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/themeInspector.test.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/FontFamilyPicker.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/SettingsFontPreviews.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/KeybindingsSettings.tsx` | **COPY** | Editor itself is harness-agnostic. Bindings like `modelPicker.jump.*` shrink with the picker. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/KeybindingsSettings.logic.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/KeybindingsSettings.logic.test.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/IntegrationsSettings.tsx` | **COPY** | Browser defaults. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/SourceControlSettings.tsx` | **COPY** | Hosting providers (GitHub/GitLab), not agent harnesses. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/SourceControlWritingSettings.tsx` | **ADAPT** | Writing style modes copy. **Writer `ProviderModelPicker`** must collapse to Nero’s one model (or disappear; always use the only model). |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ConnectionsSettings.tsx` | **COPY** | Pairing / remote / SSH / WSL. Large, but orthogonal. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ConnectionsSettings.logic.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ConnectionsSettings.logic.test.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/pairingUrls.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/pairingUrls.test.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProjectSettingsPanel.tsx` | **ADAPT** | Project favicon, scripts, grouping copy. **Per-project default model picker** (same `ProviderModelPicker`) → one Nero model or omit the row. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProjectSettingsPanel.logic.ts` | **COPY** | Title-dirty helper. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProjectSettingsPanel.logic.test.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProjectFaviconPickerDialog.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ProjectFaviconPickerDialog.test.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/DiagnosticsSettings.tsx` | **COPY** | Traces + process signals. Uses `editorPreferences` to open files. Not harness-specific. |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ResourceTelemetryDiagnostics.tsx` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ResourceTelemetryDiagnostics.logic.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/settings/ResourceTelemetryDiagnostics.logic.test.ts` | **COPY** | |

---

## 5. Provider / model modules at `apps/web/src`

### 5.1 Instance projection

`/tmp/t3code-upstream/apps/web/src/providerInstances.ts` — **ADAPT**, do not copy as-is.

What it does:

- Projects `ServerProvider[]` → `ProviderInstanceEntry[]` (id, driver, displayName, accent, enabled, installed, status, models).
- Overlay settings `enabled` onto streamed snapshots (`applyProviderInstanceSettings`).
- Sort default-instance-first per driver.
- Resolve selectable instance for new threads; refuse to infer driver from a missing id.
- `NO_PROVIDER_MODEL_SELECTION` placeholder (`t3code_no_provider`).
- Multi-env nested lookup so the same default id (`codex`) does not clobber across environments.

Nero: keep the **entry type and enabled overlay** if the wire still sends `ServerProvider[]` with one `nero` snapshot. Delete default-vs-custom sort, accent badges, `DEFAULT_MODEL_BY_PROVIDER[driver]`, and driver-kind fallbacks. Tests: `providerInstances.test.ts` **ADAPT**.

### 5.2 Kind-scoped model helpers (legacy)

`/tmp/t3code-upstream/apps/web/src/providerModels.ts` — **DELETE** after call sites move.

This is the **old** “first snapshot whose instance id is the default for this driver kind” layer. Defaults `ProviderDriverKind.make("codex")`. Used by `modelSelection.ts`, `TraitsPicker`, `composerProviderState`. Nero should read models off the single `nero` entry (or a Nero-owned list), not `getProviderSnapshot(providers, kind)`.

`withoutPlanAgentOption` is OpenCode-only. **Delete** with plan mode.

### 5.3 App model selection

`/tmp/t3code-upstream/apps/web/src/modelSelection.ts` — **ADAPT**.

Responsibilities:

- Merge probe models + per-instance `customModels` + `providerModelPreferences` (hidden + order).
- `getCustomModelOptionsByInstance` for the picker.
- `resolveAppModelSelectionState` for **text-generation** (titles, PR bodies): falls back across enabled instances; default instance id is `"codex"`.
- `withoutPlanAgentSelection` / `resolvePlanAgentHealPatch` for OpenCode `agent=plan`.

Nero:

- One instance id `nero`, one slug `glm-5.3-flash` (name TBD to match server).
- Drop custom-model lists, hidden/order prefs, plan-agent heal.
- Keep a tiny resolver so a missing snapshot still produces `{ instanceId: "nero", model: "glm-5.3-flash" }`.

`modelSelection.test.ts` **ADAPT**.  
`/tmp/t3code-upstream/apps/web/src/planAgentSelectionHeal.tsx` **DELETE** (mounted in `routes/__root.tsx`).

### 5.4 Ordering and picker visibility

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/modelOrdering.ts` | **DELETE** (or later adapt) | Favorite grouping + per-instance order + cross-instance sort. Pointless for one model. Reintroduce if Nero ships a list. |
| `/tmp/t3code-upstream/apps/web/src/modelOrdering.test.ts` | **DELETE** with the module. |
| `/tmp/t3code-upstream/apps/web/src/modelPickerVisibility.ts` | **ADAPT** | `document.querySelector("[data-model-picker-content]")` so keybindings know the popover is open. Keep iff the picker remains a popover. If the picker is gone, delete and drop `modelPickerOpen` from shortcut context. |

### 5.5 Skills search — keep

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/providerSkillSearch.ts` | **COPY** | Scores `ServerProviderSkill` name / label / descriptions / scope. No driver catalog. |
| `/tmp/t3code-upstream/apps/web/src/providerSkillSearch.test.ts` | **COPY** | |

Composer (`ChatComposer.tsx`) already treats skills as snapshot data:

- `$` trigger → `searchProviderSkills(selectedProviderStatus?.skills ?? [])`
- `/` trigger → built-ins + `slashCommands` + optional skills gated by `settings.showSkillsInSlashMenu`

That matches “keep if they are just names from ServerConfig.” Keep the General row `skills-in-slash-menu`.

Built-in slash commands that are **not** ServerConfig:

- `/model` — **DELETE** if one model (or adapt to Nero list later).
- `/plan`, `/default` — **DELETE** with legacy plan mode.

`composerSlashCommandSearch.ts` **ADAPT** only to drop those built-ins; skill scoring stays.

### 5.6 Provider CLI update — delete cluster

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/providerUpdateDismissal.ts` | **DELETE** | localStorage keys for “Codex 1.x available” toasts. |
| `/tmp/t3code-upstream/apps/web/src/providerUpdateDismissal.test.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/ProviderUpdateLaunchNotification.tsx` | **DELETE** | Root-mounted; WSL-split vs primary toast. Navigates to `/settings/providers`. |
| `/tmp/t3code-upstream/apps/web/src/components/ProviderUpdateLaunchNotification.logic.ts` | **DELETE** | Candidates from `versionAdvisory.status === "behind_latest"`. |
| `/tmp/t3code-upstream/apps/web/src/components/ProviderUpdateLaunchNotification.logic.test.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/ProviderUpdateLaunchNotification.environments.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/ProviderUpdatePrimaryNotification.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/ProviderUpdateEnvironmentRows.tsx` | **DELETE** | Calls `server.updateProvider`. |
| `/tmp/t3code-upstream/apps/web/src/components/ProviderUpdateEnvironmentRows.test.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/sidebar/SidebarProviderUpdatePill.tsx` | **DELETE** | Sidebar CTA into provider settings. |

Unmount `ProviderUpdateLaunchNotification` from `routes/__root.tsx`.

---

## 6. Model picker UI (chat, used by settings)

Not under `components/settings`, but settings **is** a consumer. Three call sites besides the composer:

1. General → text generation model  
2. Source control → writer model  
3. Project settings → new-thread default model  

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/components/chat/ProviderModelPicker.tsx` | **ADAPT** | Popover trigger + instance icon/badge. Collapse to a single label, or keep popover for a future Nero list (no instance sidebar). |
| `/tmp/t3code-upstream/apps/web/src/components/chat/ModelPickerContent.tsx` | **ADAPT** | Virtualized list + instance sidebar + jump-key hints + favorites rail. For one model: do not mount. For a later Nero list: drop sidebar / `lockedProvider` / continuation groups. |
| `/tmp/t3code-upstream/apps/web/src/components/chat/ModelPickerSidebar.tsx` | **DELETE** until a list exists | One button per instance + favorites. |
| `/tmp/t3code-upstream/apps/web/src/components/chat/ModelListRow.tsx` | **ADAPT** | Keep if a list returns. |
| `/tmp/t3code-upstream/apps/web/src/components/chat/modelPickerKeys.ts` | **ADAPT** | `${instanceId}:${slug}` keys. With one instance, slug is enough. |
| `/tmp/t3code-upstream/apps/web/src/components/chat/modelPickerKeys.test.ts` | **ADAPT** | |
| `/tmp/t3code-upstream/apps/web/src/components/chat/modelPickerSearch.ts` | **ADAPT** | Keep for a Nero list; unused for one model. |
| `/tmp/t3code-upstream/apps/web/src/components/chat/modelPickerSearch.test.ts` | **ADAPT** | |
| `/tmp/t3code-upstream/apps/web/src/components/chat/modelPickerModelHighlights.ts` | **DELETE** unless Nero marks “new” models | |
| `/tmp/t3code-upstream/apps/web/src/components/chat/providerIconUtils.ts` | **ADAPT** | Trigger labels + `ModelEsque`. Drop multi-provider icon table. |
| `/tmp/t3code-upstream/apps/web/src/components/chat/ProviderInstanceIcon.tsx` | **ADAPT** | One Nero glyph; drop accent badge. |
| `/tmp/t3code-upstream/apps/web/src/components/chat/TraitsPicker.tsx` | **ADAPT or DELETE** | Effort / agent / ultrathink from `ModelCapabilities.optionDescriptors`. Keep only if GLM-5.3-Flash actually exposes options on the snapshot. Ultrathink is Claude-shaped — delete that branch. |
| `/tmp/t3code-upstream/apps/web/src/components/chat/TraitsPicker.test.ts` | follow TraitsPicker | |
| `/tmp/t3code-upstream/apps/web/src/components/chat/composerProviderState.tsx` | **ADAPT** | Builds dispatch options via `getProviderModelCapabilities` + planMode. Strip plan/ultrathink. |

Composer still needs a selected `{ instanceId, model }` on every turn. Even with one model, **copy the selection type**, do not copy the picker chrome.

---

## 7. Keybindings, editor prefs, project scripts

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/keybindings.ts` | **ADAPT** | Core matcher **COPY**. `modelPickerJumpCommandForIndex` / `shouldShowModelPickerJumpHints` **DELETE** if the picker is not a numbered list. Thread-jump helpers stay. |
| `/tmp/t3code-upstream/apps/web/src/keybindings.test.ts` | **ADAPT** | Drop `modelPicker.jump.*` cases if commands die. |
| `/tmp/t3code-upstream/apps/web/src/editorPreferences.ts` | **COPY** | Last-used GUI editor (`t3code:last-editor`) + `openInEditor`. Used by keybindings “open config” and diagnostics. Not a model picker. |
| `/tmp/t3code-upstream/apps/web/src/projectScripts.ts` | **COPY** | Project script ids ↔ `script.<id>.run` keybinding commands. Independent of harnesses. |
| `/tmp/t3code-upstream/apps/web/src/projectScripts.test.ts` | **COPY** | |
| `/tmp/t3code-upstream/apps/web/src/components/projectScriptEditor.tsx` | **COPY** | Consumed by project settings. |
| `/tmp/t3code-upstream/apps/web/src/components/ProjectScriptsControl.tsx` | **COPY** | Chat toolbar. |

---

## 8. T3 self-update (adjacent, must die with About)

User asked to delete T3 self-update. These are the web pieces, even when outside `components/settings`:

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/components/desktopUpdate.logic.ts` | **DELETE** | Electron updater button state, GitHub release URLs (`pingdotgg/t3code`). |
| `/tmp/t3code-upstream/apps/web/src/components/desktopUpdate.logic.test.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/desktopUpdate.toast.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/desktopUpdate.toast.test.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/state/desktopUpdate.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/state/desktopUpdate.test.ts` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/sidebar/SidebarUpdatePill.tsx` | **DELETE** | Desktop app update in the sidebar. |
| `/tmp/t3code-upstream/apps/web/src/components/sidebar/DesktopUpdateStatusIcon.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/components/ServerUpdateAction.tsx` | **DELETE** | Server self-update (`server.updateServer`) + copy `npx t3@version`. |
| `/tmp/t3code-upstream/apps/web/src/components/ServerUpdateAction.test.tsx` | **DELETE** | |
| `/tmp/t3code-upstream/apps/web/src/versionSkew.ts` | **ADAPT** | Keep mismatch detection if Nero still has client/server versions. **Delete** `resolveServerSelfUpdateCapability`, `manualServerUpdateCommand`, `serverUpdateGuidance` install paths. ChatView banners that offer Update must go. |

`APP_VERSION` in `branding.ts` can stay as a display string.

---

## 9. Usage

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/components/usage/usageProviders.ts` | **DELETE or replace** | Exhaustive map `codex` / `claude` / `grok` → colors/icons. Nero is not a fourth key in that union; the contract `UsageProviderKind` must change first. |
| `/tmp/t3code-upstream/apps/web/src/components/usage/UsageProviderChart.tsx` | **ADAPT** | Stacked series by provider. One Nero series is a simpler chart. |
| `/tmp/t3code-upstream/apps/web/src/components/usage/UsageProviderChart.test.ts` | **ADAPT** | |
| `/tmp/t3code-upstream/apps/web/src/components/usage/UsagePage.tsx` | **ADAPT** | Window/metric UI copies; provider breakdown table follows `PROVIDER_ORDER`. |
| `/tmp/t3code-upstream/apps/web/src/components/usage/UsagePage.test.tsx` | **ADAPT** | |

Until Nero has a usage contract, **delete the `/usage` route and nav entry** rather than rendering empty Codex/Claude/Grok series.

---

## 10. Observability

| File | Verdict | Why |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/observability/clientTracing.ts` | **COPY** | Browser/Electron OTLP tracer to `/api/observability/v1/traces`. Resource `serviceName: "t3-web"` → rename to Nero’s client service. Not a harness setting. |

General → Diagnostics description is driven by `primaryServerObservabilityAtom` (`formatDiagnosticsDescription`). Keep that row; it is not provider-install.

---

## 11. Skills / slash — keep list

Keep (data from live `ServerProvider` / ServerConfig):

- `providerSkillSearch.ts` (+ test)
- `showSkillsInSlashMenu` setting + General row
- `$` skill menu and `/skill:name` items in `ChatComposer`
- Provider-supplied `slashCommands` in the `/` menu
- Markdown / timeline skill name formatting (`SkillInlineText`, `ChatMarkdown` skills prop)

Delete or gate:

- `/model` built-in if the picker is gone
- `/plan` `/default` with plan mode
- OpenCode plan-agent option descriptors
- Any UI that lists skills by driver kind instead of the snapshot

---

## 12. Suggested Nero settings IA

Sidebar (copy T3, minus Providers):

1. General  
2. Appearance  
3. Keybindings  
4. Integrations (if Nero embeds a browser)  
5. Source control  
6. Connections (if Nero keeps pairing/remote)  
7. Archive  

General diffs vs T3:

- Keep skills-in-slash.  
- Drop provider update checks.  
- Drop text-generation model picker (hardcode `nero` / GLM-5.3-Flash) **or** replace with a Nero list control later.  
- About: version string only. No channel, no Check for updates.  
- Drop Legacy features (or keep token-streaming/sidebar only if Nero still has those code paths).

Do not add a Providers page. If Baseten auth must be visible, put one row under General or a new “Nero” section: model name, endpoint health, last error.

Composer: hide model picker trigger when `models.length <= 1`; keep `modelPicker.toggle` unbound.

---

## 13. Call-site checklist (if you delete the clusters)

These import the delete-cluster and will not compile until updated. They are outside the requested folders but are the real blast radius.

| Consumer | Depends on |
|---|---|
| `routes/__root.tsx` | `ProviderUpdateLaunchNotification`, `PlanAgentSelectionHeal` |
| `components/ChatView.tsx` | `ServerUpdateAction`, `serverUpdateGuidance` |
| `components/chat/ChatComposer.tsx` | `ProviderModelPicker`, `searchProviderSkills`, `/model` |
| `components/LegacySidebar.tsx` | `isModelPickerOpen` |
| `components/sidebar/SidebarChrome.tsx` (via pills) | `SidebarProviderUpdatePill`, `SidebarUpdatePill` |
| `AppRoot` / command palette | `/settings` navigation (palette currently goes to `/settings` and `/settings/source-control`) |
| `packages/contracts` settings | `providers`, `providerInstances`, `enableProviderUpdateChecks`, `textGenerationModelSelection` defaults (`codex`) — server/schema work, not this web map |

---

## 14. Counts

Rough file verdicts in scope (settings + named modules + usage + observability + the update/picker files they force):

- **COPY:** appearance/theme, layout, keybindings editor, integrations, connections, archive, diagnostics/telemetry, client tracing, skill search, project scripts, editor preferences, most of General.  
- **ADAPT:** `SettingsPanels.tsx`, search/nav, `providerInstances.ts`, `modelSelection.ts`, picker/composer traits, source-control writer + project default model, `keybindings.ts` jump helpers, `versionSkew.ts`, usage page if kept.  
- **DELETE:** entire Providers settings subtree (wizard, cards, driver meta, models section, form), provider CLI update notifications/pills/dismissal, T3 desktop/server self-update, `providerModels.ts` kind fallback, plan-agent heal, usage `codex|claude|grok` presentation until replaced.

That is the smallest model that makes “one Nero model on Baseten” unsurprising in the web settings surface.
