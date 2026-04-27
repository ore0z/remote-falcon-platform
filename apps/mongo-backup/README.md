# Remote Falcon Mongo Backup

Scheduled MongoDB backup service. Dumps the platform's Mongo database and pushes it to DigitalOcean Spaces (S3-compatible). The only thing standing between a Mongo failure and total data loss.

| | |
|---|---|
| **Stack** | Quarkus, Java 21 GraalVM **native image** |
| **Container port** | 8080 |
| **Replicas** | 1 |
| **Ingress** | `remotefalcon.com`, path prefix `/remote-falcon-mongo-backup` (forwarded headers enabled — used to trigger backups manually via authenticated POST) |
| **Health probe** | `GET /remote-falcon-mongo-backup/q/health{,/live,/ready}` |
| **Talks to** | MongoDB (read), DigitalOcean Spaces (write) |

## What it does

- Runs **scheduled `mongodump`-equivalent backups** of the `remote-falcon` Mongo database
- Streams the output to **DigitalOcean Spaces** (S3-compatible) under a dated key prefix
- Exposes a **trigger endpoint** for manual / on-demand backups, gated by `BACKUP_AUTH_TOKEN`
- Logs each run; failure paths surface via OpenTelemetry → Datadog/Grafana (when wired)

## Why this service is critical

Silent backup failure is **the only data-loss bug class in the stack** that's also genuinely irreversible. If `mongodump` fails or S3 PutObject silently 4xx's and nobody notices, the next time Mongo loses data there's nothing to restore from.

This service has **zero tests today**. The 276-LOC `MongoBackupService` is the highest-leverage untested code in the entire platform — covered as Phase C3.1 in [`CONSOLIDATION-PLAN.md`](../../docs/CONSOLIDATION-PLAN.md). Alerts on "backup not run in last 36 hours" and "S3 PutObject failed" are explicit asks in [`OBSERVABILITY-PLAN.md`](../../docs/OBSERVABILITY-PLAN.md).

## Configuration

Build-time:
- `MONGO_URI` (build-arg, baked into native image)
- `OTEL_URI` (build-arg)

Runtime (in-cluster Secrets):
- `mongodb-connection` → `MONGO_URI`
- `do-s3` → `AWS_ACCESS_KEY_ID`, `AWS_REGION`, `AWS_SECRET_ACCESS_KEY`
- `mongo-backup-auth-token` → `BACKUP_AUTH_TOKEN`

## Local development

```bash
./gradlew quarkusDev    # http://localhost:8080
```

Requires Mongo and (for full path coverage) S3-compatible credentials. LocalStack works for local S3.

## Testing

- **Today:** zero tests
- **Planned (Phase C3.1):** `MongoBackupServiceTest` with testcontainers Mongo + LocalStack S3. Asserts dump key format, S3 PutObject is called with the right bucket, retention/cleanup logic deletes old backups, failure paths log/alert. ~3 days of work — *highest-impact single test in the stack.*

## Key files

- `src/main/java/com/remotefalcon/.../MongoBackupService.java` — dump + upload + retention logic (276 LOC)
- `src/main/java/com/remotefalcon/.../resource/` — manual-trigger HTTP endpoint
