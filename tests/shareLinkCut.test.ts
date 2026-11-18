import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { LINK_FIELDS, noticeItemKey, writeLink } from "../src/store/shareLink";
import { LINK_VERSIONS } from "../src/data/linkVersion";
import { kitchenNow } from "../src/store/openLink";
import { resetRoom } from "../src/data/testRoom";
import en from "../src/i18n/en.json";
import { gotoWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

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
 * `v=1`: the page stands, and the notice has a line for what is missing, by
 * its name on screen. Without the package the link cannot be read, and says so.
 *
 * Which version first carried a field is said in one place, its `since` in
 * src/data/layoutFields.ts, and this test judges by that place alone (Leo,
 * 2026-11-17, after the full suite of 2026-11-16 went red here on `steamSill`:
 * 「规矩写成一处：每一项从哪个链接版本开始有。比它早的链接里没有这一项，按默认值打开、不提示；从它开始的
 * 链接里缺了这一项，才提示。测试照这一处来判断，不要为 steamSill 单写一个例外。」). So:
 * - a link of a version that carried the field, with the field left out, says
 *   so (the cases above);
 * - a link of a version older than the field never had it: it opens with the
 *   field at the default and nothing said about it, at every older version the
 *   page reads (`v=1` without the shape; `v=1` to `v=3` without D's oven
 *   height, at 12"). The default is what A's own link writes for it.
 * Until 12b the shape at `v=1` was skipped by hand, and the oven height, new in
 * `v=4`, was taken for a field left out.
 */

resetRoom();
const kitchen = kitchenNow();
const whole = new URLSearchParams(writeLink(kitchen));
const words = en as Record<string, string>;

/** The one place: the link version that first carried a field (1 where nothing later is said). */
const sinceOf = (name: string) => (LINK_FIELDS.find((field) => field.name === name) as { since?: { version: number } } | undefined)?.since?.version ?? 1;
const carried = (version: string, name: string) => Number(version) >= sinceOf(name);

/** A's own link at this version — without what a link of it never carried — with one field more taken out. */
function cut(version: string, name?: string) {
  const query = new URLSearchParams(whole);
  query.set("v", version);
  for (const field of [...query.keys()]) if (field !== "v" && !carried(version, field)) query.delete(field);
  if (name) query.delete(name);
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
const CUT_VERSIONS = ["2", "1"] as const;
/** Every version the page reads that is older than a field, for each field. */
const older = names.flatMap((name) =>
  LINK_VERSIONS.filter((version) => !carried(version, name)).map((version) => ({ version, name })),
);

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

const EXPECTED_TESTS =
  CUT_VERSIONS.reduce((sum, version) => sum + names.filter((name) => carried(version, name)).length, 0) + older.length;
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
  await gotoWatched(page, `${PREVIEW_URL}${query}&quality=low`, { timeout: 90_000, label: `shareLinkCut · ${expect.getState().currentTestName ?? ""}` });
  await page.waitForTimeout(2500);
  const canvases = await page.locator("canvas").count();
  const lines = await page.locator("[data-share-notice-line]").allInnerTexts();
  // The parameters the page built, under ?debug=1 only (main.tsx).
  const params = await page.evaluate(() => (window as unknown as { __room?: () => { params: unknown } }).__room?.().params ?? null);
  await context.close();
  return { canvases, lines, errors, params };
}

for (const version of CUT_VERSIONS) {
  describe(`a v=${version} share link with one field left out keeps the page and says what is missing (round 99c)`, () => {
    for (const name of names) {
      if (!carried(version, name)) continue; // never in a link of this version: asked below
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

// A link older than a field: by the same one place, nothing was left out of it.
describe("a share link from before a field opens it at the default and says nothing about it", () => {
  for (const { version, name } of older) {
    it(`v=${version} without ${name}: ${whole.get(name)}, nothing said`, async () => {
      const field = LINK_FIELDS.find((candidate) => candidate.name === name) as unknown as {
        get: (params: unknown) => unknown;
        write: (value: unknown) => string;
      };
      const seen = await open(`${cut(version)}&debug=1`);
      expect(
        {
          canvases: seen.canvases,
          errors: seen.errors,
          said: seen.lines.some((line) => line.startsWith(`${itemFor(name)}:`)),
          value: seen.params === null ? "no __room" : field.write(field.get(seen.params)),
        },
        seen.lines.join(" | "),
      ).toEqual({ canvases: 1, errors: [], said: false, value: whole.get(name) });
    });
  }
});
