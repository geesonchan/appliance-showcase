import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { answerFor, contentTypeOf, readMisses, unroutedPageRequests } from "./siteRoute.mjs";

/**
 * 丁: the site's files answered from the build by Playwright, not through a
 * connection on this machine (docs/plans/route-wiring-plan.md; Leo,
 * 2026-11-07: 「siteRoute 的测试要和 previewServer 的一样严：首页、文件类型（特别是 .js
 * 模块和 .woff2）、找不到文件回首页、网站路径前缀 /appliance-showcase/、`..` 和编码过的越界路
 * 径不能读出 dist/ 以外的文件。逐条照 previewServer.test.ts 的情况写」).
 *
 * The cases are `scripts/previewServer.test.ts`'s, on a small build of its
 * own in a temporary folder (no `npm run build`, so CI's unit run has it):
 * the page, its files with their types, the page again for a path with no
 * file. Added for 丁: the site's own prefix, and a file beside the build that
 * no way of writing a path may read. Not here: compression, which 丁 does
 * not do (the live check covers what the server sends; the plan's section
 * 4). That a real browser runs the module and loads the font from these
 * answers is `tests/siteRoute.test.ts`, in the full suite.
 */

const ORIGIN = "http://localhost:4198";
const SECRET = "the secret beside the build";

let dir: string;
beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), "site-route-"));
  dir = join(root, "dist");
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "fonts"), { recursive: true });
  writeFileSync(
    join(dir, "index.html"),
    '<!doctype html><html><head><script type="module" crossorigin src="./assets/app-X1.js"></script><link rel="stylesheet" href="./assets/app-X1.css"></head><body><div id="root"></div></body></html>',
  );
  writeFileSync(join(dir, "assets", "app-X1.js"), 'document.body.dataset.ran = "yes";\n');
  writeFileSync(join(dir, "assets", "app-X1.css"), "body{margin:0}\n");
  writeFileSync(join(dir, "assets", "font-X1.woff2"), Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 1, 2, 3]));
  writeFileSync(join(dir, "fonts", "Inter-OFL.txt"), "SIL Open Font License\n");
  // Beside the build, never to be read through it.
  writeFileSync(join(root, "secret.txt"), SECRET);
});

const text = (url: string) => {
  const a = answerFor(url, { origin: ORIGIN, dir })!;
  return { ...a, text: a.body.toString("utf8") };
};

describe("scripts/siteRoute.mjs: what 丁 answers, as vite preview does (2026-11-07)", () => {
  it("answers the page for the site's root, with or without the page's query", () => {
    for (const url of [`${ORIGIN}/`, `${ORIGIN}/?quality=high&qualityLock=1`, ORIGIN]) {
      const a = text(url);
      expect(a).toMatchObject({ status: 200, contentType: expect.stringMatching(/^text\/html/), fallback: false });
      expect(a.text).toContain('<div id="root"></div>');
    }
  });

  it("answers each file with its own bytes and its type: a module script as JavaScript, a font as woff2, the CSS, a text", () => {
    expect(text(`${ORIGIN}/assets/app-X1.js`)).toMatchObject({
      status: 200,
      contentType: expect.stringMatching(/^(text|application)\/javascript/),
      text: 'document.body.dataset.ran = "yes";\n',
    });
    const font = answerFor(`${ORIGIN}/assets/font-X1.woff2`, { origin: ORIGIN, dir })!;
    expect(font).toMatchObject({ status: 200, contentType: "font/woff2" });
    expect([...font.body]).toEqual([0x77, 0x4f, 0x46, 0x32, 0, 1, 2, 3]);
    expect(text(`${ORIGIN}/assets/app-X1.css`)).toMatchObject({ status: 200, contentType: expect.stringMatching(/^text\/css/), text: "body{margin:0}\n" });
    expect(text(`${ORIGIN}/fonts/Inter-OFL.txt?v=1#x`)).toMatchObject({ status: 200, contentType: expect.stringMatching(/^text\/plain/) });
  });

  it("answers the page for a path with no file, as vite preview does, and says it fell back", () => {
    for (const url of [`${ORIGIN}/a/page/with/no/file`, `${ORIGIN}/assets/missing-X9.js`]) {
      const a = text(url);
      expect(a).toMatchObject({ status: 200, contentType: expect.stringMatching(/^text\/html/), fallback: true });
      expect(a.text).toContain('<div id="root"></div>');
    }
  });

  it("serves the site under its prefix on the live site, /appliance-showcase/, the same as at the root", () => {
    expect(text(`${ORIGIN}/appliance-showcase/`)).toMatchObject({ status: 200, contentType: expect.stringMatching(/^text\/html/), fallback: false });
    expect(text(`${ORIGIN}/appliance-showcase`)).toMatchObject({ status: 200, contentType: expect.stringMatching(/^text\/html/), fallback: false });
    expect(text(`${ORIGIN}/appliance-showcase/assets/app-X1.js`)).toMatchObject({
      status: 200,
      contentType: expect.stringMatching(/javascript/),
      text: 'document.body.dataset.ran = "yes";\n',
    });
  });

  it("never reads a file outside the build, however the path is written", () => {
    const tries = [
      `${ORIGIN}/../secret.txt`,
      `${ORIGIN}/assets/../../secret.txt`,
      `${ORIGIN}/assets/%2e%2e/%2e%2e/secret.txt`,
      `${ORIGIN}/..%2fsecret.txt`,
      `${ORIGIN}/assets/..%2f..%2fsecret.txt`,
      `${ORIGIN}/assets/..%5c..%5csecret.txt`,
      `${ORIGIN}/appliance-showcase/../../secret.txt`,
      `${ORIGIN}/appliance-showcase/..%2f..%2fsecret.txt`,
      `${ORIGIN}/%00secret.txt`,
      `${ORIGIN}/%E0%A4%A`,
    ];
    for (const url of tries) {
      const a = text(url);
      expect(a.text, url).not.toContain(SECRET);
      // Either refused, or the page, as for any path with no file.
      expect(a.status === 404 || (a.status === 200 && a.fallback), url).toBe(true);
    }
    // A ".." the address parser cannot fold is refused outright.
    expect(text(`${ORIGIN}/..%2fsecret.txt`)).toMatchObject({ status: 404, refused: true });
    expect(text(`${ORIGIN}/assets/..%5c..%5csecret.txt`)).toMatchObject({ status: 404, refused: true });
  });

  it("answers nothing that is not the site's own origin", () => {
    expect(answerFor("http://127.0.0.1:4198/assets/app-X1.js", { origin: ORIGIN, dir })).toBeNull();
    expect(answerFor("https://gc.zgo.at/count.js", { origin: ORIGIN, dir })).toBeNull();
  });

  it("gives each kind of file the type the preview server would", () => {
    expect(contentTypeOf("index.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeOf("assets/index-DXl3ZdsD.js")).toBe("text/javascript; charset=utf-8");
    expect(contentTypeOf("assets/index-C679l0R0.css")).toBe("text/css; charset=utf-8");
    expect(contentTypeOf("assets/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7-Dx4kXJAl.woff2")).toBe("font/woff2");
    expect(contentTypeOf("fonts/Inter-OFL.txt")).toBe("text/plain; charset=utf-8");
    expect(contentTypeOf("data/models.json")).toBe("application/json; charset=utf-8");
    expect(contentTypeOf("favicon.svg")).toBe("image/svg+xml");
    expect(contentTypeOf("a/b.PNG")).toBe("image/png");
    expect(contentTypeOf("README")).toBe("application/octet-stream");
  });
});

describe("what the suite checks at its end (the plan's section 5)", () => {
  it("finds every page request the server got that did not come from a test kept on the real server", () => {
    // The suite's own setup — waiting for the server, then warm() — asks for the bare root with Node's fetch, before any test.
    const ready = "2026-11-07T01:00:00.000Z";
    const log = [
      { ev: "start", t: "2026-11-07T00:59:58.000Z" },
      { ev: "req", url: "/", t: "2026-11-07T00:59:58.500Z" }, // waiting for the server
      { ev: "req", url: "/", t: "2026-11-07T00:59:59.000Z" }, // warm()
      { ev: "req", url: "/assets/index-X.js", t: "2026-11-07T00:59:59.100Z" },
      { ev: "req", url: "/?quality=high", realServer: true, t: "2026-11-07T01:02:00.000Z" },
      { ev: "req", url: "/?v=3&pkg=D&quality=high", t: "2026-11-07T01:02:03.000Z" },
      { ev: "req", url: "/appliance-showcase/?quality=high", t: "2026-11-07T01:02:04.000Z" },
    ];
    expect(unroutedPageRequests(log, { after: ready })).toEqual([
      { t: "2026-11-07T01:02:03.000Z", url: "/?v=3&pkg=D&quality=high" },
      { t: "2026-11-07T01:02:04.000Z", url: "/appliance-showcase/?quality=high" },
    ]);
    expect(unroutedPageRequests(log.slice(0, 5), { after: ready })).toEqual([]);
    // The bare root after the setup, unmarked, is a page opened without 丁 (smoke's warm-up opens the bare address).
    const late = [...log.slice(0, 5), { ev: "req", url: "/", t: "2026-11-07T01:02:05.000Z" }, { ev: "req", url: "/", realServer: true, t: "2026-11-07T01:02:06.000Z" }];
    expect(unroutedPageRequests(late, { after: ready })).toEqual([{ t: "2026-11-07T01:02:05.000Z", url: "/" }]);
  });

  it("reads the requests 丁 answered with the page for want of a file; none when there is no record", () => {
    const root = mkdtempSync(join(tmpdir(), "site-route-misses-"));
    const file = join(root, "misses.jsonl");
    expect(readMisses(file)).toEqual([]);
    writeFileSync(file, '{"t":"x","url":"http://localhost:4174/assets/gone.js"}\n');
    expect(readMisses(file)).toEqual([{ t: "x", url: "http://localhost:4174/assets/gone.js" }]);
  });
});

/**
 * The static guard (the plan's section 5): every browser launched in the
 * tests and the scripts goes through 丁, or is on this list with its reason.
 * A test that opens a browser without 丁 turns this red, naming the file.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OFF_THE_ROUTE: Record<string, string> = {
  "tests/pageWatch.test.ts": "kept on the real local server: the watch must face real requests (plan, section 3)",
  "tests/analytics.test.ts": "answers its own counter build by route, since round 96",
  "tests/sliderWarning.test.ts": "opens Vite's development server (the working tree, React's warnings), not the build 丁 answers from",
  "scripts/siteRoute.mjs": "the launcher itself",
  "scripts/serverResetLoop.mjs": "the tool that measures the stalls; ROUTE=1 for 丁",
  "scripts/qualityDrop.mjs": "a tool given an address, not in the full suite",
  "scripts/swapMemory.mjs": "a tool given an address, not in the full suite",
  "scripts/screenshots.mjs": "a tool given an address, not in the full suite",
  "scripts/pixelCompare.mjs": "a tool given an address, not in the full suite",
};
const REAL_SERVER_CONTEXTS: Record<string, number> = {
  "tests/smoke.test.ts": 1, // in openPage, for its two opening checks, one desktop and one phone (plan, section 3)
  "tests/pageWatch.test.ts": 1, // the real page that draws (plan, section 3)
  "tests/siteRoute.test.ts": 1, // shows such a context is not routed, on an address where nothing listens
};

const sources = () =>
  ["tests", "scripts"].flatMap((folder) =>
    readdirSync(join(ROOT, folder))
      .filter((f) => /\.(ts|mts|mjs|js)$/.test(f) && !f.endsWith(".d.mts"))
      .map((f) => relative(ROOT, join(ROOT, folder, f)).split("\\").join("/")),
  );

describe("every browser the tests and scripts launch goes through 丁, or is listed with its reason", () => {
  it("launches no browser with chromium.launch outside the list", () => {
    const unlisted: string[] = [];
    for (const file of sources()) {
      if (file === "scripts/siteRoute.test.ts") continue;
      const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/chromium\.(launch|launchPersistentContext)\s*\(/.test(line) && !(file in OFF_THE_ROUTE)) unlisted.push(`${file}:${i + 1}`);
      });
    }
    expect(unlisted).toEqual([]);
  });

  it("opens a context on the real server only where the plan keeps one", () => {
    const found: Record<string, number> = {};
    for (const file of sources()) {
      if (file === "scripts/siteRoute.test.ts" || file === "scripts/siteRoute.mjs") continue;
      // Every line that names it, but its import: a call, or handed on as a function (smoke's openPage).
      const n = readFileSync(join(ROOT, file), "utf8")
        .split("\n")
        .filter((line) => /\brealServerContext\b/.test(line) && !/^\s*import\b/.test(line)).length;
      if (n) found[file] = n;
    }
    expect(found).toEqual(REAL_SERVER_CONTEXTS);
  });
});
