# ops/

Local development tooling for the Remote Falcon stack. Brings up every service from in-tree Dockerfiles, points them at a local MongoDB, and fronts everything with an nginx reverse-proxy that mirrors the production ingress paths — so UI/API URLs are identical to prod.

| File | Purpose |
|---|---|
| [`dev-up.sh`](dev-up.sh) | Wrapper around Docker Compose: `up`, `down`, `logs`, `health`, `rebuild`, `shell`, etc. |
| [`docker-compose.dev.yml`](docker-compose.dev.yml) | Stack definition: 9 services + Mongo + nginx ingress |
| [`dev-nginx.conf`](dev-nginx.conf) | nginx config that mimics the prod ingress path routing |
| [`.env.dev.example`](.env.dev.example) | Environment template — copied to `.env.dev` on first run |

## Two operating modes

| | Services | Use when |
|---|---|---|
| **platform** *(default)* | mongo + ui + control-panel + viewer + plugins-api + ingress + gateway + external-api + mongo-backup + account-archive | You're working on the SaaS platform we operate |
| **core** *(`--core` flag)* | mongo + ui + control-panel + viewer + plugins-api + ingress | You're testing the self-host shape (matches the deployment-wizard / developer-files compose) |

The split is by Docker Compose [profile](https://docs.docker.com/compose/profiles/). Platform-only services (`gateway`, `external-api`, `mongo-backup`, `account-archive`) are tagged `profiles: [platform]` and only start when the platform profile is active.

In core mode, `dev-nginx.conf` will return 502 on routes for platform-only services (e.g. `/remote-falcon-mongo-backup`) — that is intended behaviour: those services aren't supposed to exist in self-host.

## Quick start

```bash
# Bootstraps .env.dev from .env.dev.example on first run, then builds + starts.
./dev-up.sh up                # platform mode (default)
./dev-up.sh up --core         # self-host mode

# Smoke-test every running service
./dev-up.sh health            # mode flag implicit; pass --core if your stack is core
./dev-up.sh health --core

# Rebuild one service after a code change
./dev-up.sh rebuild viewer

# Tail logs (all, or one service)
./dev-up.sh logs
./dev-up.sh logs control-panel

# Stop everything (mongo data preserved)
./dev-up.sh down

# Stop + drop the mongo volume (DESTRUCTIVE)
./dev-up.sh nuke
```

The `--core` flag must match the mode that brought the stack up. Mixing modes between commands (e.g. `up` in platform, then `down --core`) can leave Compose state inconsistent.

## Endpoints (both modes)

| | URL |
|---|---|
| **Browser entry point** | http://localhost:8080 (nginx ingress) |
| Mongo | `mongodb://localhost:27017/remote-falcon` |

Direct service ports (bypass nginx):

| Service | Port | Mode |
|---|---|---|
| ui | 3000 | both |
| control-panel | 8081 | both |
| viewer | 8082 | both |
| plugins-api | 8083 | both |
| external-api | 8084 | platform only |
| mongo-backup | 8085 | platform only |
| account-archive | 8086 | platform only |
| gateway | 8087 | platform only |

## First build is slow

The Quarkus services (`viewer`, `plugins-api`, `account-archive`, `mongo-backup`) compile to GraalVM native images — 5–10 minutes per service. Stack-wide initial build is 30+ minutes in platform mode, meaningfully faster in core mode (5 services instead of 9). Subsequent builds cache.

For tight inner-loop work on a single service, prefer running that service natively (`./gradlew quarkusDev`, `mvn spring-boot:run`, `npm run dev`) against the dockerized Mongo at `localhost:27017`. Skips the native-image build entirely.

## Bootstrap order for monorepo builds

The Gradle services consume `libs/schema` via `mavenLocal()` (full Gradle composite is deferred to Phase B). Run `mvn install -pl libs/schema -am` from the monorepo root once before any local Gradle build. The compose stack handles this transparently per-service via each Dockerfile's build flow.
