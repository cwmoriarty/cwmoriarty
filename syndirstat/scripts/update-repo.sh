#!/usr/bin/env bash
set -e

# ==============================================================================
# SynDirStat - Community Package Repository Generator
# Generates repository index and metadata for Synology Package Center
# Hosted on https://cpan.zip (cwmoriarty/cwmoriarty)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"
PACKAGES_DIR="${REPO_ROOT}/packages/syndirstat"
REPO_DIR="${REPO_ROOT}/repository"
BASE_URL="https://cpan.zip"
RELEASE_BASE="https://github.com/cwmoriarty/cwmoriarty/releases/download/v1.0.0"

mkdir -p "${REPO_DIR}"

echo ">>> Calculating SPK checksums..."
get_md5() {
    if command -v md5sum >/dev/null 2>&1; then
        md5sum "$1" | awk '{print $1}'
    else
        md5 -q "$1"
    fi
}

get_sha256() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    else
        shasum -a 256 "$1" | awk '{print $1}'
    fi
}

X86_SPK="${PACKAGES_DIR}/syn-dirstat-x86_64-1.0.0.spk"
ARM_SPK="${PACKAGES_DIR}/syn-dirstat-arm64-1.0.0.spk"
ALL_SPK="${PACKAGES_DIR}/syn-dirstat-all-1.0.0.spk"

X86_MD5=$(get_md5 "${X86_SPK}")
ARM_MD5=$(get_md5 "${ARM_SPK}")
ALL_MD5=$(get_md5 "${ALL_SPK}")

X86_SHA256=$(get_sha256 "${X86_SPK}")
ARM_SHA256=$(get_sha256 "${ARM_SPK}")
ALL_SHA256=$(get_sha256 "${ALL_SPK}")

X86_SIZE=$(stat -f%z "${X86_SPK}" 2>/dev/null || stat -c%s "${X86_SPK}")
ARM_SIZE=$(stat -f%z "${ARM_SPK}" 2>/dev/null || stat -c%s "${ARM_SPK}")
ALL_SIZE=$(stat -f%z "${ALL_SPK}" 2>/dev/null || stat -c%s "${ALL_SPK}")

echo ">>> Generating repository/packages.json & packages.json..."
cat <<EOF > "${REPO_DIR}/packages.json"
[
  {
    "package": "syn-dirstat",
    "version": "1.0.0-0001",
    "dsm_min_ver": "7.0-40000",
    "name": "SynDirStat",
    "desc": "Free, open-source native Synology DSM 7 storage analysis application inspired by WinDirStat, WizTree, SequoiaView, and SpaceSniffer. Features high-speed scanning, squarified cushion treemaps, and historical snapshot comparisons.",
    "link": "${BASE_URL}/packages/syndirstat/syn-dirstat-all-1.0.0.spk",
    "fallback_link": "${RELEASE_BASE}/syn-dirstat-all-1.0.0.spk",
    "md5": "${ALL_MD5}",
    "sha256": "${ALL_SHA256}",
    "size": ${ALL_SIZE},
    "icon": "${BASE_URL}/packages/syndirstat/icon_256.png",
    "thumbnail": [
      "${BASE_URL}/packages/syndirstat/icon_256.png"
    ],
    "maintainer": "cwmoriarty",
    "maintainer_url": "https://github.com/cwmoriarty",
    "distributor": "cwmoriarty",
    "distributor_url": "${BASE_URL}/",
    "changelog": "Initial release of SynDirStat with squarified cushion treemaps, SQLite historical scan diffing, and DSM 7 native integration.",
    "type": 0,
    "category": "Utilities",
    "beta": false,
    "conflictpkgs": "",
    "deppkgs": "",
    "quarantine": false,
    "arch": [
      "x86_64",
      "r1000",
      "v1000",
      "broadwell",
      "broadwellnk",
      "apollolake",
      "geminilake",
      "denverton",
      "arm64",
      "rtd1296",
      "rtd1619b",
      "all"
    ]
  },
  {
    "package": "syn-dirstat",
    "version": "1.0.0-0001",
    "dsm_min_ver": "7.0-40000",
    "name": "SynDirStat (x86_64)",
    "desc": "SynDirStat 64-bit x86 optimized binary for Intel and AMD Synology NAS servers.",
    "link": "${BASE_URL}/packages/syndirstat/syn-dirstat-x86_64-1.0.0.spk",
    "fallback_link": "${RELEASE_BASE}/syn-dirstat-x86_64-1.0.0.spk",
    "md5": "${X86_MD5}",
    "sha256": "${X86_SHA256}",
    "size": ${X86_SIZE},
    "icon": "${BASE_URL}/packages/syndirstat/icon_256.png",
    "thumbnail": [
      "${BASE_URL}/packages/syndirstat/icon_256.png"
    ],
    "maintainer": "cwmoriarty",
    "maintainer_url": "https://github.com/cwmoriarty",
    "distributor": "cwmoriarty",
    "distributor_url": "${BASE_URL}/",
    "changelog": "Initial release for x86_64.",
    "type": 0,
    "category": "Utilities",
    "beta": false,
    "conflictpkgs": "",
    "deppkgs": "",
    "quarantine": false,
    "arch": [
      "x86_64",
      "r1000",
      "v1000",
      "broadwell",
      "broadwellnk",
      "apollolake",
      "geminilake",
      "denverton"
    ]
  },
  {
    "package": "syn-dirstat",
    "version": "1.0.0-0001",
    "dsm_min_ver": "7.0-40000",
    "name": "SynDirStat (ARM64)",
    "desc": "SynDirStat 64-bit ARM optimized binary for Realtek and ARM-based Synology NAS servers.",
    "link": "${BASE_URL}/packages/syndirstat/syn-dirstat-arm64-1.0.0.spk",
    "fallback_link": "${RELEASE_BASE}/syn-dirstat-arm64-1.0.0.spk",
    "md5": "${ARM_MD5}",
    "sha256": "${ARM_SHA256}",
    "size": ${ARM_SIZE},
    "icon": "${BASE_URL}/packages/syndirstat/icon_256.png",
    "thumbnail": [
      "${BASE_URL}/packages/syndirstat/icon_256.png"
    ],
    "maintainer": "cwmoriarty",
    "maintainer_url": "https://github.com/cwmoriarty",
    "distributor": "cwmoriarty",
    "distributor_url": "${BASE_URL}/",
    "changelog": "Initial release for arm64.",
    "type": 0,
    "category": "Utilities",
    "beta": false,
    "conflictpkgs": "",
    "deppkgs": "",
    "quarantine": false,
    "arch": [
      "arm64",
      "rtd1296",
      "rtd1619b"
    ]
  }
]
EOF

# Copy for multiple Synology Package Center endpoint conventions
cp "${REPO_DIR}/packages.json" "${REPO_DIR}/package-index"
cp "${REPO_DIR}/packages.json" "${REPO_ROOT}/packages.json"

echo ">>> Generating repository landing page (index.html)..."
cat <<EOF > "${REPO_ROOT}/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cpan.zip - Synology Community Package Repository</title>
  <style>
    :root {
      --bg: #14171f;
      --surface: #1e222d;
      --border: #2e3547;
      --text: #f0f4f8;
      --text-muted: #9aa5b8;
      --blue: #0082fa;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      padding: 40px 20px;
    }
    .container {
      max-width: 820px;
      width: 100%;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 38px;
    }
    h1 {
      margin: 0;
      font-size: 26px;
    }
    .tagline {
      color: var(--text-muted);
      margin-top: 4px;
      font-size: 14px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .url-box {
      background: #0f1117;
      border: 1px solid var(--blue);
      border-radius: 6px;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 16px;
      color: var(--blue);
      margin: 12px 0;
      user-select: all;
    }
    ol {
      line-height: 1.8;
      color: var(--text-muted);
      padding-left: 20px;
    }
    .btn {
      display: inline-block;
      background: var(--blue);
      color: #fff;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      font-size: 13px;
      margin-top: 8px;
    }
    .pkg-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 600px) {
      .pkg-grid { grid-template-columns: 1fr; }
    }
    .pkg-item {
      background: #191c26;
      border: 1px solid var(--border);
      padding: 16px;
      border-radius: 6px;
    }
    .pkg-item h3 {
      margin-top: 0;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🌳</div>
      <div>
        <h1>cpan.zip Package Repository</h1>
        <div class="tagline">Official Synology DSM 7 Community Package Repository by Chris Moriarty</div>
      </div>
    </div>

    <div class="card">
      <h2>Install through Synology Package Center</h2>
      <p style="color: var(--text-muted); line-height: 1.5;">
        Add this community repository URL directly into your Synology DSM Package Center to install and receive automatic updates for SynDirStat:
      </p>

      <div class="url-box">https://cpan.zip</div>

      <h3>Setup Instructions:</h3>
      <ol>
        <li>Log into your Synology DSM web desktop (DSM 7.x or 6.x).</li>
        <li>Open <strong>Package Center</strong>.</li>
        <li>Click <strong>Settings</strong> (top right).</li>
        <li>Select the <strong>Package Sources</strong> tab and click <strong>Add</strong>.</li>
        <li>Name: <code>cpan.zip</code><br>Location: <code>https://cpan.zip</code></li>
        <li>Click <strong>OK</strong>. In Package Center, switch to the <strong>Community</strong> tab and click <strong>Install</strong> next to SynDirStat.</li>
      </ol>
    </div>

    <div class="card">
      <h2>Direct Package Downloads (.spk)</h2>
      <div class="pkg-grid">
        <div class="pkg-item">
          <h3>SynDirStat for x86_64</h3>
          <p style="font-size: 12px; color: var(--text-muted);">For Intel & AMD based Synology NAS (Plus, XS, FS series)</p>
          <a class="btn" href="./packages/syndirstat/syn-dirstat-x86_64-1.0.0.spk">Download x86_64 SPK</a>
        </div>
        <div class="pkg-item">
          <h3>SynDirStat for ARM64</h3>
          <p style="font-size: 12px; color: var(--text-muted);">For Realtek RTD1296, RTD1619b and ARM64 series (Value/J series)</p>
          <a class="btn" href="./packages/syndirstat/syn-dirstat-arm64-1.0.0.spk">Download ARM64 SPK</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
EOF

echo "======================================================"
echo " Community Package Repository generated successfully:"
echo " - ${REPO_DIR}/packages.json"
echo " - ${REPO_DIR}/package-index"
echo " - ${REPO_ROOT}/packages.json"
echo " - ${REPO_ROOT}/index.html"
echo "======================================================"
