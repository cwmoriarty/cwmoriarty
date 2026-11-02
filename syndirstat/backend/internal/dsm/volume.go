package dsm

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"syndirstat/internal/models"
)

// DiscoverVolumes scans the host system for Synology volumes (/volume*) or OS mount points
func DiscoverVolumes() []models.VolumeInfo {
	var volumes []models.VolumeInfo

	isSyno := isSynologyOS()

	// Check /volume1 ... /volume32 standard Synology mount locations
	for i := 1; i <= 32; i++ {
		volPath := fmt.Sprintf("/volume%d", i)
		if fi, err := os.Stat(volPath); err == nil && fi.IsDir() {
			vol := inspectVolume(volPath, fmt.Sprintf("Volume %d", i), true)
			volumes = append(volumes, vol)
		}
	}

	// Check /volumeUSB*
	for i := 1; i <= 8; i++ {
		volPath := fmt.Sprintf("/volumeUSB%d", i)
		if fi, err := os.Stat(volPath); err == nil && fi.IsDir() {
			vol := inspectVolume(volPath, fmt.Sprintf("USB %d", i), true)
			volumes = append(volumes, vol)
		}
	}

	// If no Synology volumes were found (e.g., running on macOS/Linux development box)
	if len(volumes) == 0 {
		// On macOS, inspect /System/Volumes/Data and /Volumes
		macData := "/System/Volumes/Data"
		if fi, err := os.Stat(macData); err == nil && fi.IsDir() {
			vol := inspectVolume(macData, "Data Volume", false)
			volumes = append(volumes, vol)
		}

		// User home directory
		if home, err := os.UserHomeDir(); err == nil {
			vol := inspectVolume(home, fmt.Sprintf("Home (%s)", filepath.Base(home)), false)
			volumes = append(volumes, vol)
		}

		// Root mount
		vol := inspectVolume("/", "Root (/)", false)
		volumes = append(volumes, vol)
	}

	_ = isSyno
	return volumes
}

// GetVolumeCapacity returns capacity metrics for a given path
func GetVolumeCapacity(path string) models.VolumeInfo {
	return inspectVolume(path, filepath.Base(path), isSynologyOS())
}

func isSynologyOS() bool {
	if _, err := os.Stat("/etc/synoinfo.conf"); err == nil {
		return true
	}
	if _, err := os.Stat("/usr/syno"); err == nil {
		return true
	}
	return false
}

func inspectVolume(mountPath, name string, isSyno bool) models.VolumeInfo {
	info := models.VolumeInfo{
		ID:         filepath.Base(mountPath),
		Name:       name,
		MountPath:  mountPath,
		IsSynology: isSyno,
	}

	// Filesystem capacity via syscall.Statfs
	var stat syscall.Statfs_t
	if err := syscall.Statfs(mountPath, &stat); err == nil {
		blockSize := uint64(stat.Bsize)
		info.TotalBytes = stat.Blocks * blockSize
		info.FreeBytes = stat.Bavail * blockSize
		if info.TotalBytes >= info.FreeBytes {
			info.UsedBytes = info.TotalBytes - info.FreeBytes
		}
		if info.TotalBytes > 0 {
			info.PercentUsed = float64(info.UsedBytes) / float64(info.TotalBytes) * 100.0
		}
	}

	// Filesystem type detection from /proc/mounts if available
	info.FilesystemType = detectFilesystemType(mountPath)

	// Detect top-level Synology shared folders
	if isSyno || strings.HasPrefix(mountPath, "/volume") {
		entries, err := os.ReadDir(mountPath)
		if err == nil {
			for _, entry := range entries {
				if entry.IsDir() && !strings.HasPrefix(entry.Name(), "@") {
					info.Shares = append(info.Shares, models.SharedFolder{
						Name:      entry.Name(),
						Path:      filepath.Join(mountPath, entry.Name()),
						IsRecycle: entry.Name() == "#recycle",
					})
				}
			}
		}
	}

	return info
}

func detectFilesystemType(mountPath string) string {
	f, err := os.Open("/proc/mounts")
	if err != nil {
		return "unknown"
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) >= 3 {
			if fields[1] == mountPath {
				return fields[2] // e.g., btrfs, ext4
			}
		}
	}
	return "unknown"
}
