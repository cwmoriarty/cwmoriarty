#!/usr/bin/env bash
set -e

# ==============================================================================
# SynDirStat - SPK Assembler for Synology DSM 7
# Generates native Synology SPK packages for Package Center
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build"
BUILD_BIN_DIR="${BUILD_DIR}/bin"
PACKAGING_DIR="${ROOT_DIR}/packaging"
PACKAGES_OUTPUT="${REPO_ROOT}/packages/syndirstat"

mkdir -p "${PACKAGES_OUTPUT}"

build_spk() {
    local ARCH_NAME="$1"       # e.g., x86_64 or arm64
    local BINARY_SOURCE="$2"   # syndirstat-amd64 or syndirstat-arm64
    local SPK_ARCH_STRING="$3" # value in INFO file
    local OUTPUT_SPK="${PACKAGES_OUTPUT}/syn-dirstat-${ARCH_NAME}-1.0.0.spk"
    local WORK_DIR="${BUILD_DIR}/work_${ARCH_NAME}"

    echo ">>> Assembling SPK: ${OUTPUT_SPK} (Arch: ${ARCH_NAME})..."
    rm -rf "${WORK_DIR}"
    mkdir -p "${WORK_DIR}/package/bin"
    mkdir -p "${WORK_DIR}/package/ui"
    mkdir -p "${WORK_DIR}/scripts"
    mkdir -p "${WORK_DIR}/conf"

    # Copy binary
    cp "${BUILD_BIN_DIR}/${BINARY_SOURCE}" "${WORK_DIR}/package/bin/syndirstat"
    chmod +x "${WORK_DIR}/package/bin/syndirstat"

    # Copy UI
    cp -r "${PACKAGING_DIR}/ui/"* "${WORK_DIR}/package/ui/"
    chmod +x "${WORK_DIR}/package/ui/index.cgi"

    # Create package.tgz
    (cd "${WORK_DIR}/package" && tar -czf "${WORK_DIR}/package.tgz" *)

    # Generate INFO
    sed "s/{{ARCH}}/${SPK_ARCH_STRING}/g" "${PACKAGING_DIR}/INFO.template" > "${WORK_DIR}/INFO"

    # Copy icons, scripts, conf
    cp "${PACKAGING_DIR}/PACKAGE_ICON.PNG" "${WORK_DIR}/"
    cp "${PACKAGING_DIR}/PACKAGE_ICON_256.PNG" "${WORK_DIR}/"
    cp -r "${PACKAGING_DIR}/scripts/"* "${WORK_DIR}/scripts/"
    cp -r "${PACKAGING_DIR}/conf/"* "${WORK_DIR}/conf/"
    chmod +x "${WORK_DIR}/scripts/"*

    # Tar into final .spk
    (cd "${WORK_DIR}" && tar -cf "${OUTPUT_SPK}" \
        INFO \
        PACKAGE_ICON.PNG \
        PACKAGE_ICON_256.PNG \
        package.tgz \
        scripts \
        conf)

    echo "    Created: ${OUTPUT_SPK} ($(du -h "${OUTPUT_SPK}" | cut -f1))"
}

# 1. Build x86_64 (amd64) SPK
build_spk "x86_64" "syndirstat-amd64" "x86_64"

# 2. Build arm64 (aarch64) SPK
build_spk "arm64" "syndirstat-arm64" "arm64"

# 3. Build Universal/All architectures SPK (defaults to x86_64/noarch)
build_spk "all" "syndirstat-amd64" "all"

echo "======================================================"
echo " All Synology SPK packages generated:"
ls -lh "${PACKAGES_OUTPUT}"/*.spk
echo "======================================================"
