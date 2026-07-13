# cv-api — pure Go API frontend (auth, routing, business logic).
# No Python, no Make, no CV tooling — just the Go binary.
#
# Build:
#   docker build -t ghcr.io/jsoyer/cv-api:latest .
#   podman build -t ghcr.io/jsoyer/cv-api:latest .
#
# Build with version tag:
#   docker build --build-arg VERSION=1.2.3 -t ghcr.io/jsoyer/cv-api:1.2.3 .

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: build
# ─────────────────────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /build

# Cache dependency layer separately from source
COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
        -ldflags="-s -w -X main.version=${VERSION}" \
        -trimpath \
        -o cv-api ./cmd/cv-api

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: minimal runtime — pinned alpine for reproducibility
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:3.21

LABEL org.opencontainers.image.title="cv-api" \
      org.opencontainers.image.description="HTTP/WebSocket API frontend for the CV management system" \
      org.opencontainers.image.source="https://github.com/jsoyer/cv-api"

# wget for HEALTHCHECK; ca-certificates for outbound TLS; tzdata for time zones
RUN apk add --no-cache ca-certificates tzdata wget \
    && addgroup -S -g 1000 cvapi \
    && adduser  -S -u 1000 -G cvapi cvapi

COPY --from=builder /build/cv-api /usr/local/bin/cv-api
COPY --from=builder /build/config/targets.example.yml /etc/cv-api/targets.yml

USER cvapi
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["cv-api"]
