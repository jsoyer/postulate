.PHONY: build build-runner build-all run dev dev-local test lint fmt deps clean \
        image-api image-runner images push-api push-runner push \
        compose compose-down compose-logs help

BINARY      := cv-api
PKG_API     := ./cmd/cv-api
PKG_RUNNER  := ./cmd/cv-runner

# Container tool — override with: make images CONTAINER_TOOL=podman
# Works with: docker, podman (4.x+)
CONTAINER_TOOL ?= docker

# Image registry and tags
REGISTRY  ?= ghcr.io/jsoyer
VERSION   ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
TAG_API   ?= $(REGISTRY)/cv-api:$(VERSION)
TAG_RUNNER ?= $(REGISTRY)/cv-runner:$(VERSION)

# CV project path — required for cv-runner build (provides requirements.txt)
# Set via: CV_PATH=/path/to/CV make image-runner
CV_PATH ?=

# ── Go ────────────────────────────────────────────────────────────────────────

build: ## Build cv-api binary
	go build -ldflags="-s -w -X main.version=$(VERSION)" -trimpath -o $(BINARY) $(PKG_API)

build-runner: ## Build cv-runner binary
	go build -ldflags="-s -w -X main.version=$(VERSION)" -trimpath -o cv-runner $(PKG_RUNNER)

build-all: build build-runner ## Build both binaries

run: build ## Build and run cv-api locally
	./$(BINARY)

dev-local: ## Run cv-api directly with go run (no container)
	go run $(PKG_API)

test: ## Run all tests with race detector
	go test ./... -race -cover -count=1

test-short: ## Run tests without coverage (faster)
	go test ./... -count=1

lint: ## Run golangci-lint
	golangci-lint run ./...

fmt: ## Format code with gofumpt
	gofumpt -l -w .

deps: ## Tidy and verify Go modules
	go mod tidy && go mod verify

clean: ## Remove binaries and Go cache
	rm -f $(BINARY) cv-runner
	go clean -cache

# ── Container images ──────────────────────────────────────────────────────────

image-api: ## Build cv-api image
	$(CONTAINER_TOOL) build \
		--build-arg VERSION=$(VERSION) \
		-t $(TAG_API) \
		-f Dockerfile .

image-runner: ## Build cv-runner image (requires CV_PATH)
	@test -n "$(CV_PATH)" || (echo "ERROR: CV_PATH is required. Usage: make image-runner CV_PATH=/path/to/CV" && exit 1)
	$(CONTAINER_TOOL) build \
		--build-arg VERSION=$(VERSION) \
		--build-context cv=$(CV_PATH) \
		-t $(TAG_RUNNER) \
		-f Dockerfile.runner .

images: ## Build both images (requires CV_PATH)
	$(MAKE) image-api
	$(MAKE) image-runner

push-api: image-api ## Build and push cv-api image
	$(CONTAINER_TOOL) push $(TAG_API)

push-runner: image-runner ## Build and push cv-runner image (requires CV_PATH)
	$(CONTAINER_TOOL) push $(TAG_RUNNER)

push: ## Build and push both images (requires CV_PATH)
	$(MAKE) push-api
	$(MAKE) push-runner

# ── Docker / Podman Compose ───────────────────────────────────────────────────

dev: ## Start development stack with hot-reload (requires CV_PATH)
	@test -n "$(CV_PATH)" || (echo "ERROR: CV_PATH is required. Usage: make dev CV_PATH=/path/to/CV" && exit 1)
	CV_PATH=$(CV_PATH) $(CONTAINER_TOOL) compose -f docker-compose.dev.yml up --build

compose: ## Start production stack (requires CV_PATH + .env)
	@test -n "$(CV_PATH)" || (echo "ERROR: CV_PATH is required. Usage: make compose CV_PATH=/path/to/CV" && exit 1)
	CV_PATH=$(CV_PATH) $(CONTAINER_TOOL) compose up -d --build

compose-down: ## Stop all compose services
	$(CONTAINER_TOOL) compose down

compose-logs: ## Follow compose logs
	$(CONTAINER_TOOL) compose logs -f

# ── Help ──────────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
