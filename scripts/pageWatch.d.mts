import type { ElementHandle, Page, Response } from "playwright";

/** Where a page that did not draw is recorded. */
export const BLANK_DIR: string;

export interface PageRecord {
  label: string;
  startedAt: string;
  console: { at: string; type: string; text: string }[];
  pageErrors: { at: string; message: string }[];
  failedRequests: { at: string; url: string; error: string }[];
  badResponses: { at: string; url: string; status: number }[];
  crashed: string | null;
  closed: boolean;
}

export function watch(page: Page, label?: string): Promise<PageRecord>;
export function snapshot(page: Page): Promise<Record<string, unknown>>;
export function report(page: Page, step: string, error: unknown, label?: string): Promise<{ json: string; facts: Record<string, unknown> }>;
export function gotoWatched(
  page: Page,
  url: string,
  options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit"; label?: string },
): Promise<Response | null>;
export function canvasWatched(page: Page, options?: { timeout?: number; label?: string }): Promise<ElementHandle | null>;
export function openWatched(
  page: Page,
  url: string,
  options?: { gotoTimeout?: number; canvasTimeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit"; label?: string },
): Promise<ElementHandle | null>;
export function watchOf(page: Page): PageRecord | null;
