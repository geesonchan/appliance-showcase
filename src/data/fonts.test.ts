import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The fonts are the site's own (the fonts round, 2026-11-06; Leo: 「字体自带：
 * 字体文件放进网站自己的文件里、不再请求 Google，设成字体没到先用系统字显示」).
 *
 * Until then `index.html` asked Google for its stylesheet in `<head>`, before
 * the site's own script, so a page where Google was held open drew nothing:
 * 90 s and more, measured (docs/plans/fonts-plan.md, section 4). Now
 * `src/fonts.css` is Google's stylesheet of 2026-11-06 as it came, its 48
 * blocks, with each address pointing at the site's own copy in
 * `src/assets/fonts/`, and the two licences beside the fonts in
 * `public/fonts/` (SIL OFL 1.1 asks for the licence with every copy).
 *
 * What is held here, read from the files, no browser: no outside address in
 * `index.html` or `src/fonts.css`; every `url()` in `fonts.css` is a file
 * that is there; the twelve files, each named once; every block swaps; and
 * both licences. The browser side — the page drawn with Google held open,
 * and no request to Google — is `tests/selfHostedFonts.test.ts`.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/**
 * Every address in a file that leaves the site: `http:`, `https:` or a
 * protocol-relative `//host`, in an attribute or a CSS `url()`. Comments are
 * read too — an address in a comment is not fetched, but none is wanted in
 * these two files, and a rule that skips comments can be fooled by one.
 */
export function outsideAddresses(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"')]*/gi)) found.add(match[0]);
  return [...found];
}

/** The `url(...)` targets in a stylesheet, quotes taken off. */
export function urls(css: string): string[] {
  return [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((match) => match[2]);
}

const FONT_DIR = "src/assets/fonts";

describe("the fonts are the site's own (2026-11-06)", () => {
  // The check is first shown to find what it is for (D17: a test that
  // cannot go red proves nothing): Google's own line, as `index.html` had it.
  it("finds an outside address when one is there, and none in plain text", () => {
    expect(
      outsideAddresses(
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap" rel="stylesheet" />',
      ),
    ).toEqual(["https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap"]);
    expect(outsideAddresses("src: url(//fonts.gstatic.com/s/inter/v20/a.woff2)")).toEqual([
      "//fonts.gstatic.com/s/inter/v20/a.woff2",
    ]);
    expect(outsideAddresses("src: url(./assets/fonts/a.woff2) format('woff2');")).toEqual([]);
    expect(urls("src: url(./a.woff2) format('woff2'); src: url('b.woff2');")).toEqual(["./a.woff2", "b.woff2"]);
  });

  it("index.html has no outside address", () => {
    expect(outsideAddresses(read("index.html"))).toEqual([]);
  });

  it("src/fonts.css has no outside address", () => {
    expect(outsideAddresses(read("src/fonts.css"))).toEqual([]);
  });

  it("src/fonts.css is Google's 48 blocks, every one swapping, every url() a file that is there", () => {
    const css = read("src/fonts.css");
    const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(blocks.length, "@font-face blocks").toBe(48);
    for (const block of blocks) expect(block, block).toMatch(/font-display:\s*swap;/);
    const targets = urls(css);
    expect(targets.length, "one url() a block").toBe(48);
    const missing = targets.filter((target) => !existsSync(join(ROOT, "src", target)));
    expect(missing, "url()s with no file").toEqual([]);
    // Two families, weights 300 to 600, as the stylesheet was asked for.
    const faces = new Set(blocks.map((block) => `${/font-family:\s*'([^']+)'/.exec(block)?.[1]} ${/font-weight:\s*(\d+)/.exec(block)?.[1]}`));
    expect([...faces].sort()).toEqual(
      ["Cormorant Garamond", "Inter"].flatMap((family) => ["300", "400", "500", "600"].map((weight) => `${family} ${weight}`)),
    );
  });

  it("the font folder holds the twelve files and nothing else, each one used", () => {
    const files = readdirSync(join(ROOT, FONT_DIR)).sort();
    expect(files.length, files.join(", ")).toBe(12);
    expect(files.every((file) => file.endsWith(".woff2"))).toBe(true);
    const used = new Set(urls(read("src/fonts.css")).map((target) => target.split("/").pop()));
    expect([...used].sort()).toEqual(files);
  });

  it("the two licences are beside the fonts, each with its copyright line", () => {
    const inter = read("public/fonts/Inter-OFL.txt");
    const cormorant = read("public/fonts/CormorantGaramond-OFL.txt");
    expect(inter.split("\n")[0]).toMatch(/^Copyright 2020 The Inter Project Authors/);
    expect(cormorant.split("\n")[0]).toMatch(/^Copyright 2015 the Cormorant Project Authors/);
    for (const text of [inter, cormorant]) {
      expect(text).toContain("SIL OPEN FONT LICENSE Version 1.1");
    }
  });

  it("main.tsx brings in fonts.css before index.css", () => {
    const main = read("src/main.tsx");
    const fonts = main.indexOf('import "./fonts.css";');
    const index = main.indexOf('import "./index.css";');
    expect(fonts, "fonts.css imported").toBeGreaterThan(-1);
    expect(fonts).toBeLessThan(index);
  });
});
