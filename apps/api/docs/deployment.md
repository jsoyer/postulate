# Deployment Guide

This guide covers deploying cv-api in various environments, from local development to production with HTTPS.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Single Container](#docker-single-container)
- [Docker Compose (Development)](#docker-compose-development)
- [Docker Compose with Caddy (Production)](#docker-compose-with-caddy-production)
- [Kubernetes](#kubernetes)
- [Environment Variables Reference](#environment-variables-reference)
- [Secrets Management](#secrets-management)
- [Health Checks](#health-checks)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Production Checklist](#production-checklist)

---

## Prerequisites

### System Requirements

- **OS**: Linux, macOS, or Windows (via WSL2)
- **Memory**: Minimum 512 MB, recommended 2 GB
- **Disk**: 100 MB for application, plus space for CV project
- **Network**: Outbound access to CV project filesystem

### Development Setup

- Go 1.24+ (for local development)
- GNU Make
- Docker & Docker Compose (for containerized deployment)
- OpenSSL (for generating secrets)

### Verify Installation

```bash
go version                    # Go 1.24+
make --version               # GNU Make
docker --version             # Docker
docker compose --version     # Docker Compose
openssl version              # OpenSSL
```

---

## Local Development

### Setup

```bash
git clone https://github.com/jsoyer/cv-api.git
cd cv-api

# Copy configuration templates
cp .env.example .env
cp config/targets.example.yml config/targets.yml

# Edit .env with your values
export CV_PATH=/path/to/your/CV
export AUTH_SECRET=$(openssl rand -base64 32)
export AUTH_PASSWORD=your_secure_password

# Add these to .env
```

### Running

```bash
# Development mode (with hot reload)
make dev

# Or build and run binary
make build
./cv-api

# API listens on http://localhost:3001
```

### Testing

```bash
# Run all tests
make test

# Run specific test package
go test ./internal/auth -v -race

# Run with coverage
go test ./... -cover
```

### Debugging

```bash
# Enable verbose logging (in main.go, adjust slog.LevelInfo)
# Run with verbose output
RUST_LOG=debug make dev

# Monitor requests with curl
curl -v http://localhost:3001/health

# Follow server logs
tail -f cv-api.log
```

---

## Docker Single Container

For simple single-instance deployment or testing.

### Build Image

```bash
docker build -t cv-api:latest .
docker build -t cv-api:1.0.0 .  # with version tag
```

### Run Container

```bash
docker run -d \
  --name cv-api \
  -p 3001:3001 \
  -v /path/to/CV:/cv:ro \
  -e CV_PATH=/cv \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_USERNAME=jerome \
  -e AUTH_PASSWORD=changeme \
  -e API_KEYS="$(openssl rand -base64 32)" \
  cv-api:latest
```

### Volume Mounts

| Host Path | Container Path | Mode | Purpose |
|-----------|----------------|------|---------|
| `/path/to/CV` | `/cv` | `ro` | CV project (read-only for safety) |
| `/etc/cv-api/targets.yml` | `/etc/cv-api/targets.yml` | `ro` | Target allowlist (optional) |
| `/var/log` | `/var/log` | `rw` | Logs (optional, container writes to stdout) |

**Note**: Some Make targets write files (e.g., `apply`, `tailor`). To allow writes, mount without `:ro` but understand the security implications:

```bash
docker run -d \
  --name cv-api \
  -v /path/to/CV:/cv:rw \  # Allow writes
  -e CV_PATH=/cv \
  ...
```

### Container Security

The provided `Dockerfile` includes:

- **Non-root user**: Runs as `cvapi` (uid 1000) instead of root
- **Minimal image**: Multi-stage build excludes development dependencies
- **No shell**: No bash/sh in runtime image (prevents shell escape exploits)
- **Healthcheck**: Built-in `healthcheck` to monitor liveness

Example healthcheck:

```bash
docker run ... --health-cmd='curl -f http://localhost:3001/health' ...
```

### Environment Variables

Pass via `-e` flag:

```bash
docker run ... \
  -e CV_PATH=/cv \
  -e AUTH_SECRET=... \
  -e AUTH_PASSWORD=... \
  ...
```

Or via `.env` file (must be in container working directory):

```bash
docker run ... --env-file .env ...
```

### Check Logs

```bash
# View recent logs
docker logs cv-api

# Follow logs in real-time
docker logs -f cv-api

# View logs from 1 hour ago
docker logs --since 1h cv-api
```

### Stop & Remove

```bash
docker stop cv-api
docker rm cv-api
```

---

## Docker Compose (Development)

For local development with multiple services.

### File Structure

```
.
├── docker-compose.yml       (provided)
├── .env                      (created from .env.example)
├── config/targets.yml        (created from targets.example.yml)
├── caddy/Caddyfile          (for HTTPS, optional)
└── /path/to/CV/             (volume mount)
```

### Setup

```bash
# Copy templates
cp .env.example .env
cp config/targets.example.yml config/targets.yml

# Edit .env with your values
# - CV_PATH: path to your CV project
# - AUTH_SECRET: random 32+ char string
# - AUTH_PASSWORD: your password
# - API_KEYS: optional API keys

# Review docker-compose.yml
cat docker-compose.yml
```

### Start Services

```bash
# Start all services in background
docker compose up -d

# Or start in foreground (see logs)
docker compose up

# Start specific service
docker compose up -d cv-api
```

### Check Status

```bash
# List running services
docker compose ps

# View service logs
docker compose logs cv-api
docker compose logs -f cv-api

# View all logs
docker compose logs -f
```

### Stop Services

```bash
# Stop all services
docker compose down

# Stop but keep volumes
docker compose stop

# Stop and remove volumes
docker compose down -v
```

---

## Docker Compose with Caddy (Production)

For production with HTTPS, use Caddy reverse proxy.

### Architecture

```
Internet (HTTPS)
    ↓
Caddy (port 443, TLS termination)
    ↓ (internal network, HTTP)
cv-api (port 3001, not exposed)
    ↓ (volume mount)
CV project (/cv)
```

### Prerequisites

- A domain name (e.g., `cv.example.com`)
- DNS pointing to your server IP
- Ports 80 and 443 accessible (for Let's Encrypt)

### Setup

```bash
# 1. Copy configuration
cp .env.example .env
cp config/targets.example.yml config/targets.yml

# 2. Edit .env
# - Set CV_PATH, AUTH_SECRET, AUTH_PASSWORD, API_KEYS
# - Set COOKIE_DOMAIN=cv.example.com (your domain)
# - Set COOKIE_SECURE=true (requires HTTPS)

# 3. Edit caddy/Caddyfile
# Replace :443 with your domain:
#   cv.example.com {
#       reverse_proxy cv-api:3001
#   }

# 4. Start services
docker compose up -d
```

### Caddyfile Configuration

```caddyfile
# caddy/Caddyfile
cv.example.com {
    # Reverse proxy to cv-api
    reverse_proxy cv-api:3001

    # Enable HTTP/2
    encode gzip
}
```

For multiple subdomains:

```caddyfile
cv.example.com {
    reverse_proxy cv-api:3001
}

*.cv.example.com {
    reverse_proxy cv-api:3001
}
```

### Let's Encrypt HTTPS

Caddy automatically:
1. Generates HTTPS certificate from Let's Encrypt
2. Renews certificate 30 days before expiry
3. Redirects HTTP → HTTPS

No manual certificate management needed!

### Verify HTTPS

```bash
# Test HTTPS access
curl https://cv.example.com/health

# Check certificate
curl -vI https://cv.example.com/health
```

### Environment Variables for Production

```bash
# .env (production)
CV_PATH=/path/to/CV
PORT=3001
AUTH_SECRET=<random 32+ chars>
AUTH_USERNAME=jerome
AUTH_PASSWORD=<strong password>
AUTH_TOTP_SECRET=<optional TOTP secret>
API_KEYS=<api_key1>,<api_key2>
COOKIE_DOMAIN=cv.example.com
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://cv.example.com
```

---

## Kubernetes

For cloud deployment with auto-scaling and high availability.

### Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, or local k3s)
- `kubectl` configured to access cluster
- Docker image pushed to registry (Docker Hub, ECR, GCR)

### Docker Image Registry

Push image to registry:

```bash
# Build image
docker build -t myregistry/cv-api:1.0.0 .

# Login to registry
docker login myregistry

# Push image
docker push myregistry/cv-api:1.0.0
```

### Kubernetes Manifests

Create `k8s/` directory with YAML manifests:

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: cv-api

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cv-api-secrets
  namespace: cv-api
type: Opaque
stringData:
  AUTH_SECRET: your_secret_here
  AUTH_PASSWORD: your_password_here
  API_KEYS: key1,key2

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cv-api
  namespace: cv-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cv-api
  template:
    metadata:
      labels:
        app: cv-api
    spec:
      containers:
      - name: cv-api
        image: myregistry/cv-api:1.0.0
        ports:
        - containerPort: 3001
        env:
        - name: CV_PATH
          value: /cv
        - name: AUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: cv-api-secrets
              key: AUTH_SECRET
        - name: AUTH_PASSWORD
          valueFrom:
            secretKeyRef:
              name: cv-api-secrets
              key: AUTH_PASSWORD
        - name: API_KEYS
          valueFrom:
            secretKeyRef:
              name: cv-api-secrets
              key: API_KEYS
        volumeMounts:
        - name: cv-volume
          mountPath: /cv
          readOnly: true
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 10
      volumes:
      - name: cv-volume
        persistentVolumeClaim:
          claimName: cv-pvc

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: cv-api
  namespace: cv-api
spec:
  selector:
    app: cv-api
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: LoadBalancer

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cv-api
  namespace: cv-api
spec:
  rules:
  - host: cv.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: cv-api
            port:
              number: 3001
```

### Deploy to Kubernetes

```bash
# Create namespace and deploy
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# Check deployment status
kubectl get deployments -n cv-api
kubectl get pods -n cv-api
kubectl logs -f deployment/cv-api -n cv-api

# Port forward for local testing
kubectl port-forward svc/cv-api 3001:3001 -n cv-api
```

---

## Environment Variables Reference

### Required Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CV_PATH` | — | Path to CV project directory (must exist) |
| `AUTH_SECRET` | — | JWT signing secret (min 32 characters, random) |
| `AUTH_PASSWORD` | — | Web login password |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server listen port |
| `AUTH_USERNAME` | `admin` | Web login username |
| `AUTH_TOTP_SECRET` | — | Base32-encoded TOTP secret (enables 2FA) |
| `API_KEYS` | — | Comma-separated API keys for TUI clients |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins (comma-separated) |
| `TARGETS_FILE` | `config/targets.yml` | Path to target allowlist |
| `MAX_CONCURRENT` | `3` | Max concurrent Make jobs |
| `COOKIE_DOMAIN` | `localhost` | Cookie domain (set to hostname in production) |
| `COOKIE_SECURE` | `false` | Require HTTPS for cookies (set `true` in production) |

### Example .env File

```bash
# Required
CV_PATH=/home/jerome/projects/CV
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_PASSWORD=MySecurePassword123!

# Optional
PORT=3001
AUTH_USERNAME=jerome
ALLOWED_ORIGINS=http://localhost:3000,https://cv.example.com
API_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32)
COOKIE_DOMAIN=cv.example.com
COOKIE_SECURE=true
MAX_CONCURRENT=5
```

---

## Secrets Management

### Development (Local)

Use `.env` file (excluded from git):

```bash
# .env (never commit this)
CV_PATH=/path/to/CV
AUTH_SECRET=your_super_secret_key_minimum_32_characters
AUTH_PASSWORD=your_password
API_KEYS=key1,key2
```

Load in shell:

```bash
export $(cat .env | xargs)
make dev
```

### Production (Docker)

Use Docker secrets or environment files:

```bash
# Option 1: Environment file
docker run --env-file /secure/location/.env ...

# Option 2: Docker secrets (Swarm)
docker secret create auth_secret /secure/location/secret.txt
docker service create ... --secret auth_secret ...

# Option 3: Docker Compose (development)
docker compose up -d  # uses .env file
```

### Production (Kubernetes)

Use Kubernetes Secrets:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: cv-api-secrets
type: Opaque
stringData:
  AUTH_SECRET: your_secret_here
  AUTH_PASSWORD: your_password_here
  API_KEYS: key1,key2
```

Reference in pod:

```yaml
env:
- name: AUTH_SECRET
  valueFrom:
    secretKeyRef:
      name: cv-api-secrets
      key: AUTH_SECRET
```

### HashiCorp Vault (Enterprise)

For enterprise deployments:

```bash
# Authenticate to Vault
vault login -method=kubernetes

# Retrieve secret
AUTH_SECRET=$(vault kv get -field=AUTH_SECRET secret/cv-api/prod)

# Export and start
export AUTH_SECRET
./cv-api
```

### Best Practices

1. **Never commit secrets** to version control
2. **Use strong secrets**: `openssl rand -base64 32` (min 32 chars)
3. **Rotate secrets** periodically (quarterly or on compromise)
4. **Audit access**: Log who/when accessed secrets
5. **Principle of least privilege**: Grant access only to what's needed
6. **Separate by environment**: Dev, staging, prod secrets are different

---

## Health Checks

### Liveness Probe

```bash
curl http://localhost:3001/health
# Response: {"status":"ok"}
```

For Docker:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

For Kubernetes:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe

Currently, liveness and readiness are the same (no warm-up needed).

---

## Monitoring & Logging

### Structured Logging

All logs are JSON to stdout:

```json
{"time":"2025-03-08T10:30:15Z","level":"INFO","msg":"cv-api listening","addr":":3001"}
{"time":"2025-03-08T10:30:20Z","level":"INFO","msg":"auth success","username":"jerome","ip":"127.0.0.1"}
{"time":"2025-03-08T10:30:25Z","level":"ERROR","msg":"target not in allowlist","target":"danger","ip":"127.0.0.1"}
```

### View Logs

```bash
# Live logs (all services)
docker compose logs -f

# Single service
docker compose logs -f cv-api

# Follow Kubernetes logs
kubectl logs -f deployment/cv-api -n cv-api

# Parse JSON logs with jq
docker compose logs cv-api | jq '.level, .msg'
```

### Log Aggregation

For production, use:

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Grafana Loki** (log aggregation)
- **Splunk** (enterprise logging)
- **CloudWatch** (AWS)
- **Stackdriver** (GCP)

Example Promtail config (Loki):

```yaml
scrape_configs:
  - job_name: cv-api
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: cv-api
        action: keep
```

### Metrics (Future)

Consider integrating Prometheus:

```bash
# (Not yet implemented, planned for v2)
GET /metrics
# Prometheus format
# cv_api_request_duration_seconds_bucket{le="0.1",path="/api/applications"}
# cv_api_active_jobs_total{target="fetch"}
```

---

## Backup & Recovery

### What to Backup

1. **CV Project** (`/path/to/CV`)
   - Contains all data (applications/, *.yml files)
   - Most important: back up daily

2. **Configuration** (`.env`, `config/targets.yml`)
   - Contains secrets and configuration
   - Back up whenever you change these

### Backup Strategy

```bash
#!/bin/bash
# Daily backup script

BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d)

# Back up CV project
tar -czf "$BACKUP_DIR/cv-$DATE.tar.gz" /path/to/CV

# Back up configuration (without .env, which is local)
tar -czf "$BACKUP_DIR/cv-api-config-$DATE.tar.gz" config/targets.yml

# Keep last 30 days
find "$BACKUP_DIR" -name "cv-*.tar.gz" -mtime +30 -delete

# (Optional) Upload to S3
# aws s3 cp "$BACKUP_DIR/cv-$DATE.tar.gz" s3://my-bucket/backups/
```

Schedule via cron:

```bash
crontab -e
# Add: 0 2 * * * /path/to/backup.sh  # Daily at 2 AM
```

### Recovery

```bash
# Restore CV project
tar -xzf /backup/cv-20250308.tar.gz -C /

# Verify
ls /path/to/CV/applications/
```

---

## Production Checklist

Before deploying to production:

- [ ] **Secrets**: All sensitive values in environment, never hardcoded
- [ ] **HTTPS**: Caddy or reverse proxy with TLS enabled
- [ ] **Domain**: DNS configured and pointing to server IP
- [ ] **Firewall**: Only ports 80/443 exposed (or specific port)
- [ ] **Auth**: `COOKIE_SECURE=true`, `COOKIE_DOMAIN=your.domain`
- [ ] **Rate Limits**: Configured for expected traffic
- [ ] **Monitoring**: Logs aggregated, health checks configured
- [ ] **Backups**: Automated backup script running daily
- [ ] **Testing**: Load test cv-api with expected traffic
- [ ] **Documentation**: Team knows deployment process
- [ ] **Runbook**: Incident response procedure documented
- [ ] **Disaster Recovery**: Recovery procedure tested
- [ ] **Security**: All security headers enabled, CORS configured
- [ ] **Performance**: Memory/CPU limits set, no memory leaks observed
- [ ] **Updates**: Plan for Go and dependency updates

### Pre-Production Testing

```bash
# Load test (using Apache Bench or similar)
ab -n 1000 -c 10 http://localhost:3001/health

# Stress test concurrent jobs
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/actions/fetch \
    -H "X-API-Key: test" \
    -d '{"args":{"url":"https://example.com"}}' &
done
wait

# Monitor resource usage
docker stats
```

