# Synology DSM 7 Installation & User Guide

## 1. Adding the Community Package Repository

To install SynDirStat and receive automatic updates directly through Synology Package Center:

1. Open your Synology DSM web desktop (`http://<nas-ip>:5000`).
2. Open **Package Center**.
3. Click the **Settings** button in the top-right corner.
4. Switch to the **Package Sources** tab.
5. Click **Add**:
   - **Name**: `SynDirStat Community`
   - **Location**: `https://cwmoriarty.github.io/cpan.zip/`
6. Click **OK**.
7. In Package Center, select the **Community** tab in the left sidebar.
8. Locate **SynDirStat** and click **Install**.

---

## 2. Manual SPK Installation

If your NAS is not connected to the internet or you prefer offline installation:

1. Download the appropriate `.spk` package from [`packages/syndirstat/`](file:///Users/cwm/Documents/dev/cpan.zip/packages/syndirstat/):
   - **Intel / AMD 64-bit (Plus / XS / FS Series)**: `syn-dirstat-x86_64-1.0.0.spk`
   - **ARM 64-bit (Value / J Series)**: `syn-dirstat-arm64-1.0.0.spk`
   - **Universal / All Arch**: `syn-dirstat-all-1.0.0.spk`
2. Open DSM **Package Center**.
3. Click **Manual Install** (top-right).
4. Browse and select the downloaded `.spk` file.
5. Complete the installation wizard and start the application.

---

## 3. Launching SynDirStat

Once installed:
- Click the **Main Menu** (top-left launcher icon in DSM).
- Click the **SynDirStat** icon.
- SynDirStat will open in a native DSM window.
- Select your target volume (e.g. `/volume1`) or shared folder and click **▶ Scan**.

---

## 4. Permissions & Security

SynDirStat follows Synology DSM 7's strict security guidelines (`conf/privilege`):
- Runs as an isolated service user (`syn-dirstat`) with membership in the `administrators` group to permit reading volume directory structures.
- **Strictly Read-Only Analysis**: SynDirStat does not modify or delete any user files.
- **Zero Telemetry**: No external network requests or tracking.
