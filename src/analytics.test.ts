import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENTS, countUrl, filteredOut, shouldCount } from "./analytics";

/**
 * The visit counter: on the live site only, nothing of the address's query,
 * four events in their one place each. D24, round 96, Leo; the
 * gates as geesonchan/game-of-life tests its own (its tests/cases.js, "访问统计").
 * tests/analytics.test.ts drives the built page.
 */

const read = (path: string) => readFileSync(path, "utf8");

describe("whether the page counts at all: an address, and not this machine", () => {
  it("does not count with no address", () => {
    expect(shouldCount(undefined, "example.com")).toBe(false);
  });
  it("does not count with an empty address", () => {
    expect(shouldCount("", "example.com")).toBe(false);
  });
  it("does not count on localhost", () => {
    expect(shouldCount("https://x.goatcounter.com/count", "localhost")).toBe(false);
  });
  it("does not count on the loopback address", () => {
    expect(shouldCount("https://x.goatcounter.com/count", "127.0.0.1")).toBe(false);
  });
  it("does not count where the host name cannot be had", () => {
    expect(shouldCount("https://x.goatcounter.com/count", "")).toBe(false);
  });
  it("counts on the live site", () => {
    expect(shouldCount("https://x.goatcounter.com/count", "geesonchan.github.io")).toBe(true);
  });
});

describe("what count.js would not count either", () => {
  const live = { hostname: "geesonchan.github.io", protocol: "https:", inFrame: false, skipped: false };
  it("counts the live site", () => {
    expect(filteredOut(live)).toBe(false);
  });
  it("leaves out a page in a frame", () => {
    expect(filteredOut({ ...live, inFrame: true })).toBe("frame");
  });
  it("leaves out local network addresses, as count.js does", () => {
    expect(["10.0.0.4", "172.20.1.1", "192.168.1.9", "0.0.0.0"].map((hostname) => filteredOut({ ...live, hostname }))).toEqual([
      "localhost",
      "localhost",
      "localhost",
      "localhost",
    ]);
  });
  it("leaves out a file opened from disk", () => {
    expect(filteredOut({ ...live, protocol: "file:" })).toBe("localfile");
  });
  it("leaves out a browser switched off with #toggle-goatcounter", () => {
    expect(filteredOut({ ...live, skipped: true })).toBe("disabled with #toggle-goatcounter");
  });
});

describe("what a request carries", () => {
  const url = countUrl("https://x.goatcounter.com/count", {
    p: "/appliance-showcase/",
    r: "https://weixin.qq.com/",
    t: "Appliance Showcase",
    e: false,
    s: 390,
    b: 0,
    rnd: "abcde",
  });
  const fields = Object.fromEntries(new URL(url).searchParams);

  it("carries every field count.js sends but q, with false left out as count.js leaves it", () => {
    expect(fields).toEqual({ p: "/appliance-showcase/", r: "https://weixin.qq.com/", t: "Appliance Showcase", s: "390", b: "0", rnd: "abcde" });
  });

  it("never carries the page's query", () => {
    expect("q" in fields).toBe(false);
  });
});

describe("the four events", () => {
  const names = [EVENTS.openLink("D"), EVENTS.share, EVENTS.qrBox, EVENTS.quote];

  it("are named under this site's prefix, apart from game-of-life's, and never start with /", () => {
    expect(names.filter((name) => !name.startsWith("appliance-showcase/") || name.startsWith("/"))).toEqual([]);
  });

  it("are each counted in one place, and only there (D17's table, first row)", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path);
      }
    };
    walk("src");
    const calls = files.flatMap((file) =>
      [...read(file).matchAll(/countEvent\((EVENTS\.\w+)/g)].map((match) => `${file.replace(/\\/g, "/")} ${match[1]}`),
    );
    expect(calls.sort()).toEqual([
      "src/store/openLink.ts EVENTS.openLink",
      "src/ui/TopBar.tsx EVENTS.qrBox",
      "src/ui/TopBar.tsx EVENTS.quote",
      "src/ui/TopBar.tsx EVENTS.share",
    ]);
  });
});

describe("where the address comes from", () => {
  it("takes it from the build, and writes none into the source", () => {
    const source = read("src/analytics.ts");
    const literals = source.match(/(['"`])[^'"`\n]*goatcounter\.com[^'"`\n]*\1/g) ?? [];
    expect({ fromBuild: /import\.meta\.env\.VITE_GOATCOUNTER/.test(source), literals }).toEqual({ fromBuild: true, literals: [] });
  });

  it("is given to the build by the workflow, the repository variable first", () => {
    const workflow = read(".github/workflows/pages.yml");
    expect({ given: /VITE_GOATCOUNTER:/.test(workflow), variable: /vars\.GOATCOUNTER/.test(workflow) }).toEqual({ given: true, variable: true });
  });

  it("falls back only in this repository, to an address ending /count", () => {
    const workflow = read(".github/workflows/pages.yml");
    const fallback = /github\.repository == 'geesonchan\/appliance-showcase' && '(https:\/\/[\w-]+\.goatcounter\.com\/count)'/.exec(workflow);
    expect(fallback?.[1]).toBe("https://geesonchan.goatcounter.com/count");
  });

  it("is said in the README: one anonymous counter, no cookies, no personal data", () => {
    const readme = read("README.md");
    expect(/anonymous page-view counter[\s\S]{0,80}GoatCounter[\s\S]{0,60}no cookies, no personal data/.test(readme)).toBe(true);
  });
});
