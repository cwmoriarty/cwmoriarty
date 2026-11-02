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

if [ -d "${ROOT_DIR}/packages" ]; then
    PACKAGES_DIR="${ROOT_DIR}/packages/syndirstat"
    REPO_DIR="${ROOT_DIR}/repository"
    DEST_ROOT="${ROOT_DIR}"
elif [ -d "${REPO_ROOT}/packages" ]; then
    PACKAGES_DIR="${REPO_ROOT}/packages/syndirstat"
    REPO_DIR="${REPO_ROOT}/repository"
    DEST_ROOT="${REPO_ROOT}"
else
    PACKAGES_DIR="${ROOT_DIR}/packages/syndirstat"
    REPO_DIR="${ROOT_DIR}/repository"
    DEST_ROOT="${ROOT_DIR}"
fi

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
{
  "packages": [
    {
      "package": "syn-dirstat",
      "version": "1.0.0-0001",
      "dname": "SynDirStat",
      "name": "SynDirStat",
      "desc": "Free, open-source native Synology DSM 7 storage analysis application inspired by WinDirStat, WizTree, SequoiaView, and SpaceSniffer. Features high-speed scanning, squarified cushion treemaps, and historical snapshot comparisons.",
      "link": "${BASE_URL}/packages/syndirstat/syn-dirstat-all-1.0.0.spk",
      "fallback_link": "${RELEASE_BASE}/syn-dirstat-all-1.0.0.spk",
      "md5": "${ALL_MD5}",
      "sha256": "${ALL_SHA256}",
      "size": ${ALL_SIZE},
      "icon": "${BASE_URL}/packages/syndirstat/icon_256.png",
      "thumbnail": [
        "${BASE_URL}/packages/syndirstat/icon_72.png",
        "${BASE_URL}/packages/syndirstat/icon_256.png"
      ],
      "thumbnail_retina": [
        "${BASE_URL}/packages/syndirstat/icon_256.png"
      ],
      "qinst": true,
      "qupgrade": true,
      "qstart": true,
      "startable": "yes",
      "type": 0,
      "category": "Utilities",
      "beta": false,
      "deppkgs": null,
      "conflictpkgs": null,
      "depsers": null,
      "maintainer": "cwmoriarty",
      "maintainer_url": "https://github.com/cwmoriarty",
      "distributor": "cwmoriarty",
      "distributor_url": "${BASE_URL}/",
      "changelog": "Initial release of SynDirStat with squarified cushion treemaps, SQLite historical scan diffing, and DSM 7 native integration.",
      "arch": [
        "noarch",
        "all",
        "x86_64",
        "arm64",
        "rtd1296",
        "rtd1619b",
        "geminilake",
        "apollolake",
        "denverton",
        "broadwell",
        "broadwellnk",
        "v1000",
        "r1000"
      ]
    }
  ]
}
EOF

cp "${REPO_DIR}/packages.json" "${REPO_DIR}/package-index"
cp "${REPO_DIR}/packages.json" "${DEST_ROOT}/packages.json"

echo ">>> Generating repository landing page (index.html)..."
cat <<EOF > "${DEST_ROOT}/index.html"
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
      max-width: 720px;
      width: 100%;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #fff;
    }
    p.subtitle {
      color: var(--text-muted);
      margin-bottom: 32px;
      line-height: 1.5;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card h2 {
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .card h2 img {
      width: 32px;
      height: 32px;
    }
    .steps {
      margin-left: 20px;
      line-height: 1.8;
      color: var(--text);
    }
    code {
      background: #0f1218;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      font-family: ui-monospace, Menlo, Monaco, monospace;
      font-size: 14px;
      color: #38bdf8;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(0, 130, 250, 0.15);
      color: var(--blue);
    }
    .spk-links {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 16px;
    }
    .spk-link {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #141720;
      border: 1px solid var(--border);
      padding: 12px 16px;
      border-radius: 8px;
      color: #fff;
      text-decoration: none;
      font-size: 14px;
      transition: border-color 0.15s;
    }
    .spk-link:hover {
      border-color: var(--blue);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>cpan.zip</h1>
    <p class="subtitle">Official Synology DSM Community Package Repository for SynDirStat.</p>

    <div class="card">
      <h2>How to Add to Package Center</h2>
      <ol class="steps">
        <li>Log into your Synology DSM desktop (DSM 7.x).</li>
        <li>Open <strong>Package Center</strong>.</li>
        <li>Click <strong>Settings</strong> (top right) ➔ <strong>Package Sources</strong> ➔ <strong>Add</strong>.</li>
        <li>Name: <code>cpan.zip</code></li>
        <li>Location: <code>https://cpan.zip</code></li>
        <li>Click <strong>OK</strong>, then browse the <strong>Community</strong> tab.</li>
      </ol>
    </div>

    <div class="card">
      <h2>
        <img src="packages/syndirstat/icon_256.png" alt="SynDirStat Icon" />
        SynDirStat <span class="badge">v1.0.0-0001</span>
      </h2>
      <p style="color: var(--text-muted); line-height: 1.6;">
        Free, open-source native Synology DSM 7 storage visualization inspired by WinDirStat and WizTree. Features high-speed recursive scanning, interactive squarified cushion treemaps, and historical snapshot comparisons.
      </p>

      <div class="spk-links">
        <a class="spk-link" href="packages/syndirstat/syn-dirstat-all-1.0.0.spk">
          <span>📦 <strong>Universal (noarch)</strong> — Recommended for all models</span>
          <span style="color: var(--text-muted);">SPK (${ALL_SIZE} bytes)</span>
        </a>
        <a class="spk-link" href="packages/syndirstat/syn-dirstat-x86_64-1.0.0.spk">
          <span>📦 <strong>x86_64</strong> — Intel / AMD 64-bit</span>
          <span style="color: var(--text-muted);">SPK (${X86_SIZE} bytes)</span>
        </a>
        <a class="spk-link" href="packages/syndirstat/syn-dirstat-arm64-1.0.0.spk">
          <span>📦 <strong>ARM64</strong> — Realtek RTD1296 & ARM 64-bit</span>
          <span style="color: var(--text-muted);">SPK (${ARM_SIZE} bytes)</span>
        </a>
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
echo " - ${DEST_ROOT}/packages.json"
echo " - ${DEST_ROOT}/index.html"
echo "======================================================"
