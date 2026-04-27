# Remote Falcon — Testing Audit & Improvement Plan

**Audit date:** 2026-04-25
**Scope:** All 8 production services in `~/rf-build/`, plus the 14 adjacent repos in the Remote-Falcon GitHub org (shared library, customer-facing artifacts, operator tooling).
**Method:** Three parallel agents inventoried test files, frameworks, coverage tooling, CI integration, and risk areas across the production services. The "Adjacent repos coverage" section was added 2026-04-25 after the rest of the org's repos were cloned locally.

---

## TL;DR

| | |
|---|---|
| **Stack-wide effective coverage** | ~10% by class count, concentrated in 2 of 8 services |
| **Services with credible tests** | 2 (`remote-falcon-viewer`, `remote-falcon-plugins-api`) |
| **Services with zero tests** | 6 (`account-archive`, `mongo-backup`, `control-panel`, `external-api`, `gateway`, `ui`) — the UI has 2 pre-auth Cypress specs only |
| **Services running tests in CI** | 0 — every `build-and-release.yml` workflow goes straight from `mvn package` / `gradle build` / `vite build` to Docker push, with no test step |
| **Coverage thresholds enforced** | 0 |
| **Contract / integration tests across services** | 0 |
| **Native-image smoke tests** | 0 (and 6 of 8 services ship as GraalVM native images) |
| **Adjacent repos with tests** | 0 of the in-scope ones — `remote-falcon-library` (the canonical Mongo schema for 5 services), `remote-falcon-plugin` (FPP plugin running on every customer's controller), `remote-falcon-viewer-page-js` (CDN scripts running in every viewer browser), `remote-falcon-deployment-wizard`, and `remote-falcon-mobile` all have **zero** test coverage |

The riskiest services are the worst-tested: `mongo-backup` (silent backup failure = no recoverable data) and `account-archive` (deletes customer accounts) both have **zero** tests. The control-panel — the entire auth surface and integration hub — has 4,000+ lines of test code, all of it commented out, referencing a previous package layout.

---

## Per-service inventory

| Service | Stack | Source classes | Active test classes | `@Test` methods | JaCoCo | Sonar | CI test step |
|---|---|---:|---:|---:|:---:|:---:|:---:|
| remote-falcon-viewer | Quarkus 21 native | 11 | 9 | 88 | ✓ | ✓ | (no enforcement) |
| remote-falcon-plugins-api | Quarkus 21 native | 17 | 4 | 58 | ✓ | ✓ | (no enforcement) |
| remote-falcon-account-archive | Quarkus 21 native | 2 | **0** | 0 | ✗ | ✗ | ✗ |
| remote-falcon-mongo-backup | Quarkus 21 native | 2 | **0** | 0 | ✗ | ✗ | ✗ |
| remote-falcon-control-panel | Spring Boot 3 / Java 21 native | 57 | **0** *(6 commented-out files, ~4k LOC)* | 0 | ✗ | ✗ | ✗ |
| remote-falcon-external-api | Spring Boot 3 / Java 21 native | 12 | **0** *(1 commented-out file)* | 0 | ✗ | ✗ | ✗ |
| remote-falcon-gateway | Spring Cloud Gateway / Java 17 | 1 + 4 YAML | **0** *(no `src/test`)* | 0 | ✗ | ✗ | ✗ |
| remote-falcon-ui | Vite + React | ~all `.jsx` | 2 Cypress specs *(landing + signup only)* | ~10 `it` blocks | n/a | ✗ | ✗ |

> **"Active test classes"** = files in `src/test/` that compile and run. The Spring services contain large test files where every line is `//` commented out (legacy from a package rename — they reference `com.remotefalcon.api` and classes like `PluginService`, `ApiService`, `ViewerPageService` that no longer exist in `main`).

---

## Adjacent repos coverage

The 8 production services aren't the whole picture. Several other repos in the Remote-Falcon org ship code that runs in production — on customer FPPs, in viewer browsers, or as a build-time dependency of multiple services — and none of them have any test coverage either.

| Repo | Stack | What it ships | Tests | CI test step |
|---|---|---|---:|:---:|
| `remote-falcon-library` | Maven / Java 17 (Spring Data + Quarkus Panache) | Shared MongoDB schema (`Show`, `Wattson`, `Notification`, etc.), pulled at a pinned git SHA via JitPack by 5 of 8 services | **0** *(no `src/test`)* | ✗ *(no `.github/workflows`)* |
| `remote-falcon-plugin` | PHP + JS + shell | FPP plugin installed on customer show controllers (~975 LOC); talks to `plugins-api` | **0** | ✗ |
| `remote-falcon-viewer-page-js` | Plain JS | 6 CDN-served scripts (snow, countdowns, dynamic menu) executed in viewer browsers | **0** | ✗ |
| `remote-falcon-page-templates` | Static HTML | 6 default viewer-page templates seeded by `control-panel` | **0** | ✗ |
| `remote-falcon-maintenance-mode` | Static HTML | Maintenance landing page | n/a | n/a |
| `remote-falcon-deployment-wizard` | Node / Express | Customer-installable deployer (`localhost:3030`); provisions cloud resources | **0** | ✗ |
| `remote-falcon-mobile` | Expo / React Native (Expo Router, Apollo, Redux Toolkit) | Mobile companion app (~23 `.tsx` screens), distributed via EAS | **0** *(`jest-expo` preset declared, no test files)* | ✗ |
| `remote-falcon-viewer-quarkus` | Quarkus / Java 21 | Dormant viewer rewrite (Feb 2025) on a separate cluster | 1 *(auto-generated `ExampleResourceTest`)* | ✗ |
| `remote-falcon-data` | k6 + JMeter + kind scripts | Load tests + cluster bootstrap + manually-applied Datadog/secret manifests | n/a *(this repo is itself test infra)* | ✗ |
| `remote-falcon-load-tests` | k6 + Node + `mongodb` driver | Viewer GraphQL smoke + data-integrity scripts | n/a *(this repo is itself test infra)* | ✗ |

**Highest-risk findings here:**

- **`remote-falcon-library` has zero tests and is the canonical Mongo schema for 5 services.** All 5 currently pin to the same SHA (`a5703a28fe`), so they agree by accident — but nothing protects that. A field rename or default change here can silently desync any one service that bumps without the others, with no contract test to catch it. **Highest-leverage untested repo in the entire org.**
- **`remote-falcon-plugin` is the only un-version-pinned wire-format contract in production.** Customers run whatever version they last installed; `plugins-api` accepts requests from all of them. There's nothing testing that `plugins-api` still serves the older plugin shapes.
- **`remote-falcon-viewer-page-js` runs in real customers' viewer pages from `master`.** No version pinning on the customer side; a revert on `master` is the only rollback path.
- **`remote-falcon-deployment-wizard` provisions DigitalOcean infra on customer accounts.** Bugs here cost customers real money (wrong-region or oversized droplets) and surface as support tickets, not pages.
- **`remote-falcon-mobile` declares `jest-expo` but ships no tests.** The whole mobile experience (auth, viewer, push) is untested today.

---

## Findings by service

### remote-falcon-viewer ✓ *(credibly tested, but unenforced)*
- 88 `@Test` methods across 9 classes — REST + GraphQL + 3 Mongo testcontainers integration tests.
- Geo-fencing, IP blocking, request limits, vote dedup are all directly exercised.
- JaCoCo configured but **no `violationRules`** — coverage can regress silently.
- Untested: `CustomGraphQLExceptionResolver`, `ViewerMetrics`, OpenTelemetry/Micrometer instrumentation, native-image reflection correctness.
- **Highest-traffic service in the stack — and there's no load test.**

### remote-falcon-plugins-api ✓ *(credibly tested, but unenforced)*
- 58 `@Test` methods across 4 classes; every named REST endpoint has at least a happy-path test plus a Mongo-testcontainers integration suite.
- **`ShowTokenFilter` (the only authn boundary, 63 LOC) has no dedicated test** — only indirectly hit via integration.
- 789-LOC `PluginService`: 23 service-layer tests are thin per-LOC; error/boundary branches likely under-tested.

### remote-falcon-account-archive ✗ *(0 tests, deletes data)*
- 2 source classes; one is a scheduled job that archives/deletes show accounts.
- **Zero tests** — no archive-cutoff predicate test, no "don't archive recent activity" test, no Mongo collection-targeting test.
- A regression here destroys customer accounts silently and irreversibly.

### remote-falcon-mongo-backup ✗ *(0 tests, the backup itself)*
- 2 source classes; `MongoBackupService` is 276 LOC and talks to Mongo + S3.
- **Zero tests** — no dump-correctness test, no S3 key-format test, no retention test, no failure-handling test.
- **Silent backup failure is the worst-case bug class in the stack** and this is the service most likely to suffer from it.

### remote-falcon-control-panel ✗ *(0 active tests; 4k LOC commented out)*
- 57 source classes including `WebSecurityConfig`, `AuthUtil` (JWT), `AccessAspect`/`@RequiresAccess` AOP, GraphQL resolvers, S3/SendGrid/GitHub-PAT/OpenAI integrations.
- 6 test files exist but every line begins with `//`. Stale package references (`com.remotefalcon.api`) and target classes that no longer exist (`PluginService`, `ApiService`, `ViewerPageService`).
- `pom.xml` declares `wiremock-standalone`, `testcontainers`, `rest-assured` — **none used**.
- **Highest-leverage untested code in the entire stack:** the JWT issuance/validation path.

### remote-falcon-external-api ✗ *(0 active tests)*
- 12 classes including the API-key validation that gates the entire partner GraphQL surface.
- One commented-out `Mocks.java`. No test deps for `spring-graphql-test` or `spring-security-test`.
- `DozerRuntimeHints` is the only guard against native-image reflection breakage — itself untested.

### remote-falcon-gateway ✗ *(0 tests, routes are config-only)*
- 1 Java class (`Application`); all routes/predicates/filters live in `application*.yml`.
- No `src/test` directory. **A typo in `application-prod.yml` ships to prod undetected.**

### remote-falcon-ui ✗ *(no unit tests; 2 marketing-page e2e)*
- Cypress: 2 specs covering landing-page navigation and sign-up form validation. **That's it.**
- No vitest/jest, no `@testing-library`, no MSW, no Playwright, no Storybook.
- Build-time keys (`VIEWER_JWT_KEY`, `GOOGLE_MAPS_KEY`, PostHog, GA, Mixpanel, Clarity) read via `import.meta.env.VITE_*` with **no startup assertion** — a missing GitHub secret silently produces a deploy where auth/maps/analytics don't work.
- TypeScript dep is present but unused (codebase is `.jsx`); `tsconfig.json` doesn't exist.
- The viewer page (the highest-traffic public surface) and the entire control panel SPA are completely untested.

---

## Cross-cutting findings

1. **CI runs no tests anywhere.** Every `build-and-release.yml` is `checkout → docker build → push → kubectl apply`. There is no `mvn test`, no `./gradlew test`, no `vitest`, no `cypress run`. The two services with credible tests run them locally only.
2. **No coverage thresholds.** Where JaCoCo is wired (viewer, plugins-api), nothing breaks the build on regression.
3. **No contract tests** between services. The shared `Show` document (in `remote-falcon-library`) is the most likely silent-breakage vector and nothing protects it. The library itself has zero tests and is consumed at pinned git SHA by 5 of 8 services; if any one service bumps without the others, the only safety is reading the diff.
4. **No native-image smoke tests.** Six services ship as GraalVM native; reflection/serialization issues only surface at deploy time.
5. **No load / performance tests** on viewer or plugins-api.
6. **The Spring services have aspirational test deps** (WireMock, Testcontainers, REST Assured) that are declared and unused — and now obscure the fact that nothing runs.
7. **Deploy → prod has no smoke test.** A failed start, a crash-loop, a 500-on-every-request — all only caught when a user complains.
8. **Customer-installed code has no automated guardrails.** The FPP plugin (`remote-falcon-plugin`), the CDN-served viewer scripts (`remote-falcon-viewer-page-js`), and the deployment wizard (`remote-falcon-deployment-wizard`) all ship to end users from `master` with no tests, no CI, and no version pinning on the consumer side.

---

## Prioritized improvement plan

### Phase 1 — Stop the bleed *(week 1; ≤5 dev-days total)*
Goal: every service has *something* gating it and the highest-risk untested code gets a basic safety net.

1. **Wire `mvn test` / `./gradlew test` / `cypress run` into every `build-and-release.yml`** before the Docker step. Make `main` builds fail on test failure. Effort: ~30 min per service.
2. **Add JaCoCo + Sonar config to `account-archive` and `mongo-backup`** — copy from viewer. 30 min each.
3. **Write `AccountArchiveServiceTest`**: 5–8 Mockito tests asserting the archive cutoff, "don't archive recent activity" predicate, empty-result handling. ~half a day.
4. **Add an env-var assert at UI boot** (`src/index.jsx`) that throws if `VITE_VIEWER_JWT_KEY` / `VITE_CONTROL_PANEL_API` / `VITE_VIEWER_API` are empty. Eliminates the silent-misconfig deploy class entirely. ~1 hour.
5. **Add `WebTestClient` smoke tests for the gateway** — one per route in `application-prod.yml`. Catches typos in YAML routes. ~half a day.
6. **Delete or quarantine the commented-out test files in control-panel and external-api** (move to `archive/` or remove). They reference dead packages and falsely suggest coverage exists. ~1 hour.
7. **Add `./dev-up.sh health` to CI smoke** — bring up the local stack, hit every health endpoint, fail if any non-200. Catches start-up regressions before they reach k8s.

### Phase 2 — Cover the highest-risk paths *(weeks 2–4; ~10 dev-days)*

8. **`MongoBackupServiceTest` with LocalStack S3 + testcontainers Mongo** — assert dump key format, S3 PutObject is called, retention/cleanup logic. ~3 days. **Highest-impact single test in the stack.**
9. **`ShowTokenFilter` unit test** in plugins-api: parameterised tests for missing/malformed/expired tokens and mismatched show ID. ~1 day.
10. **End-to-end JWT flow test in control-panel**: `WebSecurityConfig` + `AuthUtil` + `@RequiresAccess` exercised through a real `MockMvc` request. ~2 days.
11. **WireMock-backed integration tests for control-panel's outbound calls**: GitHub PAT (`ClientUtil`), SendGrid (`EmailUtil`), OpenAI (`WattsonUtil`). The deps are already in pom; just use them. ~2 days.
12. **`@DataMongoTest` repository tests** for control-panel and external-api repositories using testcontainers. ~1 day each.
13. **Restore `@RequiresAccess` AOP tests** in control-panel and external-api with `@SpringBootTest` slices. ~1 day.
14. **Set initial JaCoCo thresholds** at a low baseline (40% line) on viewer and plugins-api with `jacocoTestCoverageVerification`; tighten quarterly. ~2 hours.
15. **Schema round-trip tests in `remote-falcon-library`** for `Show`, `Wattson`, and `Notification` — assert that both the Spring `documents/*` and Quarkus `quarkus/entity/*` mappings round-trip JSON/BSON cleanly, and add a JitPack-friendly `mvn test` step. Locks down the most ripple-prone untested code in the org. ~1–2 days.

### Phase 3 — Stack-level confidence *(month 2+; multi-week)*

15. **Playwright e2e for the viewer voting/request flow** against a seeded show, including the `SWAP_CP` true/false branch. ~1 week.
16. **GraalVM native test target in CI** for all 6 native services. ~1 week to set up a reusable workflow snippet.
17. **Pact or Spring Cloud Contract** between `plugins-api` ↔ FPP plugin, and between `viewer` ↔ `control-panel`. The biggest unmodelled risk in the stack. ~2 weeks.
18. **k6 / Gatling load test for viewer** with a CI baseline (P95, error rate). ~1 week (the `remote-falcon-data` repo already has a k6 starting point).
19. **Vitest + `@testing-library/react` + MSW** component tests for the four highest-risk control-panel screens (Sequences editor, Requests/Votes config, Pages/Monaco editor, Account email change). ~1 week.
20. **A11y smoke** via `@axe-core/playwright` on landing, sign-in, sign-up, viewer, and 3 CP screens. ~3 days.
21. **Mutation testing (Pitest)** on `GraphQLMutationService` (viewer) and `PluginService` (plugins-api). Reveals whether the existing assertions are real or shallow. ~1 week.
22. **Migrate UI `.jsx` → `.tsx` incrementally** with `tsconfig.json` strict mode, starting with `src/utils/` and `src/services/`. The `typescript` dep is already there but does nothing today. Multi-week.

---

## Recommended initial targets

If you can only pick **three things this month**, pick:

1. **Add a CI test step to every repo** (Phase 1.1). Without this, every other test investment is optional.
2. **Test `MongoBackupService`** (Phase 2.8). Silent backup failure is the only bug class that destroys data permanently.
3. **End-to-end JWT flow test in control-panel** (Phase 2.10). The auth surface for the entire authenticated stack has zero coverage today.

---

## Where new tests should live (per stack)

| Stack | Location | Framework | First test to add |
|---|---|---|---|
| Quarkus (Gradle) | `src/test/java/.../<svc>` | `quarkus-junit5` + `rest-assured` + testcontainers Mongo *(already wired in viewer/plugins-api)* | Service-layer Mockito test |
| Spring Boot (Maven) | `src/test/java/.../<svc>` | `spring-boot-starter-test` + `spring-security-test` *(add)* + WireMock *(already wired)* + testcontainers | `@WebMvcTest` controller test or `@DataMongoTest` repo test |
| Spring Cloud Gateway | `src/test/java/.../gateway` | `WebTestClient` from `spring-boot-starter-test` | One assertion per YAML route |
| UI | `src/__tests__/` (unit) + `e2e/` (Playwright, replacing Cypress) | Vitest + `@testing-library/react` + MSW | `route-guard/helpers/helpers.jsx` (`SWAP_CP` branching) |

---

*Next step suggestion: start with Phase 1.1 (CI test gating) — it's the smallest change with the largest cultural shift, and it makes every subsequent investment compound.*
