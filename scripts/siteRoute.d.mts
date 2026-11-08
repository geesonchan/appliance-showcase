import type { Browser, BrowserContext, BrowserContextOptions, LaunchOptions } from "playwright";

export interface Site {
  origin: string;
  dir: string;
  onMiss?: (miss: { t: string; url: string; status: number; refused: boolean }) => void;
}
export interface Answer {
  status: number;
  contentType: string;
  body: Buffer;
  file: string | null;
  fallback: boolean;
  refused: boolean;
}
export const SITE_PREFIX: string;
export function contentTypeOf(file: string): string;
export function answerFor(url: string, site: { origin: string; dir: string }): Answer | null;
export function routeSite(context: BrowserContext, site: Site): Promise<BrowserContext>;
export function launchSiteBrowser(options: LaunchOptions | undefined, site: Site | null): Promise<Browser>;
export function realServerContext(browser: Browser, options?: BrowserContextOptions): Promise<BrowserContext>;
export function unroutedPageRequests(log: Array<Record<string, unknown>>, options?: { after?: string }): Array<{ t: string; url: string }>;
export function readMisses(file: string): Array<Record<string, unknown>>;
export function missWriter(file: string): NonNullable<Site["onMiss"]>;
