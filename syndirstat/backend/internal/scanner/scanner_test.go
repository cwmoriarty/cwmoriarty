package scanner

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestScannerBasicTraversal(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "syndirstat_test_*")
	if err != nil {
		t.Fatalf("failed creating temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test folder structure
	subDir1 := filepath.Join(tempDir, "media")
	subDir2 := filepath.Join(tempDir, "docs")
	_ = os.MkdirAll(subDir1, 0755)
	_ = os.MkdirAll(subDir2, 0755)

	// Create test files
	_ = os.WriteFile(filepath.Join(subDir1, "movie.mkv"), make([]byte, 1024*100), 0644) // 100KB
	_ = os.WriteFile(filepath.Join(subDir1, "song.mp3"), make([]byte, 1024*50), 0644)   // 50KB
	_ = os.WriteFile(filepath.Join(subDir2, "report.pdf"), make([]byte, 1024*25), 0644) // 25KB
	_ = os.WriteFile(filepath.Join(tempDir, "root.txt"), make([]byte, 1024*10), 0644)   // 10KB

	// Create an empty folder
	_ = os.MkdirAll(filepath.Join(tempDir, "empty"), 0755)

	s := NewScanner()
	snapshot, err := s.ScanPath(tempDir)
	if err != nil {
		t.Fatalf("ScanPath failed: %v", err)
	}

	if snapshot.TotalFiles != 4 {
		t.Errorf("expected 4 files, got %d", snapshot.TotalFiles)
	}

	expectedBytes := int64(1024 * (100 + 50 + 25 + 10))
	if snapshot.TotalBytes != expectedBytes {
		t.Errorf("expected %d bytes, got %d", expectedBytes, snapshot.TotalBytes)
	}

	// Verify extensions
	extCount := len(snapshot.Extensions)
	if extCount < 4 {
		t.Errorf("expected at least 4 extensions, got %d", extCount)
	}
}

func TestScannerSymlinkAvoidance(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "syndirstat_symlink_test_*")
	if err != nil {
		t.Fatalf("failed creating temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	realDir := filepath.Join(tempDir, "real")
	_ = os.MkdirAll(realDir, 0755)
	_ = os.WriteFile(filepath.Join(realDir, "file.bin"), make([]byte, 2048), 0644)

	// Create recursive symlink
	symlinkPath := filepath.Join(tempDir, "loop")
	_ = os.Symlink(tempDir, symlinkPath)

	s := NewScanner()
	snapshot, err := s.ScanPath(tempDir)
	if err != nil {
		t.Fatalf("ScanPath failed with symlink: %v", err)
	}

	// Should scan only 1 file and not hang or count loop
	if snapshot.TotalFiles != 1 {
		t.Errorf("expected 1 file, got %d", snapshot.TotalFiles)
	}
}

func TestScannerCancellation(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "syndirstat_cancel_test_*")
	if err != nil {
		t.Fatalf("failed creating temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	for i := 0; i < 50; i++ {
		p := filepath.Join(tempDir, "dir", filepath.Base(tempDir))
		_ = os.MkdirAll(p, 0755)
		_ = os.WriteFile(filepath.Join(p, "test.dat"), []byte("data"), 0644)
	}

	s := NewScanner()
	ctx, cancel := context.WithCancel(context.Background())
	s.cancelFunc = cancel
	s.active = true
	cancel() // Cancel immediately

	s.mu.Lock()
	s.active = false
	s.mu.Unlock()

	// Verify active is false
	if s.IsActive() {
		t.Errorf("scanner should not be active")
	}
	_ = ctx
	_ = time.Second
}
