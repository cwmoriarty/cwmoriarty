# Synology Community Package Repository Specifications

## 1. Package Repository Architecture

Synology Package Center queries community package sources via HTTP/HTTPS. The repository index is hosted statically using GitHub Pages:

- **Repository Root**: `https://cwmoriarty.github.io/cpan.zip/`
- **Catalog JSON Feed**: `https://cwmoriarty.github.io/cpan.zip/repository/packages.json`
- **Catalog Index**: `https://cwmoriarty.github.io/cpan.zip/repository/package-index`

---

## 2. Hardware Architecture Compatibility Matrix

| Synology Architecture | Platform | Processor Families | Supported SPK |
|---|---|---|---|
| `x86_64` | Intel / AMD 64-bit | Gemini Lake, Apollo Lake, Broadwell, Denverton, Ryzen V1000/R1000 | `syn-dirstat-x86_64-1.0.0.spk` |
| `arm64` | Realtek / ARM 64-bit | RTD1296 (DS218, DS418), RTD1619B (DS223, DS423) | `syn-dirstat-arm64-1.0.0.spk` |
| `all` / `noarch` | Universal | All DSM 7.0+ compliant models | `syn-dirstat-all-1.0.0.spk` |

---

## 3. Automated Release Lifecycle

When a version tag (e.g. `v1.0.0`) is pushed to GitHub:
1. GitHub Actions workflow `.github/workflows/syndirstat-publish.yml` executes.
2. The React frontend is compiled and embedded into the Go binary.
3. Statically linked ELF binaries are built for `amd64` and `arm64`.
4. Synology SPKs are assembled, validated, and signed with MD5 & SHA256 checksums.
5. GitHub Releases publishes the binary assets.
6. The community package index (`packages.json`) is refreshed.
7. GitHub Pages deploys the updated catalog feed automatically.
