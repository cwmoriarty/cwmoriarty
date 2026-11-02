import { VolumeInfo, ScanSnapshot, SnapshotSummary, ScanProgress, ComparisonResult } from '../types';

export async function fetchVolumes(): Promise<VolumeInfo[]> {
  const res = await fetch('/api/volumes');
  const data = await res.json();
  return data.volumes || [];
}

export async function startScan(path: string): Promise<void> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to start scan');
  }
}

export async function cancelScan(): Promise<void> {
  await fetch('/api/scan/cancel', { method: 'POST' });
}

export async function fetchScanStatus(): Promise<ScanProgress> {
  const res = await fetch('/api/scan/status');
  return res.json();
}

export async function fetchLatestSnapshot(): Promise<ScanSnapshot> {
  const res = await fetch('/api/scan/latest');
  if (!res.ok) {
    throw new Error('No scan result available');
  }
  return res.json();
}

export async function fetchHistory(limit = 100): Promise<SnapshotSummary[]> {
  const res = await fetch(`/api/history?limit=${limit}`);
  const data = await res.json();
  return data.snapshots || [];
}

export async function fetchSnapshotById(id: string): Promise<ScanSnapshot> {
  const res = await fetch(`/api/history/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Snapshot not found');
  return res.json();
}

export async function deleteSnapshot(id: string): Promise<void> {
  const res = await fetch(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete snapshot');
}

export async function compareSnapshots(baseId: string, targetId: string): Promise<ComparisonResult> {
  const res = await fetch('/api/history/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_id: baseId, target_id: targetId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Comparison failed');
  }
  return res.json();
}

export function subscribeScanEvents(onProgress: (p: ScanProgress) => void): () => void {
  const es = new EventSource('/api/scan/events');
  es.onmessage = (event) => {
    try {
      const p: ScanProgress = JSON.parse(event.data);
      onProgress(p);
    } catch {
      // ignore
    }
  };
  return () => es.close();
}

export function formatBytes(bytes: number): string {
  if (bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  const sign = bytes < 0 ? '-' : '';
  const absVal = Math.abs(val);
  return `${sign}${absVal < 10 ? absVal.toFixed(2) : absVal < 100 ? absVal.toFixed(1) : Math.round(absVal)} ${sizes[i] || 'B'}`;
}
