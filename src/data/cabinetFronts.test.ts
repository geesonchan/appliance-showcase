import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE } from "./packages";

/**
 * A filler or a finished board has no door. Round 50 (D22, Leo).
 *
 * A 3" or 1/2" filler is a solid strip that closes a gap, and a tall unit's side
 * is a board; neither opens. Once doors went on the face a box records as its
 * front, those got a door-board on their fronts too — too narrow for a frame or
 * a panel, so it looked like a strip, but it was the door code drawing it, with
 * a door's reveal each side. So a board records that it is one where it is made,
 * and is drawn as a flush strip rather than as a door.
 *
 * Which boxes are boards is read from what they are ordered as — a filler or a
 * panel module, or a tall unit's two side boards — not from anything drawn.
 */
afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

describe.each(["package-a", "package-b", "package-c", "package-d", "package-e"])("%s", (id) => {
  it("draws every filler and finished board as a strip, and nothing else as one", () => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
    expect(setActivePackage(id).ok).toBe(true);
    const wrong: string[] = [];
    let boards = 0;
    for (const box of CABINETS) {
      if (box.kind === "counter" || box.kind === "toe" || box.installOnly) continue;
      const board =
        box.module?.kind === "filler" ||
        box.module?.kind === "panel" ||
        /-panel-[ab](-stack)?$/.test(box.id) ||
        // The fixed panel between the coffee machine and the machine under it
        // (TCM24PS p. 9: not above a drawer). D11 rule 14, round 73.
        (box.id.endsWith("-base") && box.module?.lowerSlot !== undefined);
      if (board) boards += 1;
      const strip = box.face === "strip";
      if (board !== strip) {
        wrong.push(`${box.id} (${box.module?.code ?? "no module"}): ${board ? "a board" : "a cabinet"} drawn as ${strip ? "a strip" : "a door"}`);
      }
    }
    expect(boards, "no filler or board to check").toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });
});

/**
 * Round 73: under the coffee machine, between it and D's dishwasher or E's
 * wine cooler, a fixed panel flush with the doors — not a drawer. TCM24PS's
 * manual says not to install it directly above a cabinet drawer (p. 9). D had
 * a drawer there on the live site.
 */
describe("the gap under the coffee machine", () => {
  it.each(["package-d", "package-e"])("is a fixed panel in %s, not a drawer", (id) => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
    expect(setActivePackage(id).ok).toBe(true);
    const gap = CABINETS.filter((box) => box.slot === "slot-coffee" && box.id.endsWith("-base"));
    expect(gap.map((box) => box.face ?? "a door")).toEqual(["strip"]);
  });
});
