import { describe, expect, it, vi } from "vitest";
import { VISITS_SHOWN_FROM, VISITS_TIMEOUT_MS, counterJsonUrl, readVisits, visitsShown } from "./visitCount";

/**
 * Item 12c, the visit count on the page (Leo, 2026-11-17, his answers to the
 * plan, docs/plans/item12c-plan.md): read back from GoatCounter on the live site
 * only, through the gates D24 counts through, so nothing is asked from a local
 * preview, a test or a screenshot; only the showcase's own path, all time, not
 * `TOTAL`; GoatCounter's figure shown as it gives it; under 100 nothing; and
 * when it cannot be had — the switch off, blocked, too slow, an error, a 404 —
 * nothing, and no error.
 *
 * GoatCounter's help (https://www.goatcounter.com/help/visitor-counter): the
 * address `/counter/[PATH].json`, PATH "the full path, including a leading
 * `/`", encoded as its own example encodes it; the answer an object whose
 * `count` is "a formatted string with thousands separators"; 404 "if the path
 * is not found".
 */

const LIVE = { hostname: "geesonchan.github.io", protocol: "https:", inFrame: false };
const ENDPOINT = "https://geesonchan.goatcounter.com/count";
const PATH = "/appliance-showcase/";

/** A fetch that answers with this status and body, and keeps what it was asked. */
function answering(status: number, body: unknown) {
  return vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (typeof body === "string") return JSON.parse(body);
      return body;
    },
  })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

/** Read as the page reads, with the live site and its address unless the case says otherwise (an absent address included). */
const read = (fetchFn: typeof fetch, opts: { where?: typeof LIVE; endpoint?: string; timeoutMs?: number } = {}) =>
  readVisits({
    endpoint: "endpoint" in opts ? opts.endpoint : ENDPOINT,
    where: opts.where ?? LIVE,
    path: PATH,
    fetchFn,
    timeoutMs: opts.timeoutMs ?? VISITS_TIMEOUT_MS,
  });

describe("the address it reads", () => {
  it("is the counter's own host, /counter/, the page's path encoded, .json", () => {
    // The path the page sends (D24: `location.pathname`), as it sends it. GoatCounter's
    // source keeps it without the closing slash and, finding nothing, looks again
    // without it (plan, section 2.3) — which path it is kept under is checked against
    // the real figure once Leo's switch is on (decisions.md, 12c, after release).
    expect(counterJsonUrl(ENDPOINT, PATH)).toBe("https://geesonchan.goatcounter.com/counter/%2Fappliance-showcase%2F.json");
  });

  it("asks once, for that address, without cookies", async () => {
    const fetchFn = answering(200, { count: "1,234" });
    await read(fetchFn);
    expect(fetchFn.mock.calls.map(([url, init]) => [url, init?.credentials])).toEqual([
      ["https://geesonchan.goatcounter.com/counter/%2Fappliance-showcase%2F.json", "omit"],
    ]);
  });
});

describe("only on the live site (D24's gates)", () => {
  it.each([
    ["no address in the build", undefined, LIVE],
    ["an empty address", "", LIVE],
    ["localhost", ENDPOINT, { ...LIVE, hostname: "localhost" }],
    ["127.0.0.1", ENDPOINT, { ...LIVE, hostname: "127.0.0.1" }],
    ["a local network address", ENDPOINT, { ...LIVE, hostname: "192.168.1.20" }],
    ["a file", ENDPOINT, { ...LIVE, hostname: "", protocol: "file:" }],
    ["inside a frame", ENDPOINT, { ...LIVE, inFrame: true }],
  ])("%s: asks nothing, shows nothing", async (_name, endpoint, where) => {
    const fetchFn = answering(200, { count: "1,234" });
    expect(await read(fetchFn, { where, endpoint })).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("what it shows", () => {
  it.each([
    ["1,234", "1,234"],
    ["100", "100"],
    ["12,345,678", "12,345,678"],
    // The separator is GoatCounter's, by the site's own number format: shown as given.
    ["1 234", "1 234"],
    ["1.234", "1.234"],
  ])("GoatCounter's %s: shown as it is, %s", async (count, shown) => {
    expect(await read(answering(200, { count }))).toBe(shown);
  });

  it.each([["99"], ["0"], ["1"]])("%s, under 100: nothing (Leo: 「少于100就不显示」)", async (count) => {
    expect(VISITS_SHOWN_FROM).toBe(100);
    expect(await read(answering(200, { count }))).toBeNull();
  });

  it.each([
    ["no count", {}],
    ["a number, not GoatCounter's string", { count: 1234 }],
    ["an empty string", { count: "" }],
    ["words", { count: "many" }],
    ["null", null],
  ])("%s: nothing", async (_name, body) => {
    expect(visitsShown(body)).toBeNull();
    expect(await read(answering(200, body))).toBeNull();
  });
});

describe("when it cannot be had: nothing, and no error", () => {
  it.each([
    ["403, the switch off", 403],
    ["404, the path not found", 404],
    ["500", 500],
  ])("%s", async (_name, status) => {
    expect(await read(answering(status, { count: "1,234" }))).toBeNull();
  });

  it("refused, as a blocker or a missing CORS header refuses it", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(read(fetchFn)).resolves.toBeNull();
  });

  it("an answer that is not JSON", async () => {
    await expect(read(answering(200, "<html>"))).resolves.toBeNull();
  });

  it("too slow: given up after the time allowed, the request aborted", async () => {
    let aborted = false;
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;
    const started = Date.now();
    await expect(read(fetchFn, { timeoutMs: 50 })).resolves.toBeNull();
    expect({ aborted, quick: Date.now() - started < 2000 }).toEqual({ aborted: true, quick: true });
    expect(VISITS_TIMEOUT_MS).toBe(5000);
  });
});
