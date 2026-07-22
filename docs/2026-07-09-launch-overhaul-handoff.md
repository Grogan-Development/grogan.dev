# Combined Grogan Services + ERP launch handoff

Last updated: 2026-07-09 (America/Los_Angeles)

## Resume objective

Continue the combined launch of:

- `/Users/zgrogan/Repos/grogan.dev`: the public Next.js marketing and lead-capture site.
- `/Users/zgrogan/Repos/grogan-platform`: the separate Go API/worker, SurrealDB/Redis infrastructure, generated API client, and Next.js ERP.

The business goal is an income-focused services launch for Kennewick and the Tri-Cities. Production DNS must not cut over until the public site and ERP independently pass their launch gates.

There are valuable uncommitted changes in both repositories. Do not reset, restore, clean, or overwrite either working tree. Preserve the ignored user artifacts `--selector` and `.design-audit/` in `grogan.dev`.

## Suggested skills

- `executing-plans` and `subagent-driven-development` for the remaining multi-repository plan.
- `test-driven-development` for each resumed behavior slice.
- `browser:control-in-app-browser` for the logged-in Clerk dashboard and later live-site QA.
- `use-railway` for staging topology, variables, services, deploys, and read-back verification.
- `frontend-design` for the public site and ERP; the public design context is `/Users/zgrogan/Repos/grogan.dev/.impeccable.md`.
- `systematic-debugging` for the first full-suite failures after the interrupted work is integrated.
- `verification-before-completion` before any completion claim.
- `finishing-a-development-branch` only after both repos and live staging pass acceptance.

## Locked architecture and launch decisions

- Public site stays in `grogan.dev`; the platform remains a separate `grogan-platform` repository.
- Go owns business logic and authorization decisions. TypeScript is limited to interfaces. Python is out of the launch path.
- SurrealDB is the durable source of truth; pin server `v3.1.4` and Go driver `v1.4.0` for launch.
- Redis provides rate limits, worker wakeups/short leases, and ephemeral coordination. Jobs remain authoritative in SurrealDB and workers must poll even if Redis is unavailable.
- Railway is the deployment platform: `web`, `erp`, `api`, `worker`, private `surrealdb`, private Redis, private Bucket, and backup/export job in isolated staging and production environments.
- Cloudflare remains authoritative DNS and Turnstile infrastructure only. Redis replaces Cloudflare rate-limit rules after staging proves enforcement.
- Resend remains inbound/outbound transport. Preserve all `@grogan.dev` aliases, copy inbound attachments to private object storage, and thread primarily from RFC headers.
- ERP is single-owner/admin at launch, but durable records remain owner-scoped.
- Public site and ERP launch together. AI/Nero automation is prepared through governed action interfaces but does not block launch.

### Authentication pivot

The user changed the original custom-auth requirement during implementation. Clerk now owns identity and sessions because speed and launch reliability matter more than owning password/session plumbing.

Target design:

- Next.js ERP uses `@clerk/nextjs` and sends a short-lived Clerk session JWT in `Authorization: Bearer ...` to the cross-origin Go API.
- Go verifies the bearer token with the official `github.com/clerk/clerk-sdk-go/v2` middleware/claims and maps the Clerk subject to an owner-scoped local `admin_user` record.
- SurrealDB stores the local Clerk identity link/profile and business data, not password hashes or admin sessions.
- Exact allowed-origin checks remain on unsafe ERP mutations. Custom CSRF cookies are unnecessary because the API uses an explicit bearer header rather than ambient cross-origin credentials.
- Clerk must use Restricted sign-up mode; the owner is created or invited manually. Do not expose public ERP registration.

The committed custom authentication code is now obsolete and must be deliberately removed/replaced. Do not revive the interrupted CSRF/cache-generation work; its uncommitted changes were fully removed before this handoff.

## Completed and committed

### Safety and donor review

- The formerly public unauthenticated Nero communications route was contained by removing the public Railway API domain. The old `/communications` URL returned `404` after removal. Grogan must not call Nero's deployed API or share Nero's database.
- Dirty donor repositories were preserved. No donor tree was reset or revived.
- `grogan-cloud` donor findings:
  - mailbox UI/behavior: `main@7c8f6e9ac8932844be3bb33db679eea29bac9e4e`
  - hardening: commits `ac583b0` and `52ee1b8`, branch tip `fecf4b6`
  - current Surreal work is a dirty reference atop `ea07b8e`, not code to copy wholesale
- Reuse concepts, contracts, tests, and adapters selectively. Do not copy the 1,800-line mailbox component intact or reuse the donor's table-scan/non-transactional Surreal store.

### `grogan.dev`

Current branch: `codex/grogan-dev-launch-overhaul`  
Current commit: `de8cb85a741fabd3397334171f642cd072712908`

Committed sequence from `main@407b61a`:

| Commits | Result |
| --- | --- |
| `aa07822` | Checkpointed the supplied site while preserving ignored audit artifacts. |
| `9f88640`, `fea5b53`, `61e0369` | Added Vitest/RTL, Playwright/Axe, app/test typecheck separation, and staging-selectable verification. |
| `767235d` | Deepened the Industrial Operator Studio design system and differentiated key hubs. |
| `4d99b73`, `9fd0d97`, `6eee5f1`, `3d9e5d7` | Added the photography release gate and removed generated photography from release paths. |
| `adb2925`, `931bc12`, `b55d29d`, `de8cb85` | Replaced generic showroom wireframes with truthful, distinct static/local-only previews and hardened demo interactions. |

Last known green state at committed `de8cb85`:

- 70 unit tests passed.
- app/test typecheck passed.
- lint passed.
- build passed.
- Earlier Playwright/Axe smoke checks passed locally; no staging run exists.

Do not transfer those results to the current dirty tree.

### `grogan-platform`

Current branch: `codex/combined-launch`  
Current commit: `c3d093fa22be74b728a43131fa4045da14c2aa22`  
No Git remote is configured.

Committed sequence:

| Commit | Result |
| --- | --- |
| `a6ba1da` | Created the platform workspace, Go API foundation, SurrealDB `v3.1.4`, Go driver `v1.4.0`, migrations, health/readiness, Docker/Railway files, and OpenAPI skeleton. |
| `82ccbb8` | Hardened first-boot migration ledger, runtime-vs-owner DB credentials, Railway pre-deploy migration, readiness, deterministic create semantics, endpoint validation, and env-gated migration integration tests. |
| `ef2e6e8`, `c3d093f` | Implemented custom Go/Redis auth and closed initial cache invalidation gaps. This code passed tests/race/vet but is superseded by the Clerk pivot and should be removed/replaced. |

The foundation was independently spec- and quality-reviewed before the auth pivot. Fresh checks before Task 2B started passed `go test -count=1 ./...`, `go vet ./...`, integration-tag compilation/skip, and `docker compose config -q`. Docker Desktop was not running, so no live local SurrealDB test was performed.

## Clerk state at the stop point

- The in-app browser is logged into the existing **GDG / Development** Clerk application.
- Clerk application ID: `app_39AUa6SZZKdgY1bCLFT946WINO7` (identifier, not a secret).
- Clerk CLI `2.0.0` is installed globally and authenticated; the credential value was never printed or copied.
- `clerk doctor` confirms the CLI credential is valid, but the repository is **not linked** to an application and has no pulled environment file.
- `clerk init --app app_39AUa6SZZKdgY1bCLFT946WINO7` failed to detect a framework because `apps/erp` was only a placeholder.
- A second explicit init detected/scoped the workspace incorrectly at the repository root. It installed `@clerk/nextjs` into the npm workspace, modifying `apps/erp/package.json` and creating root `package-lock.json`, then stopped at the preview prompt.
- The initializer was cancelled before it created `proxy.js`, auth routes, layout changes, `.env.local`, or any Clerk link metadata.
- No Clerk dashboard settings were changed. Restricted sign-up mode is still pending.
- Do not read or print `.env.local` after it is created. Never expose `CLERK_SECRET_KEY` to client code.

Recommended restart sequence:

1. Scaffold the Next.js 16 ERP deliberately under `apps/erp` instead of rerunning framework detection against the workspace root.
2. From `/Users/zgrogan/Repos/grogan-platform`, run `clerk link --app app_39AUa6SZZKdgY1bCLFT946WINO7`, then `clerk env pull` without displaying the file contents.
3. Follow the bundled Next.js 16 documentation before writing ERP code.
4. Put `ClerkProvider` inside `<body>`, always `await auth()`, and include `'/__clerk/:path*'` once after the API/TRPC matcher in `proxy.ts`.
5. Use the logged-in Clerk dashboard to enable Restricted sign-up mode and create/invite the first owner only after the local ERP sign-in route exists.
6. Run `clerk doctor` again and verify signed-out/sign-in/signed-in controls.

## Current uncommitted work: `grogan-platform`

Preserve this tree. `git diff --check` passed at the stopping point.

Tracked modifications:

- `.env.example`
- `Makefile`
- `apps/api/Dockerfile`
- `apps/api/internal/config/config.go`
- `apps/api/internal/config/config_test.go`
- `apps/api/internal/db/surreal/client.go`
- `apps/api/internal/db/surreal/client_test.go`
- `apps/api/internal/httpserver/handler.go`
- `apps/api/migrations/schema_test.go`
- `apps/erp/package.json` (Clerk CLI install side effect)

New files/directories:

- `apps/api/cmd/worker/`
- `apps/api/internal/httpserver/clientip.go`
- `apps/api/internal/httpserver/clientip_test.go`
- `apps/api/internal/httpserver/leads.go`
- `apps/api/internal/httpserver/leads_test.go`
- `apps/api/internal/jobs/`
- `apps/api/internal/leads/`
- `apps/api/internal/turnstile/`
- `apps/api/migrations/0003_leads_and_jobs.surql`
- `infra/railway/worker/`
- root `package-lock.json` (Clerk CLI install side effect)

Implemented but uncommitted:

- Non-retrying, result-returning Surreal mutation seam.
- Immutable `0003_leads_and_jobs.surql` with owner-scoped leads/jobs.
- Lead validation, deterministic idempotency, transactional repository, and Redis/local shadow limiter.
- Work-job state machine with lease fencing, retry/dead/uncertain states.
- Turnstile verifier with local/test no-op behavior.
- Trusted-proxy-aware client-IP extraction.
- Public/protected lead, contact, and job-operation handlers.
- Lead/worker configuration and Surreal-authoritative polling worker.
- Worker handler registry is intentionally empty; email notification jobs must remain queued until real Resend handlers exist.

Focused packages passed before interruption:

- `go test ./internal/db/surreal`
- `go test ./migrations`
- `go test ./internal/leads`
- `go test ./internal/jobs`
- `go test ./internal/turnstile`
- `go test ./internal/config`
- `go test ./internal/httpserver`

Known gaps:

- `cmd/api` does not construct/wire the lead repository, limiter gate, Turnstile, trusted proxy resolver, job lister, or Clerk principal resolver. Routes are not live.
- Protected route interfaces are principal-based and ready for a Clerk-resolved local owner, but Clerk verification is not implemented.
- OpenAPI and README are stale.
- No final full test/race/vet/Docker/worker compilation pass has run.
- Real SurrealDB `v3.1.4` integration tests for atomic rollback, concurrent contact/idempotency, claim races, fencing, and expired recovery are still missing.
- The uncommitted migration/job SurrealQL has not run against a real SurrealDB `v3.1.4` service.
- Custom auth packages, `/v1/auth/*`, admin password/session commands, Redis login limiter, and obsolete schema remain committed and await the Clerk replacement.

Safest continuation:

1. Preserve the Task 2B tree.
2. Implement the Clerk identity projection and Go bearer verification without discarding the owner-scoped lead/job work.
3. Add a new migration after `0003` for `clerk_user_id`, local owner linkage, and cleanup of custom session/password fields; keep prior numbered migrations immutable.
4. Repurpose the admin CLI to link/bootstrap a Clerk user instead of creating passwords.
5. Wire `cmd/api`, update OpenAPI/docs, then run focused compilation before real Surreal integration coverage.

## Current uncommitted work: `grogan.dev`

Preserve this tree. `git diff --check` passed at the stopping point.

Tracked modifications:

- `app/about/page.tsx`
- `app/case-studies/page.tsx`
- `app/contact/page.tsx`
- `app/examples/page.tsx`
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
- existing photography/example tests listed by `git status`

New work includes:

- `app/privacy/`, `app/terms/`
- `docs/photography-provenance.md`, `docs/production-gates.md`
- `lib/intake.ts`
- `public/photography/`
- `scripts/build-photography.mjs`
- new funnel, image, schema, policy, About, contact, and workflow-audit tests listed by `git status`

Implemented but uncommitted:

- Nine real Wikimedia Commons derivatives for the Tri-Cities/Columbia Basin, including Pasco railroad bridge, Blue Bridge, downtown Kennewick, Hanford/manufacturing, Red Mountain winery, local service/renovation, Richland office, and OG image.
- Reproducible photo builder and repository provenance metadata.
- Released image manifest and local homepage photograph.
- Example previews labeled honestly as “Illustrative product preview.”
- Initial About/Examples locality and truthfulness copy.
- Draft privacy/terms, sitemap/canonical/schema/CTA/trust work from the interrupted funnel slice.

Last passing focused tests in the dirty tree:

- photography manifest/release/provenance: 15 tests
- example preview/showroom copy: 13 tests
- homepage local proof/funnel CTA/preview checks: 14 tests
- About local-scene: 1 test

Critical gaps:

- `IntakeForm.tsx` and `lib/intake.ts` are unfinished and do not match the stable Go `leads.Input` contract.
- The form still posts to `/api/contact`.
- `app/api/contact/route.ts` still exists and logs/discards PII. This is launch-blocking.
- Direct Go submission, generated `Idempotency-Key`, Turnstile token, accessible API errors, and Plausible conversion events remain unfinished.
- Wikimedia attribution exists in repository docs but still needs a publicly discoverable attribution surface.
- No full `npm test`, lint, typecheck, build, or Playwright pass ran after these accumulated changes.
- The dev server showed transient 404s while assets were being created and one transient `HeroCollage is not defined` Fast Refresh error. Current source no longer references `HeroCollage`, but only a clean full build can close this.
- Automated in-app Browser access to `localhost` was rejected by Browser URL policy. Do not bypass that restriction; use code/test QA and user-visible/manual local review until the policy surface allows it.

Safest continuation:

1. Reconcile the form exactly to the Go input shape (`businessName`, `biggestProblem`, `needType`, `budgetRange`, `contactName`, `email`, `formType`, optional bounded detail fields, and `turnstileToken`).
2. Post directly to `${NEXT_PUBLIC_API_BASE_URL}/v1/public/leads` with a generated `Idempotency-Key`.
3. Delete the unsafe Next.js contact route and add request/error/accessibility tests.
4. Add Plausible/Turnstile completion and public photo attribution.
5. Run the entire unit/type/lint/build/Playwright/Axe suite before splitting the dirty slice into logical commits and review gates.

## Remaining product sequence

1. Finish Clerk replacement, Task 2B Go wiring, OpenAPI, and live Surreal/Redis integration tests.
2. Finish direct public lead submission and verify a real staging lead appears in SurrealDB/ERP with audit/jobs.
3. Scaffold Clerk-protected ERP routes: dashboard, leads, contacts, inbox, settings, operations.
4. Implement Resend/Svix transactional webhook ingestion, attachment copying to Railway Bucket, RFC threading, drafts/send/labels/bulk actions, delivery events, retries, uncertain sends, SSE, and failed-job recovery.
5. Decompose and adapt the mature `grogan-cloud` mailbox UI with sandboxed HTML, blocked remote images, and authenticated attachment access.
6. Provision Railway staging only after the code slices are reviewed: API, worker, ERP, SurrealDB volume, Redis, Bucket, backups/export.
7. Run live staging acceptance: lead capture, multi-alias inbound mail, bidirectional reply/threading, replay/reordered webhooks, Redis loss, restore drill, accessibility, responsive behavior, LCP, and CLS.
8. Perform one combined production cutover only after both the public site and ERP independently pass.

## Railway, DNS, and external state

- Railway CLI was authenticated earlier in the session.
- No `grogan-dev` Railway project/environment was provisioned yet.
- Existing projects were left untouched except the Nero public-domain containment described above.
- Cloudflare DNS, current Resend MX/receiving, Turnstile, and production domains were not changed.
- No production or staging deployment occurred.
- No Git remote, push, PR, or merge was created for `grogan-platform`.

## Stop-state verification

- Both repository working trees are dirty by design and preserved.
- `git diff --check` passes in both repositories.
- The `grogan.dev` Next.js development server was stopped.
- Clerk `init` and auth processes were stopped; CLI authentication remains in the host credential store.
- No Go API/worker process was started for this project.
- An unrelated existing Nero process was observed and deliberately left running.

Do not claim either current dirty tree is fully green or launch-ready until the continuation steps and full verification suites above are complete.
