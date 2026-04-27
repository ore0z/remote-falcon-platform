# Remote Falcon Platform

Monorepo for the Remote Falcon platform.

Consolidation in progress — see `CONSOLIDATION-PLAN.md` and `OBSERVABILITY-PLAN.md`
in the `rf-build` workspace for the migration roadmap and current phase.

## Layout

- `apps/` — production services
- `libs/schema/` — shared Mongo schema (was `remote-falcon-library`)
- `ops/` — local dev stack and deployment tooling (added in later phases)
