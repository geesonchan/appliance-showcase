// Leo, 2026-11-12: 「其他中文里夹英文字母的地方照同样的规矩查一遍」. The dictionary is held to the
// rule by src/i18n/cjkSpacing.test.ts; this looks at what the page shows, words the code
// puts together as well: every package in the L, one wall and the U, the page in Chinese,
// the mouse at 1440. In each: the page as opened; each machine flown to by its pin
// label or the list (the card open, its alternatives); the list rail; the right panel's
// four tabs. Every text node on screen with Chinese against a Latin letter is listed.
// The notices are read in uInterface.test.ts and oneWallSwitch.test.ts.
//   node docs/plans/u-view-2026-11-12/zhSpacingSweep.mjs <build folder> <out json>
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, outFile] = process.argv.slice(2);
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser({}, { origin, dir: resolve(build), onMiss: () => {} });
const found = new Map();
const states = [];
const collect = async (page, where) => {
  const hits = await page.evaluate(() => {
    const re = /\p{Script=Han}[A-Za-z]|[A-Za-z]\p{Script=Han}/u;
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const text = n.textContent ?? "";
      if (!re.test(text)) continue;
      const el = n.parentElement;
      if (!el || el.closest("script,style")) continue;
      out.push(text.trim().slice(0, 160));
    }
    // And across neighbouring nodes of one element (a name in its own span), as laid
    // out: innerText breaks the line at a block, a flex item or a <br>, so only words
    // that stand side by side on screen are read together.
    document.querySelectorAll("body *").forEach((el) => {
      if (el.children.length === 0 || el.closest("script,style")) return;
      if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return;
      const lines = (el.innerText ?? "").split(/\n/).filter((line) => re.test(line) && line.length <= 200);
      if (lines.length === 0) return;
      const text = lines.join(" / ");
      out.push("[joined] " + text.trim());
    });
    return out;
  });
  for (const h of hits) if (!found.has(h)) found.set(h, where);
  states.push(where);
};
for (const shape of ["L", "one-wall", "U"]) {
  for (const code of ["A", "B", "C", "D", "E"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${origin}/?v=2&pkg=${code}&shape=${shape}&lang=zh&quality=low`);
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(2500);
    const where = `${code} ${shape}`;
    await collect(page, `${where} opened`);
    // The list rail, then each machine in it.
    const rail = page.locator('[data-rail="left"]').filter({ visible: true }).first();
    await rail.click();
    await page.waitForTimeout(700);
    await collect(page, `${where} list`);
    const rows = await page.locator("[data-panel=list] li button").count();
    for (let i = 0; i < rows; i += 1) {
      // In the page: the sweep reads words, so the row is clicked where it is, open or not.
      await page.evaluate((n) => document.querySelectorAll("[data-panel=list] li button")[n]?.click(), i);
      await page.waitForTimeout(1200);
      await collect(page, `${where} machine ${i + 1}`);
    }
    for (const tab of ["外观", "布局", "安装", "清单"]) {
      const button = page.getByRole("tab", { name: tab, exact: true }).or(page.getByRole("button", { name: tab, exact: true })).filter({ visible: true }).first();
      if (await button.count()) {
        await button.click();
        await page.waitForTimeout(600);
        await collect(page, `${where} tab ${tab}`);
      }
    }
    await context.close();
  }
}
await browser.close();
const list = [...found].map(([text, where]) => ({ text, first: where }));
writeFileSync(resolve(outFile), JSON.stringify({ states: states.length, found: list }, null, 1));
console.log(`${states.length} states, ${list.length} texts with Chinese against a letter`);
for (const l of list) console.log(`${l.first} | ${l.text}`);
