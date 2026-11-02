#!/usr/bin/env bash
set -e

# ==============================================================================
# SynDirStat - SPK Assembler for Synology DSM 7
# Generates native Synology SPK packages for Package Center
# Compatible with DSM 7 package parser (GNU POSIX tar, valid checksums, noarch)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build"
BUILD_BIN_DIR="${BUILD_DIR}/bin"
PACKAGING_DIR="${ROOT_DIR}/packaging"
PACKAGES_OUTPUT="${REPO_ROOT}/packages/syndirstat"

mkdir -p "${PACKAGES_OUTPUT}"

get_md5() {
    if command -v md5sum >/dev/null 2>&1; then
        md5sum "$1" | awk '{print $1}'
    else
        md5 -q "$1"
    fi
}

build_spk() {
    local ARCH_NAME="$1"       # e.g., x86_64, arm64, all
    local BINARY_SOURCE="$2"   # syndirstat-amd64 or syndirstat-arm64
    local SPK_ARCH_STRING="$3" # full architecture list for INFO
    local OUTPUT_SPK="${PACKAGES_OUTPUT}/syn-dirstat-${ARCH_NAME}-1.0.0.spk"
    local WORK_DIR="${BUILD_DIR}/work_${ARCH_NAME}"

    echo ">>> Assembling SPK: ${OUTPUT_SPK} (Target: ${ARCH_NAME})..."
    rm -rf "${WORK_DIR}"
    mkdir -p "${WORK_DIR}/package/bin"
    mkdir -p "${WORK_DIR}/package/ui/images"
    mkdir -p "${WORK_DIR}/scripts"
    mkdir -p "${WORK_DIR}/conf"

    # 1. Copy binary
    cp "${BUILD_BIN_DIR}/${BINARY_SOURCE}" "${WORK_DIR}/package/bin/syndirstat"
    chmod 755 "${WORK_DIR}/package/bin/syndirstat"

    # 2. Copy UI config and multi-resolution icons
    cp "${PACKAGING_DIR}/ui/config" "${WORK_DIR}/package/ui/config"
    cp -r "${PACKAGING_DIR}/ui/images/"* "${WORK_DIR}/package/ui/images/"

    # 3. Create package.tgz
    export COPYFILE_DISABLE=1
    python3 -c "
import sys
sys.path.insert(0, '${SCRIPT_DIR}')
from build_spk import make_package_tgz
make_package_tgz('${WORK_DIR}/package', '${WORK_DIR}/package.tgz')
"

    # 4. Compute package.tgz MD5 checksum
    local PKG_CHECKSUM
    PKG_CHECKSUM=$(get_md5 "${WORK_DIR}/package.tgz")
    echo "    package.tgz checksum: ${PKG_CHECKSUM}"

    # 5. Generate INFO with dynamic checksum and architectures
    sed \
        -e "s/{{ARCH}}/${SPK_ARCH_STRING}/g" \
        -e "s/{{CHECKSUM}}/${PKG_CHECKSUM}/g" \
        "${PACKAGING_DIR}/INFO.template" > "${WORK_DIR}/INFO"

    # 6. Copy icons, scripts, conf
    cp "${PACKAGING_DIR}/PACKAGE_ICON.PNG" "${WORK_DIR}/"
    cp "${PACKAGING_DIR}/PACKAGE_ICON_256.PNG" "${WORK_DIR}/"
    cp -r "${PACKAGING_DIR}/scripts/"* "${WORK_DIR}/scripts/"
    cp -r "${PACKAGING_DIR}/conf/"* "${WORK_DIR}/conf/"
    chmod 755 "${WORK_DIR}/scripts/"*

    # 7. Assemble SPK archive as POSIX GNU tar
    python3 "${SCRIPT_DIR}/build_spk.py" "${WORK_DIR}" "${OUTPUT_SPK}"

    echo "    Created: ${OUTPUT_SPK} ($(du -h "${OUTPUT_SPK}" | cut -f1))"
    file "${OUTPUT_SPK}"
}

# 1. Build x86_64 SPK with comprehensive DSM 7 x86 platform identifiers
X86_ARCHS="x86_64 apollolake avoton braswell broadwell broadwellnk bromolow cedarview denverton dockerx64 geminilake grantley purley kvmx64 v1000 r1000 epydc epydc_7002 x86"
build_spk "x86_64" "syndirstat-amd64" "${X86_ARCHS}"

# 2. Build ARM64 SPK with comprehensive DSM 7 ARM platform identifiers
ARM64_ARCHS="arm64 aarch64 rtd1296 rtd1619 rtd1619b armada37xx alpine alpine4k"
build_spk "arm64" "syndirstat-arm64" "${ARM64_ARCHS}"

# 3. Build Universal / All models SPK (noarch)
build_spk "all" "syndirstat-amd64" "noarch"

echo "======================================================"
echo " All Synology SPK packages generated:"
ls -lh "${PACKAGES_OUTPUT}"/*.spk
echo "======================================================"
