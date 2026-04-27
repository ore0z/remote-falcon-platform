# Remote Falcon Platform

Monorepo for the Remote Falcon platform — the show-owner control panel, the public viewer experience, the FPP plugin API, and the supporting jobs and infrastructure that keep it all running.

## Layout

| | |
|---|---|
| [`apps/`](apps/) | Production services — see each subdirectory's README for details |
| [`libs/schema/`](libs/schema/) | Shared MongoDB schema, consumed by 5 of the 8 backend services |
| `ops/` | Local dev stack and deployment tooling *(landing in [Phase A3](docs/CONSOLIDATION-PLAN.md))* |
| [`docs/`](docs/) | Architecture, operational, and migration references |

## Services

| Service | Stack | Purpose |
|---|---|---|
| [`apps/ui`](apps/ui) | Vite + React | Frontend SPA — control panel + per-show viewer pages |
| [`apps/gateway`](apps/gateway) | Spring Cloud Gateway (JVM JAR) | Path routing + filters in front of every backend |
| [`apps/control-panel`](apps/control-panel) | Spring Boot 3 native | Authenticated REST + GraphQL for show owners |
| [`apps/viewer`](apps/viewer) | Quarkus native | Public viewer-facing API — request, vote, page stats |
| [`apps/plugins-api`](apps/plugins-api) | Quarkus native | API consumed by the FPP plugin on customer controllers |
| [`apps/external-api`](apps/external-api) | Spring Boot 3 native | Partner GraphQL surface |
| [`apps/mongo-backup`](apps/mongo-backup) | Quarkus native | Scheduled MongoDB → S3 backup |
| [`apps/account-archive`](apps/account-archive) | Quarkus native | Scheduled archive of stale accounts + cleanup of unverified signups |

## Documentation

All architecture, operational, and migration documentation lives in [`docs/`](docs/).

| Doc | Purpose | Lifespan |
|---|---|---|
| [`docs/SERVICES.md`](docs/SERVICES.md) | Operator's catalog: each service's deploy mechanics, secrets matrix, cluster prerequisites, bring-up order | Permanent |
| [`docs/TESTING.md`](docs/TESTING.md) | Per-service test inventory, cross-cutting findings, phased improvement plan | Permanent |
| [`docs/CONSOLIDATION-PLAN.md`](docs/CONSOLIDATION-PLAN.md) | Migration roadmap: 24 repos → 1 monorepo, 8 services → 5, no test gating → release-validated pipeline | Transient (~3 months) |
| [`docs/OBSERVABILITY-PLAN.md`](docs/OBSERVABILITY-PLAN.md) | Full-stack observability rollout: OpenTelemetry + Grafana Cloud + PostHog | Transient (~3 months) |

If you change something that affects deploy mechanics, secrets, test counts, or repo membership, update the relevant doc in the same change.

## Status

Consolidation in progress. Currently in **Phase A** of [`docs/CONSOLIDATION-PLAN.md`](docs/CONSOLIDATION-PLAN.md) — services have been imported via subtree-merge and the per-service workflows are still in place. Phases B (unified CI), C (test pyramid), D (service merges), and E (observability + cleanup) follow.

## Customer-facing repos (out-of-tree)

These ship code that runs *outside* the production cluster — on FPP show controllers, in viewer browsers, or as customer-installed tooling. They release independently and are deliberately *not* part of this monorepo:

- [`remote-falcon-plugin`](https://github.com/Remote-Falcon/remote-falcon-plugin) — FPP plugin (PHP + JS + shell)
- [`remote-falcon-viewer-page-js`](https://github.com/Remote-Falcon/remote-falcon-viewer-page-js) — CDN-served viewer-page scripts
- [`remote-falcon-page-templates`](https://github.com/Remote-Falcon/remote-falcon-page-templates) — default viewer-page HTML templates
- [`remote-falcon-mobile`](https://github.com/Remote-Falcon/remote-falcon-mobile) — Expo / React Native mobile app
- [`remote-falcon-deployment-wizard`](https://github.com/Remote-Falcon/remote-falcon-deployment-wizard) — customer-installable Node deployer
- [`remote-falcon-issue-tracker`](https://github.com/Remote-Falcon/remote-falcon-issue-tracker) — public bug/feature tracker + External API sample
