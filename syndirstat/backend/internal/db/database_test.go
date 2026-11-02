package db

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"syndirstat/internal/models"
)

func TestDatabaseSnapshotAndDiff(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "syndirstat_db_test_*")
	if err != nil {
		t.Fatalf("failed creating temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	database, err := NewDatabase(tempDir)
	if err != nil {
		t.Fatalf("NewDatabase failed: %v", err)
	}
	defer database.Close()

	// Snapshot 1 (Initial scan)
	snap1 := &models.ScanSnapshot{
		CreatedAt:      time.Now().Add(-1 * time.Hour),
		VolumePath:     "/volume1",
		RootPath:       "/volume1/media",
		TotalBytes:     1000,
		TotalAllocated: 1024,
		TotalFiles:     2,
		TotalDirs:      1,
		DurationSecs:   0.5,
		Root: &models.FileNode{
			Name:  "media",
			Path:  "/volume1/media",
			IsDir: true,
			Size:  1000,
			Files: 2,
			Dirs:  0,
			Children: []*models.FileNode{
				{Name: "file1.txt", Path: "/volume1/media/file1.txt", Size: 400, Mtime: 100},
				{Name: "file2.txt", Path: "/volume1/media/file2.txt", Size: 600, Mtime: 100},
			},
		},
		Extensions: []models.ExtensionStat{
			{Ext: ".txt", Size: 1000, Count: 2, Percentage: 100.0},
		},
	}

	id1, err := database.SaveSnapshot(snap1)
	if err != nil {
		t.Fatalf("SaveSnapshot snap1 failed: %v", err)
	}

	// Snapshot 2 (Later scan: file2 modified, file1 deleted, file3 created)
	snap2 := &models.ScanSnapshot{
		CreatedAt:      time.Now(),
		VolumePath:     "/volume1",
		RootPath:       "/volume1/media",
		TotalBytes:     1500,
		TotalAllocated: 1536,
		TotalFiles:     2,
		TotalDirs:      1,
		DurationSecs:   0.6,
		Root: &models.FileNode{
			Name:  "media",
			Path:  "/volume1/media",
			IsDir: true,
			Size:  1500,
			Files: 2,
			Dirs:  0,
			Children: []*models.FileNode{
				{Name: "file2.txt", Path: "/volume1/media/file2.txt", Size: 700, Mtime: 200}, // Modified: +100 bytes
				{Name: "file3.txt", Path: "/volume1/media/file3.txt", Size: 800, Mtime: 200}, // Created: +800 bytes
			},
		},
		Extensions: []models.ExtensionStat{
			{Ext: ".txt", Size: 1500, Count: 2, Percentage: 100.0},
		},
	}

	id2, err := database.SaveSnapshot(snap2)
	if err != nil {
		t.Fatalf("SaveSnapshot snap2 failed: %v", err)
	}

	// Verify List
	summaries, err := database.ListSnapshots(10)
	if err != nil {
		t.Fatalf("ListSnapshots failed: %v", err)
	}
	if len(summaries) != 2 {
		t.Errorf("expected 2 snapshots, got %d", len(summaries))
	}

	// Compare Snapshots
	diff, err := database.CompareSnapshots(id1, id2)
	if err != nil {
		t.Fatalf("CompareSnapshots failed: %v", err)
	}

	if diff.NetBytesDiff != 500 {
		t.Errorf("expected NetBytesDiff 500, got %d", diff.NetBytesDiff)
	}

	if len(diff.CreatedFiles) != 1 || diff.CreatedFiles[0].Name != "file3.txt" {
		t.Errorf("expected 1 created file (file3.txt), got %v", diff.CreatedFiles)
	}

	if len(diff.DeletedFiles) != 1 || diff.DeletedFiles[0].Name != "file1.txt" {
		t.Errorf("expected 1 deleted file (file1.txt), got %v", diff.DeletedFiles)
	}

	if len(diff.ModifiedFiles) != 1 || diff.ModifiedFiles[0].Name != "file2.txt" {
		t.Errorf("expected 1 modified file (file2.txt), got %v", diff.ModifiedFiles)
	}

	if len(diff.GrowingDirectories) != 1 || diff.GrowingDirectories[0].Path != "/volume1/media" {
		t.Errorf("expected 1 growing directory, got %v", diff.GrowingDirectories)
	}
}

func TestDatabasePruning(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "syndirstat_prune_test_*")
	if err != nil {
		t.Fatalf("failed creating temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	database, err := NewDatabase(tempDir)
	if err != nil {
		t.Fatalf("NewDatabase failed: %v", err)
	}
	defer database.Close()

	for i := 0; i < 5; i++ {
		snap := &models.ScanSnapshot{
			CreatedAt:  time.Now().Add(time.Duration(-i*10) * time.Minute),
			VolumePath: "/volume1",
			RootPath:   filepath.Join("/volume1", "test"),
			Root:       &models.FileNode{Name: "test", Path: "/volume1/test", IsDir: true},
		}
		_, _ = database.SaveSnapshot(snap)
	}

	// Prune to keep only 2 snapshots
	pruned, err := database.PruneRetention(0, 2)
	if err != nil {
		t.Fatalf("PruneRetention failed: %v", err)
	}
	if pruned != 3 {
		t.Errorf("expected 3 pruned, got %d", pruned)
	}

	list, _ := database.ListSnapshots(10)
	if len(list) != 2 {
		t.Errorf("expected 2 snapshots remaining, got %d", len(list))
	}
}
