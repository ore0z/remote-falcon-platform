# Build context: monorepo root (..)
# Dockerfile path: apps/control-panel/Dockerfile
#
# This Dockerfile expects the build context to be the monorepo root so that
# libs/schema (the shared MongoDB entity model) can be installed into the
# image's local Maven repo before the service builds against it.

FROM ghcr.io/graalvm/native-image-community:21 AS build
WORKDIR /work
RUN microdnf install -y maven && microdnf clean all

# Install libs/schema first. Its own layer keeps the cache reusable across
# service rebuilds whenever only service code changes (vs. schema changes).
COPY libs/schema/pom.xml /work/libs/schema/pom.xml
COPY libs/schema/src /work/libs/schema/src
RUN mvn -f /work/libs/schema/pom.xml install -DskipTests -B

# Then build the service against the now-cached schema.
WORKDIR /work/svc
COPY apps/control-panel/pom.xml .
COPY apps/control-panel/src ./src
RUN mvn -Pnative -DskipTests package

FROM registry.access.redhat.com/ubi9/ubi-minimal:9.2
WORKDIR /usr/app
RUN microdnf install -y zlib && microdnf clean all
COPY --from=build /work/svc/target/remote-falcon-control-panel /usr/app/remote-falcon-control-panel
EXPOSE 8080
ENTRYPOINT ["/usr/app/remote-falcon-control-panel"]
