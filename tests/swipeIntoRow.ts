import type { Locator, Page } from "playwright";

/**
 * A model's cell on the phone card is swiped into view before it is tapped, as
 * a person does (Leo, 2026-11-15: 「点另一个型号之前，先把那个格子横着滑进画面（人会这样做），
 * 再点正中。」).
 *
 * Why: on a phone the card lays the models side by side in a row that scrolls
 * sideways (`ul.overflow-x-auto` in src/ui/ModelCard.tsx). Item 12's 丁 widened
 * the cells from 168px to 228px, so on a 390px phone the second cell stands
 * half outside the card, and a tap at its centre lands on the card's frame
 * (tests/cameraKeep.test.ts went red there on the night of 2026-11-14; the page
 * was right, a finger on the cell's visible half picks it).
 *
 * How: a finger swipe across the row — touch points put down, moved a few pixels
 * a frame and lifted (CDP Input.dispatchTouchEvent, the input Playwright's own
 * tap uses), not a script scroll; Chrome's synthesized scroll gesture moved
 * nothing here — until the whole cell is inside what the row and the card show, then
 * the caller taps its centre. Nothing is done for an element that is not a
 * model's cell, for a cell not in a sideways row, or for one already whole in
 * view. A cell still outside after three swipes is said, not tapped blind.
 */
export async function swipeIntoRow(page: Page, cell: Locator): Promise<void> {
  const MARGIN = 8;
  const SLOP = 16;
  const where = () =>
    cell.evaluate((el) => {
      if (!el.matches("[data-candidate]")) return null;
      const sideways = (node: Element) => /^(auto|scroll)$/.test(getComputedStyle(node).overflowX);
      let row = el.parentElement;
      while (row && !sideways(row)) row = row.parentElement;
      if (!row || row.scrollWidth <= row.clientWidth) return null;
      // What shows: the row's own box, cut by every ancestor that clips, and the screen.
      let left = 0;
      let right = window.innerWidth;
      for (let node: Element | null = row; node; node = node.parentElement) {
        if (getComputedStyle(node).overflowX === "visible") continue;
        const box = node.getBoundingClientRect();
        left = Math.max(left, box.left + node.clientLeft);
        right = Math.min(right, box.left + node.clientLeft + node.clientWidth);
      }
      const own = el.getBoundingClientRect();
      return { left, right, cellLeft: own.left, cellRight: own.right, y: own.top + own.height / 2, scrollLeft: row.scrollLeft };
    });
  let at = await where();
  if (!at) return;
  const cdp = await page.context().newCDPSession(page);
  try {
    for (let swipe = 0; swipe < 3; swipe += 1) {
      const short = at.cellRight - at.right; // > 0: past the right edge
      const early = at.left - at.cellLeft; // > 0: past the left edge
      if (short <= 0 && early <= 0) return;
      // The finger moves the other way to the content: left to bring in a cell on the right.
      const travel = short > 0 ? -(short + MARGIN) : early + MARGIN;
      const x = travel < 0 ? at.right - 12 : at.left + 12;
      // A few pixels more than the row must move: the first ones a finger moves only start the scroll.
      // At most the row's own width a swipe, the finger kept on the row; a longer way takes another swipe.
      const reach = Math.sign(travel) * Math.min(Math.abs(travel) + SLOP, at.right - at.left - 24);
      const steps = Math.ceil(Math.abs(reach) / 6);
      const point = (dx: number) => [{ x: Math.round(x + dx), y: Math.round(at!.y) }];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(0) });
      for (let step = 1; step <= steps; step += 1) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point((reach * step) / steps) });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(400);
      at = (await where())!;
    }
    if (at.cellRight - at.right > 0 || at.left - at.cellLeft > 0) {
      throw new Error(
        `swipeIntoRow: the cell is still outside the card after three swipes (cell ${Math.round(at.cellLeft)}–${Math.round(at.cellRight)}, shown ${Math.round(at.left)}–${Math.round(at.right)}, scrollLeft ${at.scrollLeft})`,
      );
    }
  } finally {
    await cdp.detach().catch(() => {});
  }
}
