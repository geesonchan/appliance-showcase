import { filteredOut, shouldCount } from "./analytics";

/**
 * The visit count shown on the page: read back from GoatCounter, on the live
 * site only. Item 12c (Leo, 2026-11-17, his answers to docs/plans/item12c-plan.md);
 * D24 counts, this reads.
 *
 * - Through D24's gates: the build's address (`VITE_GOATCOUNTER`), and not this
 *   machine, a local address, a file or a frame. A local preview, a test or a
 *   screenshot is built without the address and asks nothing.
 * - The showcase's own path, the one the page sends (D24: `location.pathname`),
 *   all time, never `TOTAL`, which the site shares with game-of-life. GoatCounter's
 *   help (https://www.goatcounter.com/help/visitor-counter): `/counter/[PATH].json`,
 *   PATH "the full path, including a leading `/`", encoded as its example
 *   encodes it. Its source keeps a path without the closing slash and, finding
 *   nothing, looks again without it; which path the showcase is kept under is
 *   checked against the real figure once Leo's switch is on (decisions.md, 12c).
 * - GoatCounter's figure as it gives it — `count`, "a formatted string with
 *   thousands separators" — and nothing under 100 (Leo: 「少于100就不显示」).
 * - Nothing when it cannot be had: the switch off (a 403 the browser cannot
 *   read), a 404, blocked, an error, an answer that is not JSON, or no answer
 *   in 5 s. Nothing is thrown and nothing waits on it (Leo: 「取不到时……什么都不显示，
 *   页面和现在一样，不报错」).
 */

/** The fewest visits shown: Leo, 「少于100就不显示」. */
export const VISITS_SHOWN_FROM = 100;
/** How long the page waits for the figure before it lets it go. */
export const VISITS_TIMEOUT_MS = 5000;

/** The counter's read for a path: the count endpoint's host, `/counter/`, the path encoded, `.json`. */
export function counterJsonUrl(endpoint: string, path: string): string {
  return `${new URL(endpoint).origin}/counter/${encodeURIComponent(path)}.json`;
}

/** GoatCounter's answer, as shown: its own string, or null under 100 or when it is not a figure. */
export function visitsShown(body: unknown): string | null {
  const count = body && typeof body === "object" ? (body as { count?: unknown }).count : undefined;
  if (typeof count !== "string") return null;
  const shown = count.trim();
  // Digits, and between them only the separators a number format uses.
  if (!/^\d[\d\s.,'  ]*$/.test(shown) || !/\d$/.test(shown)) return null;
  const value = Number(shown.replace(/\D/g, ""));
  return Number.isFinite(value) && value >= VISITS_SHOWN_FROM ? shown : null;
}

export interface ReadVisits {
  endpoint: string | undefined;
  where: { hostname: string; protocol: string; inFrame: boolean };
  path: string;
  fetchFn: typeof fetch;
  timeoutMs: number;
}

/** The figure to show, or null; never throws. */
export async function readVisits({ endpoint, where, path, fetchFn, timeoutMs }: ReadVisits): Promise<string | null> {
  if (!shouldCount(endpoint, where.hostname)) return null;
  if (filteredOut({ ...where, skipped: false })) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(counterJsonUrl(endpoint!, path), { signal: controller.signal, credentials: "omit" });
    if (!response.ok) return null;
    return visitsShown(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let asked: Promise<string | null> | null = null;

/** The page's figure, asked once however many places show it. */
export function pageVisits(): Promise<string | null> {
  asked ??= readVisits({
    endpoint: import.meta.env.VITE_GOATCOUNTER as string | undefined,
    where: { hostname: location.hostname, protocol: location.protocol, inFrame: window.self !== window.top },
    path: location.pathname || "/",
    fetchFn: (input, init) => fetch(input, init),
    timeoutMs: VISITS_TIMEOUT_MS,
  });
  return asked;
}
