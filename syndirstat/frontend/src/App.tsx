import React, { useState, useEffect, useCallback } from 'react';
import { ViewTab, VolumeInfo, ScanSnapshot, ScanProgress } from './types';
import {
  fetchVolumes,
  startScan,
  cancelScan,
  fetchLatestSnapshot,
  fetchSnapshotById,
  subscribeScanEvents,
} from './api/client';
import { Navigation } from './components/Navigation';
import { Overview } from './components/Overview';
import { TreemapView } from './components/TreemapView';
import { DirectoryTree } from './components/DirectoryTree';
import { FileList } from './components/FileList';
import { FileTypes } from './components/FileTypes';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<ViewTab>('overview');
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [snapshot, setSnapshot] = useState<ScanSnapshot | null>(null);
  const [progress, setProgress] = useState<ScanProgress>({
    active: false,
    current_path: '',
    scanned_files: 0,
    scanned_dirs: 0,
    scanned_bytes: 0,
    elapsed_seconds: 0,
    scan_rate: 0,
    has_result: false,
  });

  // Settings
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [shadingMode, setShadingMode] = useState<'cushion' | 'flat'>('cushion');
  const [colorBy, setColorBy] = useState<'extension' | 'folder' | 'depth'>('extension');
  const [minRectSize, setMinRectSize] = useState<number>(4);

  // Sync theme attribute to HTML tag
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      try {
        const vols = await fetchVolumes();
        setVolumes(vols);
        if (vols.length > 0) {
          setSelectedPath(vols[0].mount_path);
        }

        // Try loading latest scan snapshot
        try {
          const latest = await fetchLatestSnapshot();
          setSnapshot(latest);
        } catch {
          // No previous scan, normal initial state
        }
      } catch (err) {
        console.error('Failed initialization:', err);
      }
    };
    init();

    // Subscribe to SSE scan events
    const unsub = subscribeScanEvents((p) => {
      setProgress(p);
      if (!p.active && p.has_result) {
        // Automatically fetch completed snapshot
        fetchLatestSnapshot().then(setSnapshot).catch(console.error);
      }
    });

    return () => unsub();
  }, []);

  // Scan triggers
  const handleStartScan = async () => {
    if (!selectedPath) return;
    try {
      await startScan(selectedPath);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelScan = async () => {
    try {
      await cancelScan();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleLoadSnapshot = useCallback(async (id: string) => {
    try {
      const snap = await fetchSnapshotById(id);
      setSnapshot(snap);
      setCurrentTab('treemap');
    } catch (err: any) {
      alert(`Error loading snapshot: ${err.message}`);
    }
  }, []);

  const handleToggleTheme = () => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="dsm-app">
      <Navigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        volumes={volumes}
        selectedPath={selectedPath}
        onPathChange={setSelectedPath}
        onStartScan={handleStartScan}
        onCancelScan={handleCancelScan}
        progress={progress}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="app-main-content">
        {currentTab === 'overview' && (
          <Overview
            snapshot={snapshot}
            volumes={volumes}
            selectedPath={selectedPath}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'treemap' && (
          <TreemapView
            rootNode={snapshot?.root || null}
            shadingMode={shadingMode}
            colorBy={colorBy}
            minRectSize={minRectSize}
          />
        )}

        {currentTab === 'directories' && (
          <DirectoryTree rootNode={snapshot?.root || null} />
        )}

        {currentTab === 'files' && (
          <FileList rootNode={snapshot?.root || null} />
        )}

        {currentTab === 'filetypes' && (
          <FileTypes extensions={snapshot?.extensions || []} />
        )}

        {currentTab === 'history' && (
          <HistoryView onLoadSnapshot={handleLoadSnapshot} />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            shadingMode={shadingMode}
            onShadingChange={setShadingMode}
            colorBy={colorBy}
            onColorByChange={setColorBy}
            minRectSize={minRectSize}
            onMinRectSizeChange={setMinRectSize}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}
      </main>
    </div>
  );
};
