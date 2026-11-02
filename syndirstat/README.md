# SynDirStat 🌳💾
### Free, Open-Source Native Synology DSM 7 Storage Analysis Application

**SynDirStat** brings the blazing speed and iconic visual cushion treemap of **WinDirStat**, **WizTree**, **SequoiaView**, and **SpaceSniffer** natively into **Synology DiskStation Manager (DSM 7.x & 6.x)**.

It runs directly on your Synology NAS as a standalone, self-contained binary with **zero external dependencies** (no Docker, Python, or Node.js required on the NAS).

---

## 🌟 Key Features

- **Squarified & Cushion Treemap Visualization**:
  - Squarified treemap layout using D3.js.
  - Optional **Cushion Treemap** mode (parabolic 3D ridge illumination inspired by SequoiaView and WinDirStat).
  - Smooth interactive zoom, breadcrumbs navigation, and hover tooltips.
  - Color coding by file extension, folder branch, or tree depth.
- **Historical Storage Snapshots & Comparisons**:
  - Persists full filesystem scans locally in an embedded SQLite database.
  - **Scan Diffing Engine**: Compare any two scans to identify newly created files, deleted files, modified files, and growing or shrinking directory trees.
  - Tracks volume expansion and growth trends over time.
- **High-Performance Filesystem Scanner**:
  - High-speed concurrent POSIX traversal using pure Go (`os.ReadDir` & `getdents64`).
  - Distinguishes **logical file size** from **actual physical block allocation**.
  - Accounts for Btrfs copy-on-write (CoW) snapshots, shared extents, and transparent compression.
  - Symlink safety (prevents recursion loops) and permission error handling.
  - Real-time Server-Sent Events (SSE) telemetry (scan speed, file count, current path).
- **Native DSM 7 Integration**:
  - Authentic Synology DSM 7 window design, dark & light themes, and desktop launcher icon.
  - Full Package Center integration with automatic updates via the community repository.
  - Strict security privilege separation (`conf/privilege`).
  - Read-only analysis: does not modify or delete user data. Zero telemetry.

---

## 🚀 Installation via Synology Package Center

### Add Community Repository:
1. Open **Package Center** in DSM.
2. Click **Settings** (top right) ➔ **Package Sources** ➔ **Add**.
3. Enter:
   - **Name**: `SynDirStat Community`
   - **Location**: `https://cwmoriarty.github.io/cpan.zip/`
4. Click **OK**.
5. Switch to the **Community** tab in Package Center and click **Install** next to **SynDirStat**.

---

## 🛠️ Build & Development

### Prerequisites:
- Go 1.22+
- Node.js 18+

### Compile Everything:
```bash
# Build React frontend, embed assets, and compile Go binaries for amd64 & arm64
./syndirstat/scripts/build.sh

# Assemble Synology SPK packages
./syndirstat/scripts/package.sh

# Update community package repository index & checksums
./syndirstat/scripts/update-repo.sh
```

### Run Tests:
```bash
cd syndirstat/backend
go test -v ./...
```

---

## 📄 License

MIT License. Designed with ❤️ for the Synology and open-source communities.
