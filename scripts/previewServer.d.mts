/** Types for `scripts/previewServer.mjs`, for the TypeScript that imports it (`tests/globalSetup.ts`). */

export interface PreviewRecord {
  t: string;
  ev: string;
  [key: string]: unknown;
}

export interface PreviewServer {
  url: string;
  pid: number;
  log: string;
  stop(): Promise<void>;
}

export function startPreviewServer(options: { port: number; outDir: string; log: string; timeoutMs?: number }): Promise<PreviewServer>;
export function watchMainThread(
  write: (record: Record<string, unknown>) => void,
  options?: { intervalMs?: number; thresholdMs?: number },
): () => void;
export function readLog(file: string): PreviewRecord[];
