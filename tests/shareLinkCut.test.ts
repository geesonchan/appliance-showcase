import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { LINK_FIELDS, noticeItemKey, writeLink } from "../src/store/shareLink";
import { kitchenNow } from "../src/store/openLink";
import { resetRoom } from "../src/data/testRoom";
import en from "../src/i18n/en.json";

/**
 * Round 99c, Leo: a share link cut short — by a chat app, or typed in part —
 * emptied the page on the live site (found the night of 2026-10-24): the
 * notice that says what a link left out named each missing setting's value in
 * the link, which there is none of, and the door colours' and the finishes'
 * names threw on it (`ralForHex`, `nameIn`). His two layers: a field left out
 * takes its default and the notice says so, with no error; and the notice is
 * fenced off on its own.
 *
 * Every field of package A's own link is taken out in turn, at `v=2` and at
 * `v=1` (which never carried the shape): the page stands, and the notice has
 * a line for what is missing, by its name on screen. Without the package the
 * link cannot be read, and says so.
 */

resetRoom();
const kitchen = kitchenNow();
const whole = new URLSearchParams(writeLink(kitchen));
const words = en as Record<string, string>;

/** A's own link at this version, with one field taken out. */
function cut(version: "1" | "2", name: string) {
  const query = new URLSearchParams(whole);
  query.set("v", version);
  if (version === "1") query.delete("shape");
  query.delete(name);
  return `?${query.toString()}`;
}

/** What the notice's line for a field begins with: the setting's name on screen. */
function itemFor(name: string) {
  const field = LINK_FIELDS.find((candidate) => candidate.name === name)!;
  const slot = (field as { slotId?: string }).slotId;
  const to = slot ? kitchen.selection[slot as keyof typeof kitchen.selection] : undefined;
  return words[noticeItemKey(name, to)];
}

const names = [...whole.keys()].filter((name) => name !== "v");

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

const EXPECTED_TESTS = names.length * 2 - 1; // v=1 has no shape to take out
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} cut-short link tests actually ran`).toBe(EXPECTED_TESTS);
});

async function open(query: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // The low tier: the page's words are asked here, not its frame rate.
  await page.goto(`${PREVIEW_URL}${query}&quality=low`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2500);
  const canvases = await page.locator("canvas").count();
  const lines = await page.locator("[data-share-notice-line]").allInnerTexts();
  await context.close();
  return { canvases, lines, errors };
}

for (const version of ["2", "1"] as const) {
  describe(`a v=${version} share link with one field left out keeps the page and says what is missing (round 99c)`, () => {
    for (const name of names) {
      if (version === "1" && name === "shape") continue;
      it(`without ${name}`, async () => {
        const seen = await open(cut(version, name));
        const said =
          name === "pkg"
            ? seen.lines.includes(words["share.notice.unreadable"])
            : seen.lines.some((line) => line.startsWith(`${itemFor(name)}:`));
        expect({ canvases: seen.canvases, errors: seen.errors, said }, seen.lines.join(" | ")).toEqual({
          canvases: 1,
          errors: [],
          said: true,
        });
      });
    }
  });
}
