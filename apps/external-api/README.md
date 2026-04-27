# Remote Falcon External API

The third-party / partner integration surface — a GraphQL API that external systems use to read and act on show state. Authenticated by API key + JWT (HS256) rather than the user-facing JWT scheme.

| | |
|---|---|
| **Stack** | Spring Boot 3, Java 21 GraalVM **native image** |
| **Container port** | 8080 |
| **Replicas** | 1 |
| **Ingress** | `remotefalcon.com`, paths `/remote-falcon-external-api(...)` **and** `/remotefalcon/api/external(...)` (rewrite-target) |
| **Health probe** | `GET /actuator/health` |
| **Talks to** | MongoDB |

## What it does

- Exposes a **GraphQL surface** for partner integrations — primarily `showDetails` queries (preferences, currently-playing, next-up).
- Validates partner JWTs signed with the show owner's `secretKey`, payload `{ accessToken: <show's accessToken> }`.
- Issues read access to the same `Show` documents the rest of the platform writes — same `libs/schema` types.

A working partner integration sample (PHP + jQuery) lives in the [`remote-falcon-issue-tracker`](https://github.com/Remote-Falcon/remote-falcon-issue-tracker) repo under `external-api-sample/`.

## API surface

- **GraphQL**: `/remote-falcon-external-api/graphql`
- **Actuator**: `/remote-falcon-external-api/actuator/health`

Show owners obtain their `accessToken` and `secretKey` from the External API page in the control-panel UI. The partner signs a JWT (HS256, payload `{ accessToken }`) with the secret key and sends it as `Authorization: Bearer <jwt>`.

## Authentication

`spring-cloud-gateway`-style filter chain validates:
1. The `Authorization` header is present and well-formed
2. The JWT signature matches the secretKey on the resolved show
3. The payload `accessToken` matches the show's stored token

Request fails with 401/403 if any check fails.

`DozerRuntimeHints` is the only guard against GraalVM native-image reflection breakage in this service — itself untested.

## In-cluster secrets

Single Secret `remote-falcon-external-api` with key `mongo-uri`. Unlike viewer/plugins-api/account-archive, this service uses **runtime env** for Mongo — no build-arg baking — so rotations don't require a rebuild.

## Local development

```bash
mvn spring-boot:run
```

Requires a Mongo instance. The workspace `dev-up.sh` provides one.

## Testing

- **Today:** zero active tests. One commented-out `Mocks.java` references dead packages. No `spring-graphql-test` or `spring-security-test` deps wired.
- **Planned (Phase C):** delete the commented-out file (Phase C2.1); add `@WebMvcTest` coverage for the JWT filter + repo-level `@DataMongoTest` (Phase C3 follow-on).

## Key directories

- `src/main/java/com/remotefalcon/externalapi/controller/` — GraphQL controller
- `src/main/java/com/remotefalcon/externalapi/service/` — query/mutation services
- `src/main/java/com/remotefalcon/externalapi/filter/` — JWT/API-key filter chain
- `src/main/java/com/remotefalcon/externalapi/config/` — `DozerRuntimeHints` (native-image reflection registration)
