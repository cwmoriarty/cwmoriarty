#!/usr/bin/env bash
set -e

# ==============================================================================
# SynDirStat - Build Script
# Compiles React frontend and cross-compiles Go binaries for Synology architectures
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
BACKEND_DIR="${ROOT_DIR}/backend"
BUILD_BIN_DIR="${ROOT_DIR}/build/bin"

echo "======================================================"
echo " [1/3] Building React Frontend with Vite..."
echo "======================================================"
cd "${FRONTEND_DIR}"
npm run build

echo "======================================================"
echo " [2/3] Embedding Frontend into Go Backend..."
echo "======================================================"
rm -rf "${BACKEND_DIR}/cmd/syndirstat/dist"
mkdir -p "${BACKEND_DIR}/cmd/syndirstat/dist"
cp -r "${FRONTEND_DIR}/dist/"* "${BACKEND_DIR}/cmd/syndirstat/dist/"

echo "======================================================"
echo " [3/3] Cross-Compiling Go Binaries (CGO_ENABLED=0)..."
echo "======================================================"
mkdir -p "${BUILD_BIN_DIR}"

# 1. Linux x86_64 (amd64)
echo "  -> Building linux/amd64..."
cd "${BACKEND_DIR}"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -X main.AppVersion=1.0.0" \
    -o "${BUILD_BIN_DIR}/syndirstat-amd64" \
    ./cmd/syndirstat

# 2. Linux arm64 (aarch64)
echo "  -> Building linux/arm64..."
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build \
    -ldflags="-s -w -X main.AppVersion=1.0.0" \
    -o "${BUILD_BIN_DIR}/syndirstat-arm64" \
    ./cmd/syndirstat

# 3. Local Host binary (for instant testing)
echo "  -> Building local host binary..."
go build \
    -ldflags="-s -w -X main.AppVersion=1.0.0" \
    -o "${BUILD_BIN_DIR}/syndirstat-local" \
    ./cmd/syndirstat

echo "======================================================"
echo " Successfully compiled binaries:"
ls -lh "${BUILD_BIN_DIR}"
echo "======================================================"
