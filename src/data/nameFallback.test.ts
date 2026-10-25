import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import * as machineLabel from "./machineLabel";
import { setActivePackage } from "./layoutState";
import { resetRoom } from "./testRoom";
import type { Appliance } from "../types";

/**
 * Round 99c, Leo: a machine with no name found is called by its position's
 * own name, and the page goes on — "查不到名字：用那个位置自己的名字". Since
 * round 99 the two functions threw instead, and in round 99b one throw took
 * the whole page down. A bill item with neither a position nor a word of its
 * own shows its width and code only (Leo: 甲). Each fallback is written down
 * (`NAME_FALLBACKS`), so the words test can still say none was needed.
 */

const { billLabelKey, slotLabelKey } = machineLabel;
const fallbacks = () => (machineLabel as { NAME_FALLBACKS?: string[] }).NAME_FALLBACKS ?? ["(no record of fallbacks)"];

afterAll(() => {
  resetRoom();
});

/** A machine of a kind the page has no name for. */
const unknownKind = (): Appliance => ({ ...APPLIANCE_BY_ID["thermador-t36bt120ns"], category: "toaster" as Appliance["category"] });

describe("a name not found (round 99c)", () => {
  it("names a bill item whose position has nothing in it by the position's own name", () => {
    setActivePackage("package-a"); // A has no oven: nothing chosen, no default
    const before = fallbacks().length;
    expect(billLabelKey({ widthIn: 30, slot: "slot-oven" }, {})).toBe("slot.oven");
    expect(fallbacks().length).toBe(before + 1);
  });

  it("names a machine of a kind it does not know by its position's own name, on a pin and on a bill", () => {
    const before = fallbacks().length;
    expect([
      slotLabelKey("slot-fridge", unknownKind()),
      billLabelKey({ widthIn: 36, slot: "slot-fridge" }, { "slot-fridge": unknownKind() }),
    ]).toEqual(["slot.fridge", "slot.fridge"]);
    expect(fallbacks().length).toBe(before + 2);
  });

  it("gives a bill item with neither a position nor a word no name at all, its width and code shown alone", () => {
    expect(billLabelKey({ widthIn: 3, code: "PNL3" }, {})).toBeNull();
  });
});
