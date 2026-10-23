import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { candidatesFor } from "./candidates";
import { rangeModelFor } from "./cookingSurface";
import { fridgeModelFor } from "./fridgeMount";
import { hoodModelFor } from "./hoodMount";
import { setActivePackage, setFridgeModel, setHoodModel, setLayoutParamsGrowing, setRangeModel } from "./layoutState";
import { oneWallWantedIn, wallRequirement, type LayoutParams } from "./layoutTemplate";
import { BUILDABLE_PACKAGES, PACKAGE, PACKAGE_BY_ID } from "./packages";
import type { LayoutShape } from "./layoutShape";
import { LAYOUT_PARAMS, REQUESTED_PARAMS, RUNS } from "./room";
import { resetRoom } from "./testRoom";
import type { Appliance, Package, SlotId } from "../types";

/**
 * Round 99a (docs/plans/round-99a-plan.md; Leo: "一字型的柜列看来没走这条规则"):
 * on one wall, A's, B's and C's rooms were built round the package's own
 * range, hood and refrigerator whatever was chosen, so round 84's fillers
 * beside a narrow range, round 83's base under a rangetop, round 87's housing
 * over an insert, round 89's surround and round 97's microwave in the hood's
 * place never followed the swap there. The choice was recorded as "one wall",
 * and looked for under the shape of the package object the room is built
 * from, which for a package that writes no one-wall shape of its own is the
 * L's.
 */

afterAll(() => resetRoom());

/** A package's room on one wall, at the wall it asks for there. */
function oneWall(entry: Package) {
  resetRoom();
  if (!setActivePackage(entry.id).ok) throw new Error(`${entry.code} will not build`);
  const asked: LayoutParams = { ...REQUESTED_PARAMS, shape: "one-wall" };
  asked.backWallIn = Math.max(asked.backWallIn, oneWallWantedIn(asked, entry));
  const built = setLayoutParamsGrowing(asked);
  if (!built.ok) throw new Error(`${entry.code} on one wall will not build`);
}

/** A package's room in the L as it opens. */
function theL(entry: Package) {
  resetRoom();
  if (!setActivePackage(entry.id).ok) throw new Error(`${entry.code} will not build`);
}

const MODELS: { slotId: SlotId; set: (a: Appliance) => unknown; built: (p: Package) => Appliance | undefined }[] = [
  { slotId: "slot-range", set: (a) => setRangeModel(a), built: (p) => rangeModelFor(p) as Appliance | undefined },
  { slotId: "slot-hood", set: (a) => setHoodModel(a), built: (p) => hoodModelFor(p) },
  { slotId: "slot-fridge", set: (a) => setFridgeModel(a), built: (p) => fridgeModelFor(p) },
];

/** Every model the slot offers that goes in, in the room standing now. */
const fitting = (slotId: SlotId) =>
  candidatesFor(slotId, PACKAGE)
    .filter((candidate) => candidate.fit.fits)
    .map((candidate) => candidate.appliance);

describe("one wall builds its room round the range, hood and refrigerator chosen (round 99a)", () => {
  it("in every package, for every model each of the three slots can hold", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const entry of BUILDABLE_PACKAGES) {
      for (const { slotId, set, built } of MODELS) {
        oneWall(entry);
        if (!PACKAGE.slots.some((slot) => slot.slotId === slotId)) continue;
        for (const appliance of fitting(slotId)) {
          oneWall(entry);
          set(appliance);
          checked++;
          const round = built(PACKAGE);
          if (round?.id !== appliance.id) wrong.push(`${entry.code} ${slotId} ${appliance.model}: built round ${round?.model ?? "nothing"}`);
        }
      }
    }
    expect({ checked, wrong }).toEqual({ checked: 70, wrong: [] });
  });

  it("closes A's 30-inch range in with a filler each side, as the L does", () => {
    const a = PACKAGE_BY_ID["package-a"];
    const prg304 = Object.values(APPLIANCE_BY_ID).find((x) => x.model === "PRG304WH")!;
    const rangeAs = (shape: LayoutShape) => {
      if (shape === "L") theL(a);
      else oneWall(a);
      setRangeModel(prg304);
      const segment = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-range")!;
      const bill = wallRequirement(LAYOUT_PARAMS, "back", a).items.find((item) => item.slot === "slot-range");
      return { modules: segment.modules.map((m) => m.code).join(" + "), bill: bill?.code };
    };
    expect({ L: rangeAs("L"), oneWall: rangeAs("one-wall") }).toEqual({
      L: { modules: "BF3 + RO30 + BF3", bill: "BF3 + RO30 + BF3" },
      oneWall: { modules: "BF3 + RO30 + BF3", bill: "BF3 + RO30 + BF3" },
    });
  });

  it("keeps D's and E's choices on one wall apart from their L's, as round 98b-2 has it", () => {
    const d = PACKAGE_BY_ID["package-d"];
    theL(d);
    const lFridge = fridgeModelFor(PACKAGE)?.model;
    oneWall(d);
    expect({ lFridge, oneWallFridge: fridgeModelFor(PACKAGE)?.model }).toEqual({ lFridge: "T30IR905SP", oneWallFridge: "T24IR905SP" });
  });
});
