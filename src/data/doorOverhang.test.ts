import { describe, expect, it } from "vitest";
import { doorOverhang } from "./applianceBox";
import type { Slot } from "../types";

/**
 * Round 85: the gap between a column's case and its opening has one owner.
 *
 * A column's door reaches over the 5/8" kit to the next column (D11, round
 * 30), and over its own reveal in the opening on the way. That reveal is a
 * scribe when the column fills its opening. Swap an 18" column into a 24"
 * opening and it is 3": `Filler` builds a strip there, and the door reached
 * over the same 3" — door and strip in one place, and the strip's face (round
 * 85, in the plane of the doors) in front of the door's edge and the handle on
 * it. Past a scribe the gap is the strip's, and the door stays on its case.
 *
 * Written on a slot by hand — a 24" opening — so the figures are the case's
 * and not whatever a package happens to put there.
 */
const slot = { cutout: { w: 24, h: 84, d: 25 } } as unknown as Slot;
const kit = { side: 1 as const, widthIn: 0.625 };
const ft = (inches: number) => inches / 12;

describe("a column's door and the kit beside it", () => {
  it("reaches over the kit when the column fills its opening", () => {
    // 23-1/2" in 24": a quarter inch each side, a scribe; the door covers it
    // and half the kit, less half the eighth-inch reveal.
    expect(doorOverhang(slot, ft(23.5), kit)).toEqual({ side: 1, overIn: 0.25 + 0.3125 - 0.0625 });
  });

  it("stays on its case when a strip stands between it and the kit", () => {
    expect(doorOverhang(slot, ft(18), kit)).toBeNull();
  });
});
