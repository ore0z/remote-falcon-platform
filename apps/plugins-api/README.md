[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=Remote-Falcon_remote-falcon-plugins-api)](https://sonarcloud.io/summary/new_code?id=Remote-Falcon_remote-falcon-plugins-api)

# Remote Falcon Plugins API

Remote Falcon Plugins API is a Quarkus-based Java 21 service that powers Remote Falcon integrations for show plugins.
It exposes REST endpoints used by the Remote Falcon Player/Plugins to sync playlists, manage viewer control modes,
process votes, update "what's playing", and more. Data is persisted in MongoDB and a native image is provided for
containerized deployments.

- Language/Runtime: Java 21, Quarkus
- Persistence: MongoDB (Panache)
- Observability: OpenTelemetry (OTLP exporter configurable)
- Packaging: Gradle, native image (GraalVM)
- CI/CD: GitHub Actions (build, SonarQube, release to Kubernetes)

## Contents

- Features
- API Overview
- Authentication
- Getting Started (Local Development)
- Configuration
- Build and Package
- Docker
- Kubernetes
- Testing
- CI/CD

## Features

- Sync playlists and PSA sequences from plugins into the Remote Falcon backend.
- Determine next playlist in queue and highest-voted playlist.
- Update "what's playing" and next scheduled sequence.
- Manage viewer control mode and preferences.
- Purge request queue and reset votes.
- Lightweight health endpoints for probes.

## API Overview

Base path: /
All endpoints require a valid show token header (see Authentication).

- GET /nextPlaylistInQueue → Next playlist in queue. Response: { nextPlaylist, playlistIndex }
- POST /updatePlaylistQueue → Updates queue state. Response: { message }
- POST /syncPlaylists → Sync available playlists and PSA sequences. Body: SyncPlaylistRequest. Response: { message }
- POST /updateWhatsPlaying → Update current playing sequence and manage PSAs. Body: UpdateWhatsPlayingRequest.
  Response: { message }
- POST /updateNextScheduledSequence → Update the next scheduled sequence. Body: UpdateNextScheduledRequest. Response: {
  message }
- GET /viewerControlMode → Current viewer control mode. Response: { message }
- GET /highestVotedPlaylist → Highest voted playlist details. Response: { playlistName, playlistIndex, ... }
- POST /pluginVersion → Report plugin version. Body: { version }. Response: { message }
- GET /remotePreferences → Remote preferences for the show. Response: RemotePreferenceResponse
- DELETE /purgeQueue → Purge current request queue. Response: { message }
- DELETE /resetAllVotes → Reset votes. Response: { message }
- POST /toggleViewerControl → Toggle viewer control. Response: { message }
- POST /updateViewerControl → Update viewer control settings. Body: ViewerControlRequest. Response: { message }
- POST /updateManagedPsa → Update managed PSA settings. Body: ManagedPSARequest. Response: { message }
- POST /fppHeartbeat → Heartbeat endpoint. No response body.
- GET /actuator/health → Liveness check. Response: { status: "UP" }

Models are defined under src/main/java/com/remotefalcon/plugins/api/model and complemented by Remote Falcon shared
library models.

## Authentication

All API calls (except possibly health) must include one of the following HTTP headers:

- showtoken: <token>
- remotetoken: <token>

The token is validated against the Show collection in MongoDB. Requests missing or with invalid tokens receive 401/404
responses. See ShowTokenFilter for details.

## Getting Started (Local Development)

Prerequisites:

- Java 21 (GraalVM not required for JVM dev mode)
- MongoDB instance and connection string

1) Clone the repo and navigate to the project directory.
2) Set MongoDB connection string for Quarkus. You can use either environment variable or JVM system property:

- Environment variable: QUARKUS_MONGODB_CONNECTION_STRING=mongodb://user:pass@host:27017/
- Or run with: ./gradlew quarkusDev -Dquarkus.mongodb.connection-string=mongodb://user:pass@host:27017/

3) Start in dev mode (live reload):

```
./gradlew quarkusDev
```

Quarkus Dev UI is available at http://localhost:8080/q/dev/ (dev mode only).

Make requests with a valid show token header:

```
curl -H "showtoken: <YOUR_TOKEN>" http://localhost:8080/remotePreferences
```

## Configuration

Key properties (src/main/resources/application.properties):

- quarkus.http.port: 8080
- quarkus.http.root-path: /
- quarkus.mongodb.database: remote-falcon
- quarkus.application.name: remote-falcon-plugins-api
- quarkus.http.cors: true (origins/methods/headers = *)
- quarkus.otel.metrics.enabled: true
- sequence.limit: 200 (maximum sequences in syncPlaylists)

At runtime, provide the Mongo connection string and optional OTLP endpoint via:

- System properties: -Dquarkus.mongodb.connection-string=... -Dquarkus.otel.exporter.otlp.endpoint=...
- Or environment variables (QUARKUS_MONGODB_CONNECTION_STRING for JVM; in the container Dockerfile uses
  MONGO_URI/OTEL_URI passed into system properties).

## Build and Package

JVM build:

```
./gradlew clean build
```

This produces build/quarkus-app/ artifacts.

Native image (requires GraalVM or container build):

```
./gradlew clean build -Dquarkus.native.enabled=true
```

Or container-based native build (no local GraalVM):

```
./gradlew clean build -Dquarkus.native.enabled=true -Dquarkus.native.container-build=true
```

## Docker

A multi-stage Dockerfile builds a native image.
Build and push (GitHub Actions does this automatically on main):

```
docker build -t ghcr.io/<owner>/<repo>:<tag> \
  --build-arg MONGO_URI="mongodb://user:pass@host:27017/" \
  --build-arg OTEL_URI="" \
  .
```

Run:

```
docker run -p 8080:8080 \
  -e MONGO_URI="mongodb://user:pass@host:27017/" \
  -e OTEL_URI="" \
  ghcr.io/<owner>/<repo>:<tag>
```

The container entrypoint forwards MONGO_URI and OTEL_URI into Quarkus system properties.

## Kubernetes

A parameterized manifest is provided under k8s/manifest.yml with:

- Deployment (probes pointing to /q/health endpoints)
- Service (ClusterIP, port 8080)
- Ingress (paths /remote-falcon-plugins-api and /remotefalcon/api)
- HPA (CPU-based autoscaling)

The Build and Release workflow replaces tokens and applies the manifest to the remote-falcon namespace. See
.github/workflows/build-and-release.yml.

## Testing

Run unit tests and generate coverage:

```
./gradlew test
```

A JaCoCo report is produced at build/reports/jacoco/test/html.

## CI/CD

- SonarQube analysis runs on pushes/PRs to main (.github/workflows/sonar.yml). Configure SONAR_TOKEN in repo secrets.
- Build and Release pipeline builds/pushes the container to GHCR and deploys to Kubernetes on merges to main. It uses
  DigitalOcean credentials and replaces tokens in k8s/manifest.yml.

## License

This project is part of Remote Falcon. If a LICENSE file is present in the repo, that license applies. Otherwise, please
contact the maintainers for licensing details.
