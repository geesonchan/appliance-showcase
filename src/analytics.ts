/**
 * The visit counter, on the live site only. D24, Leo.
 *
 * Copied in spirit from geesonchan/game-of-life (`src/analytics.js`), not
 * shared with it: the address comes from the build, `VITE_GOATCOUNTER`, which
 * the workflow sets only for this repository (`.github/workflows/pages.yml`),
 * so a copy of the repository deployed by somebody else counts nothing; and
 * nothing is sent from localhost. Without the address the page does exactly
 * what it did before — nothing here runs.
 *
 * **Not GoatCounter's count.js** (Leo, D24, "甲"). count.js sends the page's
 * query string with every request (`q: location.search`, count.js's
 * `get_data`, line 30 of the copy read in this round), whatever path it is
 * told; and this page's share link is its query string (D23). So the page
 * sends its own requests to GoatCounter's documented `/count` endpoint (its
 * help, "Tracking pixel"), with every field count.js sends but `q`.
 *
 * Nothing is drawn and nothing waits: the request is a beacon, or an image
 * that is never put in the page; if it is blocked or fails, nothing follows.
 * Every figure GoatCounter shows is a lower bound — a browser that blocks it,
 * one switched off with #toggle-goatcounter and one without JavaScript are
 * never counted.
 */

/** The things counted beside a page view, under this site's own prefix (D24). */
export const EVENTS = {
  /** A page opened from a share link GoatCounter can read, with its package's letter. */
  openLink: (packageCode: string) => `appliance-showcase/open-link-${packageCode}`,
  share: "appliance-showcase/share",
  qrBox: "appliance-showcase/qr-box",
  quote: "appliance-showcase/quote",
  /**
   * A part of the page that failed and was fenced off, once a page: which
   * part, and nothing else about it (round 99c, Leo).
   */
  partFailed: (part: string) => `appliance-showcase/part-failed-${part}`,
} as const;

/**
 * Whether to count at all: an address, and not this machine. game-of-life's
 * `shouldCount`, the same two gates.
 *
 * @param endpoint like https://xxx.goatcounter.com/count
 * @param host the page's host name, to keep local runs out
 */
export function shouldCount(endpoint: string | undefined, host: string): boolean {
  if (!endpoint) return false;
  return host !== "localhost" && host !== "127.0.0.1" && host !== "";
}

/**
 * What count.js would not count either (its `filter`, lines 111-123): a page in
 * a frame, a local address or a file, and a browser switched off with
 * #toggle-goatcounter. The same checks, so the figures mean what count.js's do.
 */
export function filteredOut(where: {
  hostname: string;
  protocol: string;
  inFrame: boolean;
  skipped: boolean;
}): string | false {
  if (where.inFrame) return "frame";
  if (/(localhost$|^127\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\.|^0\.0\.0\.0$)/.test(where.hostname))
    return "localhost";
  if (where.protocol === "file:") return "localfile";
  if (where.skipped) return "disabled with #toggle-goatcounter";
  return false;
}

/** The fields a request carries; count.js's `get_data` (lines 21-46; the
 * fields at lines 23-30), but `q`. */
export interface CountFields {
  /** The path, or an event's name (count.js line 24; its help, "JavaScript API"). */
  p: string;
  /** The referrer: where the visitor came from (line 25, `document.referrer` at line 38). */
  r: string;
  /** The page's title (line 26, `document.title` at line 39). */
  t: string;
  /** An event rather than a page view (line 27). */
  e: boolean;
  /** The screen's width (line 28). */
  s: number;
  /** count.js's signs of a headless browser (line 29, `is_bot` at lines 54-66). */
  b: number;
  /** A value to keep caches off (line 130). */
  rnd: string;
}

/**
 * The request's address: the endpoint and the fields, an empty, null or false
 * one left out as count.js leaves it out (`urlencode`, lines 69-75).
 */
export function countUrl(endpoint: string, fields: CountFields): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === "" || value === null || value === undefined || value === false) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return `${endpoint}?${parts.join("&")}`;
}

/** count.js's `is_bot` (lines 54-66): headless browsers say so; 0 is "not a bot", and sent, as count.js sends it. */
function botScore(): number {
  const w = window as unknown as Record<string, unknown>;
  const d = document as unknown as Record<string, unknown>;
  if (w.callPhantom || w._phantom || w.phantom) return 150;
  if (w.__nightmare) return 151;
  if (d.__selenium_unwrapped || d.__webdriver_evaluate || d.__driver_evaluate) return 152;
  if (navigator.webdriver) return 153;
  return 0;
}

/** The address to count to, once `setupAnalytics` has said this page counts. */
let endpoint: string | null = null;

function skipped(): boolean {
  try {
    return localStorage.getItem("skipgc") === "t";
  } catch {
    return false;
  }
}

/**
 * Send one count, by beacon as count.js does (line 148), else an image never
 * put in the page. Whatever goes wrong in sending is let go: the page never
 * waits on the counter and never stops for it (D24; round 96, shown by
 * breaking it on purpose — a throw here, uncaught, stopped the page drawing).
 */
function send(fields: Pick<CountFields, "p" | "e">) {
  if (!endpoint) return;
  try {
    const out = filteredOut({
      hostname: location.hostname,
      protocol: location.protocol,
      inFrame: window.self !== window.top,
      skipped: skipped(),
    });
    if (out) return;
    const url = countUrl(endpoint, {
      ...fields,
      r: document.referrer,
      t: document.title,
      s: window.screen.width,
      b: botScore(),
      rnd: Math.random().toString(36).slice(2, 7),
    });
    if (navigator.sendBeacon?.(url)) return;
    new Image().src = url;
  } catch {
    // A beacon refused, an image refused, anything: not counted, and that is all.
  }
}

/**
 * #toggle-goatcounter, as count.js does it (lines 238-247), with its own two
 * sentences, for the shop's own browsers (Leo, D24: GoatCounter's switch, not
 * an IP filter). The key, `skipgc`, is count.js's, and this origin's — so a
 * browser switched off here is switched off for every page under
 * geesonchan.github.io that uses it, game-of-life's included.
 */
function toggleOwnVisits() {
  if (location.hash !== "#toggle-goatcounter") return;
  try {
    if (localStorage.getItem("skipgc") === "t") {
      localStorage.removeItem("skipgc");
      alert("GoatCounter tracking is now ENABLED in this browser.");
    } else {
      localStorage.setItem("skipgc", "t");
      alert(`GoatCounter tracking is now DISABLED in this browser until ${location} is loaded again.`);
    }
  } catch {
    // A browser that refuses storage cannot be switched off; nothing else to do.
  }
}

/**
 * Count the page view, once the page is visible (count.js's `on_load`, lines
 * 249-264), its path the page's own: `location.pathname`, never its query
 * (Leo, D24).
 */
export function setupAnalytics() {
  const asked = import.meta.env.VITE_GOATCOUNTER as string | undefined;
  if (!shouldCount(asked, location.hostname)) return;
  toggleOwnVisits();
  endpoint = asked!;
  const view = () => send({ p: location.pathname || "/", e: false });
  if (document.visibilityState === "visible") view();
  else {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      view();
    };
    document.addEventListener("visibilitychange", onVisible);
  }
}

/** Count one of the events (D24). Nothing at all where the page does not count. */
export function countEvent(name: string) {
  send({ p: name, e: true });
}
