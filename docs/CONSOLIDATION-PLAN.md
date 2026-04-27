# Remote Falcon Consolidation & Test Hardening Plan

**Created:** 2026-04-26
**Owner:** Matt Shorts
**Status:** Phase 0 complete (2026-04-27) — Phase A pending

**Goal:** Move from 8 service repos with no test gating to 1 monorepo with 5 services, where every release runs through unit → integration → contract → e2e tests before reaching prod.

**Total effort:** ~8 weeks of focused work, broken into 5 phases. Each phase ships a working stack and is independently reversible.

**Non-goals (explicitly out of scope):**
- Language rewrites
- Touching the customer-facing repos (`plugin`, `viewer-page-js`, `page-templates`, `mobile`, `deployment-wizard`) — they keep their independent release model
- Migrating clusters, changing ingress hosts, or rotating secrets

---

## Progress tracker

| Phase | Status | Started | Completed | Notes |
|---|---|---|---|---|
| 0: Pre-work | ✅ Complete | 2026-04-27 | 2026-04-27 | Tags pushed to all 10 repos; baseline captured; `developer-files` migration risk surfaced |
| A: Monorepo cutover | 🚧 In progress | 2026-04-27 | | A1 (subtree-merge) ✓; A2 (JitPack→local module) ✓; A3 (ops/ + platform/core split) ✓; A4–A7 pending |
| B: Unified CI | ☐ Not started | | | |
| C: Test pyramid | ☐ Not started | | | |
| D: Service merges | ☐ Not started | | | |
| E: Optional follow-ups | ☐ Not started | | | |

---

## Phase 0 — Pre-work *(half a day)*

Reversibility safety net before any structural change.

- [x] **0.1** Snapshot every repo. Tag `pre-monorepo-2026-04-27` pushed to all 10 in-scope repos (`ui`, `gateway`, `control-panel`, `viewer`, `plugins-api`, `external-api`, `mongo-backup`, `account-archive`, `library`, `data`).
- [x] **0.2** Capture cluster baseline. Saved to [`baseline-2026-04-27/`](baseline-2026-04-27/): `cluster-all.yaml` (5,348 lines), `secrets.yaml` (base64-encoded; **sensitive — move to password manager and delete from disk**), `configmaps.yaml`, `ingress.yaml`, `servicemonitors.yaml`.
- [x] **0.3** Repo strategy decided: fresh `remote-falcon-platform` repo in the `Remote-Falcon` GitHub org. Existing 8 service repos + library + data stay archived (read-only) for history reference.
- [x] **0.4** Adjacent dev tooling inventory complete:
  - `remote-falcon-load-tests/` — references services by **URL paths** (`/remote-falcon-viewer/graphql`), which stay stable across consolidation. ✓ No action needed. (One stale machine-specific path in `viewer/build-and-deploy.sh` (`/d/Development/...`) — cosmetic, separate cleanup.)
  - `developer-files/` — **⚠ migration risk found.** Both `do-ubuntu-droplet/docker-compose.yaml` and `local-docker-compose/docker-compose.yaml` build images directly from the source repo URLs (`context: https://github.com/Remote-Falcon/remote-falcon-<svc>.git`). When the source repos are archived in Phase A7, these compose files break. **Action:** add to Phase A7 — repoint compose `context:` URLs to the new `remote-falcon-platform` repo with `subdir: apps/<svc>` once the cutover lands.

**Exit criteria:** every repo tagged ✓, baseline yaml saved ✓, repo strategy decided ✓, adjacent-tooling risks surfaced ✓.

---

## Phase A — Monorepo cutover *(3–5 days)*

**Goal:** all 8 services + library running in one repo with the existing per-service workflows still working. No test changes, no service merges yet. Pure structural move.

### Target layout

```
remote-falcon-platform/
├── apps/
│   ├── ui/                  # was remote-falcon-ui
│   ├── gateway/             # was remote-falcon-gateway
│   ├── control-panel/       # was remote-falcon-control-panel
│   ├── viewer/              # was remote-falcon-viewer
│   ├── plugins-api/         # was remote-falcon-plugins-api
│   ├── external-api/        # was remote-falcon-external-api
│   ├── mongo-backup/        # was remote-falcon-mongo-backup
│   └── account-archive/     # was remote-falcon-account-archive
├── libs/
│   └── schema/              # was remote-falcon-library
├── ops/
│   ├── docker-compose.dev.yml
│   ├── dev-nginx.conf
│   ├── .env.dev.example
│   ├── dev-up.sh
│   └── deploy-all.sh
├── .github/workflows/
│   └── (existing 8 workflows, copied as-is for now)
├── SERVICES.md
├── TESTING.md
└── CLAUDE.md
```

### Steps

- [ ] **A1. Subtree-merge with history preservation.**
  Script at `/tmp/merge-repos.sh`:
  ```bash
  #!/bin/bash
  set -euo pipefail
  cd remote-falcon-platform
  for r in ui gateway control-panel viewer plugins-api external-api \
           mongo-backup account-archive; do
    git remote add "src-$r" "git@github.com:Remote-Falcon/remote-falcon-$r.git"
    git fetch "src-$r"
    git subtree add --prefix="apps/$r" "src-$r/main" --squash
    git remote remove "src-$r"
  done
  git remote add src-lib git@github.com:Remote-Falcon/remote-falcon-library.git
  git fetch src-lib
  git subtree add --prefix=libs/schema src-lib/master --squash
  git remote remove src-lib
  ```
  Squash to keep history readable; full history stays in the archived source repos if you ever need it.

- [x] **A2. Replace JitPack with the local module.** *(completed 2026-04-27)*
  - **Maven aggregator** at root `pom.xml` registers `libs/schema`, `apps/control-panel`, `apps/external-api` as modules. `mvn install` from the repo root builds in dependency order.
  - **Maven consumers** (`control-panel`, `external-api`) updated:
    - `<dependency>` changed from `com.github.Remote-Falcon:remote-falcon-library:a5703a28fe` → `com.remotefalcon:remote-falcon-library:1.0.0-LOCAL` (matches `libs/schema/pom.xml`'s existing identity)
    - `<repositories>` JitPack block removed
    - Existing `<exclusions>` preserved
  - **Gradle consumers** (`viewer`, `plugins-api`, `account-archive`) updated:
    - `implementation` coordinate updated to the same `com.remotefalcon:remote-falcon-library:1.0.0-LOCAL`
    - `maven { url 'https://jitpack.io' }` removed; `mavenLocal()` (already present) is now the resolution path
    - Existing exclusions preserved
    - `quarkus.index-dependency.remote-falcon-library.group-id` updated from `com.github.Remote-Falcon` → `com.remotefalcon`
  - **Bootstrap order:** Gradle services require `mvn install -pl libs/schema -am` to run first (since they consume the lib via `mavenLocal()`, not a Gradle composite). Documented in the monorepo root README.
  - **Deferred:** the originally-planned Gradle composite (`include 'libs:schema', 'apps:viewer', ...`) is **not** in this phase. Reason: `libs/schema` is a Maven project; making Gradle's `include` directive resolve it cleanly would require either duplicating dep info into a `build.gradle` or restructuring the lib. Left for Phase B (unified CI), where the workflow already runs `mvn install` before `./gradlew build` anyway.

- [x] **A3. Move ops tooling into `ops/` with self-host vs platform mode split.** *(completed 2026-04-27)*
  - `dev-up.sh`, `docker-compose.dev.yml`, `dev-nginx.conf`, `.env.dev.example` copied from `~/rf-build/` to `remote-falcon-platform/ops/`. Originals retained as workspace reference until A4 verification.
  - **Build contexts** updated in `docker-compose.dev.yml`: `./remote-falcon-<svc>` → `../apps/<svc>`. `.env.dev` interface unchanged.
  - **Compose profile split** added based on the deployment-wizard's existing self-host shape:
    - **Core (always-active, default):** `mongo`, `ui`, `control-panel`, `viewer`, `plugins-api`, `ingress`. Matches what the wizard and `developer-files/local-docker-compose` ship.
    - **Platform-only (`profiles: [platform]`):** `gateway`, `external-api`, `mongo-backup`, `account-archive`. SaaS-operator concerns; not relevant to single-tenant self-host.
  - **`dev-up.sh` flag handling** added: `--core` flag (parseable anywhere in args) omits the platform profile; default behavior is unchanged for the workspace operator. Health check skips platform-only services in core mode.
  - **Ingress depends_on** trimmed to always-active services only (otherwise compose would fail to start in core mode). Routes for missing services 502 — accepted as correct self-host behavior.
  - Added `ops/README.md` documenting both modes, endpoints, and bootstrap order.
  - Verified bash syntax (`bash -n`), YAML structure, and that all 8 build contexts resolve to actual Dockerfiles in `apps/`.

- [ ] **A4. Verify locally.** `./ops/dev-up.sh up && ./ops/dev-up.sh health` — every service must come up green. **This is the cutover gate.**

- [ ] **A5. Copy the 8 existing workflows verbatim** into `.github/workflows/`, renaming to `<service>-deploy.yml`. Add `paths:` filters so each only fires when its service changes:
  ```yaml
  on:
    push:
      branches: [main]
      paths: ['apps/ui/**', 'libs/schema/**']  # for ui-deploy.yml
  ```
  Library-consuming services include `libs/schema/**`.

- [ ] **A6. Switch GHCR image source.** Images push to `ghcr.io/<your-org>/remote-falcon-<service>` from the new repo; `kubectl set image` is used as a one-time bridge so existing pods pull from the new image path. Confirm pod restart succeeds in cluster.

- [ ] **A7. Archive the 8 source repos.** GitHub → Settings → Archive. Read-only, history preserved, no accidental commits.
  - **Before archiving:** repoint `developer-files/do-ubuntu-droplet/docker-compose.yaml` and `developer-files/local-docker-compose/docker-compose.yaml` `build.context` URLs to the new `remote-falcon-platform` repo (with the appropriate `apps/<svc>` subdirectory). Surfaced in Phase 0.4.

### Phase A exit criteria
- `git push` to monorepo `main` deploys exactly the changed service(s) — no others
- `./ops/dev-up.sh up` works identically to before
- Cluster shows the same pods, same versions, same secrets — nothing changed there
- Old repos archived

**Reversibility:** old repos still exist (archived); revert by un-archiving and reverting the kubectl image change. ~1 hour to back out.

---

## Phase B — Unified CI with selective deploy *(2–3 days)*

**Goal:** replace the 8 copy-pasted workflows with one matrix workflow that handles all services, with cluster ID and shared config in one place.

### Steps

- [ ] **B1. Single deploy workflow at `.github/workflows/deploy.yml`:**
  ```yaml
  name: Deploy
  on:
    push:
      branches: [main]
    workflow_dispatch:
      inputs:
        service:
          type: choice
          options: [all, ui, gateway, control-panel, viewer,
                    plugins-api, external-api, mongo-backup, account-archive]

  env:
    CLUSTER_ID: 4f1406fe-1179-4a9c-9d2e-835c3da34984
    REGISTRY: ghcr.io/${{ github.repository_owner }}

  jobs:
    detect:
      runs-on: ubuntu-latest
      outputs:
        services: ${{ steps.filter.outputs.changes }}
      steps:
        - uses: actions/checkout@v4
        - uses: dorny/paths-filter@v3
          id: filter
          with:
            filters: |
              ui: ['apps/ui/**']
              gateway: ['apps/gateway/**']
              control-panel: ['apps/control-panel/**', 'libs/schema/**']
              viewer: ['apps/viewer/**', 'libs/schema/**']
              plugins-api: ['apps/plugins-api/**', 'libs/schema/**']
              external-api: ['apps/external-api/**', 'libs/schema/**']
              mongo-backup: ['apps/mongo-backup/**', 'libs/schema/**']
              account-archive: ['apps/account-archive/**', 'libs/schema/**']

    deploy:
      needs: detect
      if: needs.detect.outputs.services != '[]'
      strategy:
        fail-fast: false
        matrix:
          service: ${{ fromJSON(needs.detect.outputs.services) }}
      uses: ./.github/workflows/_deploy-service.yml
      with:
        service: ${{ matrix.service }}
      secrets: inherit
  ```

- [ ] **B2. Reusable per-service workflow at `_deploy-service.yml`** that takes `service` as input and runs `test → build → push → kubectl apply → smoke`. Per-service quirks (build args, secrets, build commands) live in a `apps/<svc>/.deploy.yml` config file the workflow reads.

- [ ] **B3. `workflow_dispatch` for unchanged-service redeploys.** Manual trigger with the service dropdown handles "redeploy api even though nothing changed" — replaces today's `gh workflow run` per repo.

- [ ] **B4. Delete the 8 copy-pasted workflows** from Phase A5. Cluster ID now lives in exactly one place (`env.CLUSTER_ID`).

- [ ] **B5. Retire `deploy-all.sh`** — its job is now done by pushing to `main` (selective) or `workflow_dispatch` with `service: all` (full).

### Phase B exit criteria
- One YAML file controls all deploys
- Push that touches only `apps/ui/**` deploys only UI; push that touches `libs/schema/**` deploys all 5 consumers
- Cluster ID grep finds exactly one match in the repo
- Manual redeploy still possible via `gh workflow run deploy.yml -f service=api`

**Reversibility:** the deleted Phase A5 workflows live in git history; revert the PR to restore them.

---

## Phase C — Test pyramid + release gating *(1.5–2 weeks)*

**Goal:** every deploy is gated by tests at the appropriate tier. A red test blocks prod. A failed smoke test triggers auto-rollback.

This is the phase that delivers the "validate every release" goal directly. **It runs before the service merges**, so the merges land with a safety net.

### C1. Wire existing tests into CI *(half a day)*
- [ ] **C1.1** `_deploy-service.yml` runs the test step before Docker build:
  - Maven services: `mvn -B test`
  - Gradle services: `./gradlew test`
  - UI: `npx cypress run` (existing 2 specs) + a new `vitest` step (initially empty, ready for unit tests)
- [ ] **C1.2** Confirm failed tests block deploy (test with a deliberately-broken commit on a branch).

### C2. Cleanup *(half a day)*
- [ ] **C2.1** Delete the 4k LOC of commented-out tests in `apps/control-panel/src/test/` and `apps/external-api/src/test/`. They reference dead packages and falsely suggest coverage exists.
- [ ] **C2.2** Add `tsconfig.json` to `apps/ui/` (declared dep, never configured).

### C3. Highest-risk unit/integration tests *(~1 week)*

In this order:

- [ ] **C3.1 `MongoBackupServiceTest`** *(2–3 days)* — testcontainers Mongo + LocalStack S3. Asserts: dump key format, S3 PutObject is called with the right bucket, retention deletes old backups, failure paths log + alert. *Silent backup failure is the only data-loss bug class in the stack.*

- [ ] **C3.2 `AccountArchiveServiceTest`** *(half a day)* — Mockito tests for the archive cutoff predicate, "don't archive accounts with recent activity," empty-result handling. *This service deletes customer data.*

- [ ] **C3.3 `WebSecurityConfig` + `AuthUtil` + `@RequiresAccess` end-to-end JWT test in control-panel** *(2 days)* — `MockMvc` exercising real JWT issuance and validation. *The auth surface for the entire authenticated stack has zero coverage today.*

### C4. Shared test infrastructure *(2 days)*
- [ ] **C4.1** Create `libs/test-fixtures/` — Mongo seed data builder, JWT factory, faker shared across services. Used in C5/C6.

### C5. Contract tests *(2–3 days)*

`tests/contract/` at the repo root:
- [ ] **C5.1 Schema round-trip:** every type in `libs/schema` (`Show`, `Wattson`, `Notification`) round-trips JSON ↔ BSON ↔ Spring Document ↔ Quarkus Panache cleanly. Catches drift between the dual-stack mappings inside the library.
- [ ] **C5.2 Provider tests:** `apps/plugins-api` against the wire format documented from `remote-falcon-plugin`'s PHP listener (manually documented since the plugin has no machine-readable contract).
- [ ] **C5.3 Cross-service:** `apps/control-panel` writes a `Show`, `apps/viewer` reads it via the same `libs/schema` types. Asserts shared collections actually round-trip end-to-end.

### C6. E2E harness *(3–5 days)*

`tests/e2e/` with Playwright:
- [ ] **C6.1** CI brings up the local stack: `./ops/dev-up.sh up && ./ops/dev-up.sh health`
- [ ] **C6.2** Playwright runs against `http://localhost:8080` (same URL surface as prod)
- [ ] **C6.3 Smoke tier (block deploy):** login, viewer page loads on a seeded show, FPP-style request hits `plugins-api` and gets back a playlist. ~5 specs, runs in <2 min.
- [ ] **C6.4 Regression tier (informational, runs nightly):** sequence editor, votes/requests config, account email change, page editor. ~20 specs, runs in 10–15 min.

### C7. Post-deploy smoke + auto-rollback *(1 day)*
- [ ] **C7.1** Tail end of `_deploy-service.yml`:
  1. `kubectl rollout status` with 60s timeout
  2. Hit each service's health endpoint + 1 critical path
  3. On failure: `kubectl rollout undo` + workflow fails red
  4. On success: workflow green

### C8. UI env-var assertion *(1 hour)*
- [ ] **C8.1** `apps/ui/src/index.jsx` throws on boot if any required `VITE_*` is empty. Eliminates the silent-misconfig deploy class.

### Phase C exit criteria
- Every push to main runs unit → integration → contract → e2e-smoke before deploying
- A deliberately-broken commit fails CI before prod
- A deliberately-broken health endpoint triggers auto-rollback
- Nightly job runs regression e2e + reports failures as issues
- Coverage on the three highest-risk paths (mongo-backup, account-archive, JWT) goes from 0% to actually-tested

**Reversibility:** test gates can be temporarily disabled via `if: false` on the test job. Rollback step can be removed independently.

---

## Phase D — Service merges *(2–3 weeks; each merge soaks 3+ days)*

**Goal:** 8 services → 5. Done in risk order, with the Phase C safety net catching regressions on each merge.

### D1. `apps/jobs` (mongo-backup + account-archive) — *2 days + 3-day soak*

**Lowest risk:** both internal Quarkus jobs, both Mongo, neither has heavy public traffic.

- [ ] **D1.1** New module `apps/jobs/` combining both `@Scheduled` methods
- [ ] **D1.2** Single image, single pod, single replica
- [ ] **D1.3** Combined Secrets into one `remote-falcon-jobs` Secret
- [ ] **D1.4** Mongo-backup keeps its `/remote-falcon-mongo-backup` trigger endpoint unchanged
- [ ] **D1.5** Old `apps/mongo-backup/` and `apps/account-archive/` dirs deleted in the merge PR
- [ ] **D1.6** Old k8s Deployments kept running for 3 days (zero replicas) before cleanup, in case of rollback
- [ ] **D1.7** 3-day soak — no incidents, metrics nominal

### D2. `apps/realtime` (viewer + plugins-api) — *4 days + 3-day soak*

**Highest-traffic merge.** Both Quarkus, both Mongo-only, very similar shape.

- [ ] **D2.1** Resource roots stay byte-identical: `/remote-falcon-viewer/**` and `/remote-falcon-plugins-api/**` + `/remotefalcon/api/**` rewrite
- [ ] **D2.2** Ingress points at one Service; rules unchanged
- [ ] **D2.3** Combined replica count starts at 2 (was 1+1)
- [ ] **D2.4** ServiceMonitor combined; metrics path unchanged
- [ ] **D2.5** Datadog dashboard split-pane during soak: old `viewer` graphs vs new `realtime` graphs
- [ ] **D2.6** 3-day soak — no incidents, P95 latency unchanged or better

### D3. `apps/api` (control-panel + external-api) — *4–6 days + 3-day soak*

**Highest auth-surface risk.** Both Spring Boot 3 native, both Mongo.

- [ ] **D3.1** Two `SecurityFilterChain` beans: API-key chain (order 1) on `/external/**`, JWT chain (order 2) on `/**`
- [ ] **D3.2** Combined Secret `remote-falcon-api` with all keys from both
- [ ] **D3.3** Ingress paths unchanged; both `/remote-falcon-control-panel/**` and `/remote-falcon-external-api/**` route to the same Service, different controller paths
- [ ] **D3.4** C5 contract tests + C3 JWT end-to-end test become hard load-bearing here
- [ ] **D3.5** 3-day soak — auth flows green, no 401/403 spikes

### Phase D exit criteria
- 5 production services: `ui`, `gateway`, `api`, `realtime`, `jobs`
- All deploys still selective (path filters updated)
- All test tiers still green
- Cluster resource usage reduced (3 fewer pods, 3 fewer ingress rules to reason about)

**Reversibility:** revert merge PR + `kubectl rollout undo`. Old service code lives in git history.

---

## Phase E — Optional follow-ups *(not on the critical path)*

Pick based on what hurts most.

- [ ] **E1. Drop the gateway.** Spring Cloud Gateway uses 1.25Gi memory and 2 replicas to do path routing nginx-ingress already does. Real cluster-cost win once the merges have soaked.
- [ ] **E2. Native-image smoke tests in CI.** Build native images on PR (not just `mvn package`) and run a tiny smoke against them. Catches GraalVM reflection breakage before deploy.
- [ ] **E3. k6 load test baseline** on `apps/realtime`. Data already exists in `remote-falcon-load-tests`; wire into nightly run.
- [ ] **E4. Pact tests with `remote-falcon-plugin`.** PHP plugin is the only un-version-pinned wire contract in production. Codify it.
- [ ] **E5. Migrate `apps/ui` `.jsx` → `.tsx`** incrementally. TypeScript dep already there, doing nothing.
- [ ] **E7. Full-stack observability rollout.** *(~2 weeks; ideally sequenced after C7 and before D)*
  Standardize on OpenTelemetry across backend services, send to Grafana Cloud (metrics + logs + traces), use PostHog for frontend RUM / product analytics / errors / session replay, and retire the partial kube-prometheus-stack + Datadog wiring + redundant frontend SDKs (Mixpanel, GA, Clarity). Closes the release-validation loop with post-deploy alert windows that can trigger auto-rollback.
  **Full design and implementation checklist:** [OBSERVABILITY-PLAN.md](OBSERVABILITY-PLAN.md).
- [ ] **E6. Retire `remote-falcon-data` + consolidate load testing.** *(~1 day)*
  Audit confirmed nothing in this repo is load-bearing for prod: the `k8s/datadog-agent.yaml` requires a Datadog Operator that isn't installed, the `k8s/viewer-secret.yml` is a dev template with placeholder values (`host.docker.internal`, `123456`), and the `kind/` scripts contain hardcoded paths from the previous maintainer (`/Users/vance/Development/...`) and are superseded by `./dev-up.sh`. Disposition:
  - **Delete:** `k8s/datadog-agent.yaml` (dropped with Datadog deprecation), `k8s/viewer-secret.yml` (dev template), `kind/` (obsolete), `Remote Falcon Viewer Load Test.jmx` (JMeter — redundant with k6), `.idea/dataSources*.xml` (personal IDE config).
  - **Move to `remote-falcon-load-tests`:** `mk-load-test/k6/`, `mk-load-test/*.sh`, `remote-falcon.show-load-testing.json.zip` (59MB), `load-test-shows.csv`. Resolves the existing duplication where two repos hold overlapping k6 + show-fixture material for the same target.
  - **Archive the empty repo** alongside the 8 service repos in Phase A7.
  - Update [SERVICES.md](SERVICES.md) to remove the bring-up step that references this repo, and to reflect that Datadog is no longer the observability path (Prometheus is).

---

## Sequencing summary

| Phase | Duration | Goal | Why this order |
|---|---|---|---|
| 0: Pre-work | 0.5 days | Reversibility | Cheap insurance |
| A: Monorepo | 3–5 days | One repo, same prod | Foundation for everything else |
| B: Unified CI | 2–3 days | Selective deploy | Replaces the 8-workflow sprawl |
| **C: Test gates** | **1.5–2 weeks** | **Validate every release** | **Must precede merges — provides safety net** |
| D: Service merges | 2–3 weeks | 8 → 5 services | Easier to do safely with C's gates |
| E: Optional | open-ended | Polish | Pick based on pain |

**Total critical path:** ~7–8 weeks if done sequentially with no other work. Realistically 10–12 weeks part-time.

---

## Decision points (go/no-go gates)

1. **End of Phase A:** is `./ops/dev-up.sh up` green? If not, stop and debug — don't proceed to B.
2. **End of Phase B:** does a path-filtered push deploy only the changed service? If not, stop and fix the workflow.
3. **End of Phase C1:** do existing viewer/plugins-api tests now run on every push? If not, the rest of C is moot — stop and fix CI.
4. **End of Phase C7:** does a deliberately-broken commit on a feature branch get caught by CI? Test the test infrastructure before relying on it.
5. **Before each Phase D merge:** has the previous merge soaked 3+ days with no production incidents? Don't stack merges.

---

## Change log

| Date | Change | By |
|---|---|---|
| 2026-04-26 | Initial plan drafted | Matt + Claude session |
| 2026-04-27 | Phase 0 executed: 10 tags pushed, baseline captured, repo strategy decided, `developer-files` migration risk added to A7 | Matt + Claude session |
| 2026-04-27 | Phase A1 executed: monorepo created at `Remote-Falcon/remote-falcon-platform` (private); 8 services + library subtree-merged with squashed history | Matt + Claude session |
| 2026-04-27 | Phase A2 executed: root Maven aggregator pom.xml added; all 5 consumers switched from JitPack `com.github.Remote-Falcon:...:a5703a28fe` → local `com.remotefalcon:remote-falcon-library:1.0.0-LOCAL`; Gradle composite deferred to Phase B | Matt + Claude session |
| 2026-04-27 | Phase A3 executed: ops/ created with dev-up.sh, compose, nginx; introduced platform/core mode split via Compose profiles to support both SaaS-operator and self-host deployments (matching the existing deployment-wizard shape); --core flag added to dev-up.sh | Matt + Claude session |
