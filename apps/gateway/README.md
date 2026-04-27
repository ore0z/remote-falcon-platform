# Remote Falcon API Gateway

The single entry point for all backend traffic — Spring Cloud Gateway sitting in front of every backend service, handling path routing, header rewriting, filters, and rate limits.

| | |
|---|---|
| **Stack** | Spring Cloud Gateway, Java 17 (the only non-native service in the stack — runs as JVM JAR) |
| **Container port** | 8080 |
| **Replicas** | 2 |
| **Resources** | req 1000Mi / 750m CPU → lim 1250Mi / 1000m CPU (largest footprint in the cluster) |
| **Ingress** | `remotefalcon.com`, path prefix `/remote-falcon-gateway` |
| **Health probe** | `GET /actuator/health` |
| **Talks to** | All backend services (routing config in `application*.yml`) |

## What it does

- **Routes** incoming requests by path prefix to the right downstream service.
- **Rewrites paths** where the public path differs from the backend path (e.g. `/remotefalcon/api/...` → `apps/plugins-api`).
- **Applies filters** — headers, request/response transforms, rate limits, retries.
- **Bundles the OpenTelemetry Java agent** at image build (downloaded from upstream releases). This is the foundation for the cross-service tracing rollout in [`OBSERVABILITY-PLAN.md`](../../docs/OBSERVABILITY-PLAN.md).

## Routing surface

Routes are config-only — there's exactly one Java class (`Application`). Everything that matters lives in `src/main/resources/application*.yml`:

- `application.yml` — base route definitions
- `application-prod.yml` — prod-specific filters and rate limits
- `application-local.yml` — local dev overrides

A typo in any of these YAMLs ships to prod undetected today (no CI tests). Phase B5 of the consolidation plan adds `WebTestClient` smoke tests to catch this.

## Local development

```bash
mvn spring-boot:run
```

Talks to local backends started by the workspace `dev-up.sh`.

## Testing

- **Today:** zero tests. No `src/test/` directory.
- **Planned:** one assertion per route in `application-prod.yml` (Phase B5).

## Future

This service is a candidate for retirement (Phase E1). nginx-ingress already handles path routing; the gateway's filters and rate limits could move into the backends or into ingress annotations. Real cluster-cost win once the merges in Phase D have soaked.
