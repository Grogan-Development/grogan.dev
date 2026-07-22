# Grogan.dev stopping handoff

Last updated: 2026-07-10 (America/Los_Angeles)

This document supersedes `docs/2026-07-09-launch-overhaul-handoff.md`. The July 9 document remains useful historical context, but parts of its platform and Railway status are now stale. Use this document as the current stopping point.

## How to use this handoff

Implementation stopped at this checkpoint. This document is intended to let the next operator understand the product vision, preserve the current work safely, and resume from the recommended phase when authorized.

No further application, platform, Railway, DNS, deployment, Clerk-dashboard, Turnstile, or Resend work was performed during the stopping sequence. Both repositories remain intentionally dirty. Do not run `git reset`, `git clean`, `git restore`, bulk checkout, or otherwise overwrite inherited work.

In `grogan.dev`, preserve the ignored user artifacts `--selector` and `.design-audit/`.

The July 9 handoff records useful historical architecture and planning context. Where it conflicts with this document's current implementation or Railway state, this document wins.

## Executive summary: what is being built

Grogan Development Group is building an income-generating local software-services business for Kennewick, the Tri-Cities, and surrounding areas. The goal is not merely to publish a polished brochure site. The goal is to establish a small, truthful, secure, and operable path from public discovery to a real business relationship.

The system has two connected parts:

- **`grogan.dev`** is the public acquisition, trust, and lead-capture experience. It explains the offer, demonstrates credible capabilities, answers fit and pricing questions, and converts qualified visitors into persisted inquiries.
- **`grogan-platform`** is the private operational backbone. It contains the Go API, durable SurrealDB records, Redis-backed work coordination, Clerk-protected owner access, the ERP lead workflow, workers, and eventually the shared services mailbox and recovery tooling.

The intended first launch is a focused lead-to-operations vertical slice:

1. a qualified prospect discovers Grogan and understands the offer;
2. the prospect submits a fit check, direct inquiry, or workflow-audit request;
3. the submission is validated, rate-limited, made idempotent, assigned to the owner by the server, and persisted in SurrealDB;
4. the owner signs into a private ERP with Clerk and sees the lead;
5. the owner reviews the contact and intake details, updates status or notes, and follows up;
6. durable jobs coordinate acknowledgements, notifications, retries, and later mailbox work; and
7. the complete path is proven in private staging before production services or DNS are changed.

Revenue generation, trustworthiness, accessibility, recoverability, and launchability take priority over speculative SaaS breadth or premature automation.

## Product vision and business goals

Grogan Development Group should be presented as a credible local provider of:

- custom business software;
- workflow automation;
- dashboards and internal tools;
- customer or employee portals;
- mobile applications; and
- practical AI-assisted solutions where they produce a clear business benefit.

The product should accomplish four business goals:

1. **Build trust.** Local prospects should understand who is behind the company, what problems it solves, how engagements work, what example systems look like, and whether the service is likely to fit their budget and needs.
2. **Capture real demand.** Fit checks, inquiries, and workflow-audit requests must become durable leads. A success message must mean the lead was actually accepted, not merely logged or discarded.
3. **Give the owner an operating system.** The owner needs a secure, minimal place to review leads, contacts, work status, follow-up notes, and eventually customer email.
4. **Support reliable operations.** Background work, mail, retries, failures, audits, backups, and restore procedures must remain observable and recoverable.

The platform is not intended to become a generalized multi-tenant SaaS product for the initial launch. It is an owner-operated services system designed to help Grogan win and serve customers.

## Target users and core journeys

### Public prospect journey

1. A Tri-Cities business owner or operator arrives from search, referral, social media, or a direct recommendation.
2. They quickly understand the offer and the business problems Grogan can solve.
3. They evaluate local credibility, founder information, examples, process, fit, and price guidance.
4. They choose a fit check, direct inquiry, or workflow audit.
5. They submit only the information needed for that journey.
6. They receive accessible, truthful success or failure feedback.
7. Their submission is persisted exactly once under retry and becomes visible to the owner.

### Owner/operator journey

1. The owner signs into the private ERP through Clerk.
2. The browser sends a short-lived Clerk bearer JWT to the Go API.
3. The API verifies the token and requires an explicit local owner link; Clerk authentication alone does not grant application access.
4. The owner sees a list of persisted leads and opens lead details.
5. The owner reviews contact and intake data, changes lead status, and records notes or follow-up decisions.
6. The owner can inspect related work and failures instead of relying on hidden background behavior.

### Customer communication journey

1. A prospect or customer emails a Grogan alias.
2. The message and attachments are ingested, preserved, and associated with the correct mailbox and thread.
3. The owner reads and replies from the ERP.
4. Delivery events, retries, uncertain outcomes, and failures remain visible and auditable.
5. Messages and attachments remain recoverable even when ephemeral coordination services fail.

### Operator and recovery journey

1. The operator can inspect queued, running, retrying, dead, or uncertain work.
2. Safe failures can be retried without duplicating durable business actions.
3. Workers continue to recover authoritative work from SurrealDB even if Redis notifications are lost.
4. Backups are produced, monitored, and proven through a restore drill.
5. Production changes are made only after the same behavior passes in isolated private staging.

## What the finished system is supposed to be

The intended launch system consists of:

- a public Next.js website at `grogan.dev` focused on local trust, services, examples, process, pricing/fit guidance, accessibility, SEO, and lead conversion;
- direct public submission from the browser to the Go API, with no fake Next.js relay and no PII logging as a substitute for persistence;
- server-controlled lead ownership, with no owner identity selected or supplied by the browser;
- a Go API that owns validation, Turnstile verification, client-IP policy, rate limiting, idempotency, authorization, persistence, and work orchestration;
- SurrealDB as the durable source of truth for local owners, Clerk links, leads, contacts, jobs, mail, audit records, and operational state;
- Redis for ephemeral rate limits, worker wakeups, short leases, and coordination—not as durable business storage;
- Clerk for browser identity and session management, combined with an explicit local owner projection for authorization;
- a minimal Clerk-protected ERP that initially provides lead list, lead detail, status, notes, contacts, and operational visibility;
- workers for acknowledgements, internal notifications, mailbox processing, retries, lease recovery, and later governed automation;
- Resend-backed inbound and outbound email with RFC-aware threading, attachments in private object storage, delivery events, retries, and failure handling;
- private Railway staging containing the API, worker, ERP, SurrealDB, Redis, object storage, and backup/export functions before production cutover; and
- monitored production services released only after staging acceptance and explicit approval of DNS, domains, Turnstile, Clerk, and Resend changes.

## Architecture and responsibility boundaries

| Layer | Intended responsibility |
| --- | --- |
| `grogan.dev` | Public marketing, SEO, accessibility, visual proof, form UX, and truthful user feedback. It must not decide ownership or authorization. |
| Go API | Validation, Turnstile, rate limits, trusted client IPs, idempotency, server-assigned ownership, persistence, authorization, and work orchestration. |
| SurrealDB | Durable owners, Clerk links, leads, contacts, jobs, mail, audit events, and recovery state. |
| Redis | Ephemeral rate limits, wakeups, coordination, and short-lived leases after platform readiness is accepted. |
| Clerk | Authentication and browser sessions. Clerk does not automatically create or authorize local owners. |
| ERP | Private Clerk-protected interface for owner-managed leads, contacts, operations, and later mailbox work. |
| Worker | Polls durable jobs, executes bounded handlers, records outcomes, retries safe work, and surfaces uncertain or dead work. |
| Resend and object storage | Email transport plus durable private attachment copies; provider state does not replace platform records. |
| Railway staging | Private, isolated proof environment used before any production cutover. |

### Non-negotiable boundaries

- Go owns business rules and authorization decisions.
- Browser applications are interfaces; they do not select lead ownership or receive database credentials.
- Public intake is unauthenticated because it is a prospect-facing entry point, but it is protected by exact-origin policy, validation, Turnstile, rate limiting, and idempotency.
- ERP routes require verified Clerk bearer tokens plus an explicit enabled local owner link.
- Invalid, missing, unlinked, or inactive identity is denied. Identity dependency or integrity failures fail closed rather than degrading into access.
- SurrealDB remains authoritative. Redis loss must not erase leads, jobs, mail, or recovery state.
- Request-time authentication must never auto-provision a local owner.

## Original launch plan and major workstreams

### 1. Public trust and conversion site

**Intended outcome:** A credible local services site that helps qualified businesses understand Grogan, assess fit, and choose a clear next step.

**Current state:** Substantial design, copy, local positioning, photography, SEO, legal-route, CTA, example, and accessibility work exists in the dirty tree. The detailed implementation state appears later in this document.

**Remaining work:** Reconcile photography attribution and production claims, verify all routes and responsive states, complete performance and accessibility acceptance, and connect the form to real persistence.

**Acceptance criteria:** No placeholder claims; truthful examples and attribution; keyboard and screen-reader usability; responsive behavior; acceptable LCP/CLS; all conversion paths lead to working, truthful actions.

### 2. Public lead vertical slice

**Intended outcome:** A prospect submission becomes exactly one durable owner-scoped lead and related work, even across retries.

**Current state:** The platform exposes a public lead route locally, but `grogan.dev` still sends an incompatible payload to the unsafe `/api/contact` route.

**Remaining work:** Define the exact typed mapping, generate an idempotency key, add Turnstile, post directly to the approved API origin, remove `/api/contact`, and prove persistence and failure handling in staging.

**Acceptance criteria:** No PII logging or false success; browser sends no owner; retry does not duplicate a lead; errors are accessible and truthful; the persisted lead appears in the owner workflow.

### 3. Clerk identity and local owner projection

**Intended outcome:** Clerk authenticates the owner while the Go API authorizes access only through an explicit local owner link.

**Current state:** Substantial JWT/JWKS verification, owner projection, API composition, strict bearer parsing, CORS, migration, and link-command work exists locally in `grogan-platform`.

**Remaining work:** Reconcile the interrupted real-integration test, establish a reviewed first-owner seed procedure, apply migration `0004` in a disposable/private environment, and link a real Clerk subject.

**Acceptance criteria:** Legacy `/v1/auth/*` is absent from production composition; linked owner access succeeds; invalid or unlinked identity is denied; dependency and integrity failures fail closed; no request-time auto-provisioning occurs.

### 4. Minimal ERP lead workflow

**Intended outcome:** The owner can securely review and act on captured demand.

**Current state:** Clerk dependencies and platform APIs exist in part, but the tracked ERP remains incomplete and is not a proven staging application.

**Remaining work:** Scaffold the Next.js ERP deliberately, configure Clerk safely, forward bearer tokens, build lead list/detail, status and notes, contacts, and operations views, then deploy privately.

**Acceptance criteria:** Signed-out users cannot access owner data; the linked owner can list, inspect, and update only owner-scoped records; all loading, empty, error, and unauthorized states are usable.

### 5. Mailbox and worker operations

**Intended outcome:** Grogan can receive, organize, answer, and recover customer communication from the ERP.

**Current state:** Durable job concepts and worker foundations exist, but real mailbox ingestion, storage, replies, and recovery remain incomplete.

**Remaining work:** Implement verified inbound webhooks, alias routing, RFC threading, attachment copying, outbound sending, delivery events, idempotency, retries, uncertain-send handling, failed-job tools, and private attachment access.

**Acceptance criteria:** Real mail can be received, threaded, displayed, replied to, retried, and audited; reordered or replayed webhooks do not corrupt state; unsafe duplicate sends are prevented or surfaced as uncertain.

### 6. Infrastructure, backups, observability, and recovery

**Intended outcome:** The launch can be operated and restored rather than merely deployed.

**Current state:** An isolated Railway project and private persistent SurrealDB staging service exist. The full service topology and recovery path do not.

**Remaining work:** Safe first-owner setup, forward migrations, Redis, private API/worker/ERP services, object storage, backup/export jobs, monitoring, logs without sensitive payloads, and a restore drill.

**Acceptance criteria:** No public database endpoint; least-privilege runtime access; durable backups; demonstrated restore; observable failed jobs and provider events; Redis loss does not lose authoritative work.

### 7. Staging acceptance and production cutover

**Intended outcome:** The complete customer journey is proven privately before any public infrastructure is changed.

**Current state:** Full staging acceptance has not occurred. Production DNS, domains, Turnstile, and Resend routing remain outside the accepted slice.

**Remaining work:** Execute end-to-end lead, ERP, mailbox, failure, accessibility, performance, backup, and restore scenarios; resolve findings; obtain explicit approval for production changes.

**Acceptance criteria:** Every launch criterion below passes in private staging, then a monitored production release is performed with rollback and recovery procedures ready.

## Phased roadmap

### Phase 0 — Preserve and stabilize

- Preserve both dirty trees and ignored user artifacts.
- Reconcile the interrupted platform integration test.
- Run serial verification rather than relying on parallel or stale results.
- Confirm architectural decisions and unresolved product mappings before adding code.

### Phase 1 — Platform foundation

- Establish a safe first-owner seed procedure outside request-time authentication.
- Apply forward migrations to disposable and private staging databases.
- Link a real Clerk subject to the enabled local owner.
- Prove owner resolution, readiness, persistence, and database privilege boundaries.
- Resolve the production SurrealDB ownership and privilege-drop strategy.

### Phase 2 — Lead-to-ERP vertical slice

- Provision Redis only after identity and database readiness are accepted.
- Deploy the private API and worker.
- Scaffold and deploy the Clerk-protected ERP lead list/detail workflow.
- Map and wire `grogan.dev` directly to public Go intake.
- Prove public submission → durable lead/contact/jobs → ERP retrieval and update.

### Phase 3 — Mailbox operations

- Implement inbound ingestion, threading, attachment storage, outbound replies, delivery events, retries, and recovery tools.
- Add operator views for queued, retrying, dead, and uncertain jobs.
- Preserve all intended `@grogan.dev` aliases and verify actual routing behavior.

### Phase 4 — Full staging acceptance

- Test idempotency, replay, rate limiting, unauthorized access, dependency failure, Redis loss, worker recovery, webhook reordering, duplicate delivery, and uncertain sends.
- Run Playwright, Axe, responsive, keyboard, screen-reader, LCP, and CLS checks.
- Run backup/export monitoring and a documented restore drill.
- Resolve every launch-blocking finding.

### Phase 5 — Production cutover

- Obtain explicit approval for production domains, DNS, Clerk, Turnstile, and Resend changes.
- Apply reviewed production configuration without exposing private services.
- Release the public site and private operational system together.
- Monitor lead intake, auth, jobs, mail, errors, and backups.
- Retain a tested rollback and recovery path.

## Definition of launch-ready

The combined system is launch-ready only when all of the following are demonstrated in private staging:

- A real public form submission creates exactly one durable lead per idempotency key.
- No PII is logged or discarded as a substitute for persistence.
- Public success and failure states are truthful and accessible.
- The browser cannot select an owner or access privileged credentials.
- The server assigns the configured owner and persists owner-scoped records.
- No legacy password/cookie API authentication is deployed.
- A Clerk subject gains access only after explicit local owner linking.
- Invalid, missing, unlinked, or inactive identity is denied; identity dependency or integrity failure fails closed.
- The linked owner can see the submitted lead, inspect its contact/intake details, and update status or notes in the ERP.
- Required jobs are durable, observable, retryable where safe, and recoverable after Redis loss.
- Customer email can be received, threaded, viewed, replied to, retried, and audited without losing attachments.
- Backups are monitored and a restore has been demonstrated.
- Accessibility, responsive behavior, loading/error/empty states, LCP, and CLS meet the agreed release gate.
- Staging remains private and isolated.
- Production DNS, domains, Turnstile, Clerk settings, and Resend routing remain unchanged until explicit approval.

## Explicit non-goals and guardrails

- No generalized multi-tenant SaaS platform for the initial launch.
- No request-time local-owner auto-provisioning.
- No browser-selected owner or client-side authorization decision.
- No production deployment of the current PII-logging `/api/contact` route.
- No production legacy password/session API routes.
- No Redis as durable business storage.
- No public SurrealDB endpoint or TCP proxy.
- No rewriting an already-applied migration; forward-only migrations are required after application.
- No mutation of unrelated Railway projects or resources.
- No production cutover before private staging acceptance.
- No unverified phone, GBP URL, address, photography attribution, founder attribution, legal claim, or business claim.
- No secrets, tokens, passwords, private hosts, or connection strings in source, logs, screenshots, or handoff documents.
- No claim that either current dirty tree is launch-ready merely because focused or earlier tests passed.

## Decision log and unresolved questions

The next operator should resolve these deliberately rather than embedding assumptions in code:

1. **First-owner seed:** What privileged, auditable procedure creates the first enabled local owner in an empty database while keeping request-time authentication non-provisioning?
2. **Public form mapping:** How should `desiredOutcome`, `needType`, short contact-form defaults, `phone`, and intent-specific fields map to the Go contract?
3. **Public API origin:** What exact staging and production origins should `grogan.dev` call, and how are they configured without hard-coded private endpoints?
4. **Turnstile policy:** Which forms and environments require a token, and how should unavailable or failed verification be communicated?
5. **SurrealDB production privileges:** What startup mechanism repairs `/data` ownership and drops privileges instead of retaining the staging root-runtime exception?
6. **Mailbox routing:** Which aliases must be preserved, and what are the authoritative Resend inbound routes and threading expectations?
7. **Public claims:** Which phone number, GBP URL, legal copy, photography attribution, and local-business claims have been verified for production?
8. **Automation boundary:** Which later AI-assisted actions are safe to expose through governed job/action interfaces after the human-operated launch works reliably?

## Next operator's first day

1. Read this document and the July 9 historical handoff.
2. Run `git status --short` in both repositories and preserve all dirty and ignored work.
3. Inspect the interrupted platform integration edit before changing anything else.
4. Run the smallest focused test needed to understand that edit, repair it, then run the platform's serial verification gate.
5. Confirm the first-owner and public-form mapping decisions with the project owner before implementation.
6. Resume at **Phase 1 — Platform foundation**, not at production deployment.
7. Do not touch production DNS, domains, Clerk settings, Turnstile, or Resend routing on the first day.

## Current `grogan.dev` state

- Repository: `/Users/zgrogan/Repos/grogan.dev`
- Branch: `codex/grogan-dev-launch-overhaul`
- The working tree contains substantial inherited and uncommitted work.
- No local development server is confirmed running.
- No production or staging deployment was performed from this repository during the stopping sequence.

Tracked modifications at the stopping point:

- `app/about/page.tsx`
- `app/case-studies/page.tsx`
- `app/contact/page.tsx`
- `app/examples/page.tsx`
- `app/layout.tsx`
- `app/page.tsx`
- `app/process/page.tsx`
- `app/sitemap.ts`
- `app/workflow-audit/page.tsx`
- `components/examples/ExamplePreview.tsx`
- `components/forms/IntakeForm.tsx`
- `components/home/HomePage.tsx`
- `components/layout/SiteFooter.tsx`
- `components/seo/JsonLd.tsx`
- `lib/images.ts`
- `lib/site.ts`
- `tests/components/example-preview.test.tsx`
- `tests/components/image-placeholder-release-gate.test.tsx`
- `tests/components/site-image-manifest.test.ts`
- `tests/setup.ts`

Untracked work at the stopping point:

- `app/privacy/`
- `app/terms/`
- `docs/2026-07-09-launch-overhaul-handoff.md`
- `docs/photography-provenance.md`
- `docs/production-gates.md`
- `lib/intake.ts`
- `public/photography/`
- `scripts/`
- `tests/components/funnel-cta.test.tsx`
- `tests/components/home-local-proof.test.tsx`
- `tests/components/intake-form.test.tsx`
- `tests/components/local-business-schema.test.ts`
- `tests/components/photography-provenance.test.ts`
- `tests/lib/intake.test.ts`
- `tests/lib/site.test.ts`
- `tests/routes/about-founder.test.tsx`
- `tests/routes/about-local-scene.test.tsx`
- `tests/routes/contact-page.test.tsx`
- `tests/routes/examples-copy.test.tsx`
- `tests/routes/policy-pages.test.tsx`
- `tests/routes/trust-seo.test.ts`
- `tests/routes/workflow-audit-page.test.tsx`
- this stopping handoff

The latest reported full public-site checkpoint passed 93 unit tests, lint, application typecheck, test typecheck, production build, and `git diff --check`. That checkpoint predates this handoff and must not be treated as proof that the entire current dirty tree is still green. No full test suite was rerun at stop time.

Before doing anything else, the next operator must run `git status --short` and preserve everything they find.

## Completed or present public-site work

The dirty tree contains completed or partially completed work in these areas:

- Canonical metadata, sitemap, SEO, and JSON-LD improvements.
- Kennewick/Tri-Cities positioning and truthful founder attribution.
- Marketing-page revisions across the homepage, About, Process, Contact, Workflow Audit, Examples, Case Studies, footer, and navigation/funnel surfaces.
- Privacy and terms routes.
- CTA and funnel-oriented tests and copy changes.
- More truthful example-preview labeling and interactions.
- Intake intent definitions, required-field validation, field-level errors, submitting state, success focus, live-region messaging, and related tests.
- Local photography, image manifest, provenance documentation, reproducible image tooling, and release-gate tests.
- Named Next font mocks and affected tests were repaired in the previously reported green checkpoint.

`LocalBusiness` JSON-LD is deliberately gated behind verified production values for:

- `NEXT_PUBLIC_LOCAL_BUSINESS_PHONE`
- `NEXT_PUBLIC_GOOGLE_BUSINESS_PROFILE_URL`

Do not add placeholder phone numbers, Google Business Profile URLs, addresses, attribution, or business claims.

## Critical launch blocker: unsafe intake endpoint

`app/api/contact/route.ts` is not a real intake implementation. It currently:

1. parses the complete request body;
2. logs the complete submission, including PII, to server logs;
3. does not persist or forward the lead; and
4. returns `{ "ok": true }`, creating false success.

It must not be deployed.

`components/forms/IntakeForm.tsx` still posts to `/api/contact`. Its current field names and payload do not match the Go API's public lead contract. Current UI names include `biggestWorkflowProblem`, `desiredOutcome`, and `budget`; these require an explicit typed mapping.

The browser must never choose or submit a local owner. Owner assignment is server-controlled by the Go API through its configured `LEAD_OWNER_ID`.

## Required public form contract

The intended target is:

- `POST /v1/public/leads`
- direct, non-credentialed cross-origin submission to an approved public API origin;
- an `Idempotency-Key` request header;
- Turnstile according to the environment's approved policy; and
- no owner field in the browser payload.

The current Go input contract contains:

- `businessName`
- `website`
- `industry`
- `timeline`
- `biggestProblem`
- `currentTools`
- `thingsLost`
- `approximateUsers`
- `customerAccess`
- `fileUploads`
- `integrationsNeeded`
- `needType`
- `budgetRange`
- `contactName`
- `email`
- `formType`
- `turnstileToken`

Required mapping decisions include:

- `biggestWorkflowProblem` → `biggestProblem`
- `budget` → `budgetRange`
- `desiredOutcome` → a deliberately chosen `needType` value or a reviewed API extension
- UI intent → allowed `formType` (`contact` or `workflow-audit`)
- handling or removal of UI-only fields such as `phone`
- explicit defaults for required API fields when the short contact form does not collect them

Do not silently invent semantics. Add typed mapping tests first. Preserve accessible field errors, focus management, submitting state, success announcement, and useful failure messaging.

After direct API submission is covered by tests and private-staging acceptance, delete `app/api/contact/route.ts`.

## Relevant platform dependency status

The separate platform repository is `/Users/zgrogan/Repos/grogan-platform`. Do not infer its current state from the July 9 handoff.

Known current platform status at this stop:

- An isolated Railway project and private staging environment now exist; the old handoff's statement that they were not provisioned is obsolete.
- Only a private persistent SurrealDB service is confirmed deployed.
- Redis and application services are not confirmed deployed.
- Clerk JWT verification, explicit local-owner projection, API composition, public intake registration, strict bearer parsing, route-scoped CORS, and related local tests have substantial implementation.
- Production API composition does not expose legacy `/v1/auth/*` routes.
- Migration `0004` is owner-link-only and defines lifetime one-to-one Clerk-subject/local-owner links. It has no bootstrap or revocation model.
- The privileged `admin link-clerk` command requires an already-existing enabled local owner. It does not auto-provision one.
- First-owner creation, live migration application, and real owner linking remain `platform-foundation` blockers.
- Railway was not changed during this stopping sequence.

### Interrupted platform edit

The latest platform-side edit added an integration-only owner-link roundtrip to:

- `apps/api/internal/migrate/integration_test.go`

That edit was not compiled or verified. It calls `errors.Is` and likely needs an `errors` import. Do not claim `grogan-platform` is fully green until that interrupted edit is reconciled and the full serial platform gate is rerun.

Before that unverified edit, focused Clerk identity, admin, API composition, migration, race, vet, and command-build gates had passed. Those earlier results do not validate the current post-edit tree.

A verified recovery archive exists at:

- `/tmp/grogan-platform-clerk-stabilization-20260710.tar.gz`
- SHA-256: `3df5be7ef26a0a7e8777bb9f08fdb32516f7b692203c363b2b3b3ebb5487d689`

Do not place credentials, tokens, passwords, private hostnames, or connection strings in documentation or logs.

## Recommended continuation order

1. Reconcile and verify the interrupted platform integration test.
2. Implement and review a safe first-owner seed procedure; do not add request-time auto-provisioning.
3. Apply forward migrations to a disposable or private staging database and verify owner link/resolve behavior.
4. Provision Redis only after the platform identity boundary is accepted.
5. Establish and document the approved public API origin for `grogan.dev`; never hard-code credentials or private endpoints.
6. Add RED tests for direct public submission, idempotency, API errors, Turnstile behavior, and exact field mapping.
7. Add a typed mapper and wire `IntakeForm` directly to `POST /v1/public/leads`.
8. Remove `/api/contact` and assert that no false success or PII logging remains.
9. Run the public repository's serial gate: `npm run check`, `npm run build`, applicable Playwright/Axe suites, and `git diff --check`.
10. Perform private-staging end-to-end acceptance from public form through persistence and owner-protected retrieval.
11. Only then consider production deployment, DNS, Turnstile, Clerk, or Resend changes.

## Public-site production gates

Do not release until all of the following are true:

- The PII-logging `/api/contact` sink is gone.
- Public intake persists a real lead and never returns false success.
- The browser payload matches the reviewed Go contract and contains no owner identity.
- Photography provenance, manifest entries, shipped files, and public attribution are reconciled.
- Phone, GBP URL, attribution, legal copy, and business claims are verified rather than placeholders.
- Keyboard navigation, focus behavior, screen-reader errors/status, reduced motion, responsive layouts, and mobile interaction are verified.
- Loading, failure, retry, duplicate submission, and offline/network-error behavior are verified.
- Playwright and Axe pass on the intended staging target.
- LCP and CLS are measured on representative production-like pages.
- Private staging passes public lead creation, persistence, protected retrieval, and operational recovery checks.

Do not alter production DNS, Turnstile, Clerk settings, Resend routing, or production domains without explicit approval.

## Stop-state verification

This handoff was created as a stopping artifact only. No application code, tests, platform code, Railway resources, or external services were changed as part of producing it. No full suite was rerun. Work is stopped pending a new explicit instruction.
