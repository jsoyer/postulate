#!/usr/bin/env bash
set -euo pipefail

# Development startup script for cv-api.
# Copies example configs if needed and starts the server with hot reload.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

if [ ! -f .env ]; then
    echo "No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "Please edit .env with your configuration, then re-run."
    exit 1
fi

if [ ! -f config/targets.yml ]; then
    echo "No config/targets.yml found. Copying from example..."
    cp config/targets.example.yml config/targets.yml
fi

echo "Starting cv-api in development mode..."
go run ./cmd/cv-api
