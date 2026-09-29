import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { CABINETS } from "./cabinets";
import { toWorld } from "./frame";
import { hoodSideFillers } from "./hood";
import { setActivePackage, setHoodModel } from "./layoutState";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import type { Appliance } from "../types";

/**
 * The strips each side of a wall hood narrower than its slot. Round 79, Leo's
 * site practice: in the plane of the wall cabinets, 12" deep against the wall,
 * from the hood's underside to the cabinet over it.
 *
 * Lopsided on purpose: a 30" AK7300AS in package A's 36" slot, 11" tall with a
 * 3" front face, so a strip the height of the front, or as deep as the run, or
 * centred on the run's middle, each shows. The cabinets are read as they were
 * cut, never through the function under test. One assertion per test.
 *
 * The code before round 79 had no such function: it drew these strips as a
 * base cabinet's filler, 24" deep on the run's centre line. That difference is
 * proved by the pixel diff of the round, not here.
 */
const AK7300AS = APPLIANCE_BY_ID["zephyr-ak7300as"];
const PH36HWS = APPLIANCE_BY_ID["thermador-ph36hws"];
const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000 + 0;

function hang(hood: Appliance) {
  resetRoom();
  setHoodModel(hood);
  const slot = SLOT_BY_ID["slot-hood"];
  return { slot, strips: hoodSideFillers(slot, hood) };
}

/**
 * The wall cabinets round the hood: the bridge over it and the box either side
 * of it, found by where they stand — touching the slot's 36" span. The crown
 * along the top is left out: it stands 3/4" proud of the doors on purpose.
 */
const uppersOnTheHoodRun = () => {
  const slot = SLOT_BY_ID["slot-hood"];
  const [from, to] = [slot.position[0] - slot.cutout.w / 24, slot.position[0] + slot.cutout.w / 24];
  const touch = 1 / 96;
  return CABINETS.filter(
    (box) =>
      box.kind === "upper" &&
      box.run === "back" &&
      !box.id.includes("crown") &&
      box.position[0] - box.size[0] / 2 <= to + touch &&
      box.position[0] + box.size[0] / 2 >= from - touch,
  );
};

afterAll(() => hang(PH36HWS));

describe("the strips beside a 30 inch hood in a 36 inch slot", () => {
  it("is three inches wide each side", () => {
    const { strips } = hang(AK7300AS);
    expect(strips && inches(strips.widthFt)).toBe(3);
  });

  it("is as deep as the wall cabinets beside it", () => {
    const { strips } = hang(AK7300AS);
    const depths = new Set(uppersOnTheHoodRun().map((box) => inches(box.size[2])));
    expect({ strip: strips && inches(strips.depthFt), cabinets: [...depths] }).toEqual({ strip: 12, cabinets: [12] });
  });

  it("puts its back on the wall, where the wall cabinets' backs are", () => {
    const { slot, strips } = hang(AK7300AS);
    const [, , z] = toWorld(slot, strips!.x, 0, strips!.z - strips!.depthFt / 2);
    const cabinetBacks = new Set(uppersOnTheHoodRun().map((box) => inches(box.position[2] - box.size[2] / 2)));
    expect({ strip: inches(z), cabinets: [...cabinetBacks] }).toEqual({ strip: [...cabinetBacks][0], cabinets: [[...cabinetBacks][0]] });
  });

  it("reaches up to the floor of the cabinet over the hood", () => {
    const { slot, strips } = hang(AK7300AS);
    const bridge = CABINETS.filter((box) => box.slot === "slot-hood" && box.kind === "upper");
    const floor = Math.min(...bridge.map((box) => box.position[1] - box.size[1] / 2));
    expect(inches(slot.position[1] + strips!.y + strips!.heightFt / 2 - floor)).toBe(0);
  });

  it("comes down to the hood's underside and no further", () => {
    const { strips } = hang(AK7300AS);
    expect(inches(strips!.y - strips!.heightFt / 2)).toBe(0);
  });

  it("stands clear of the hood, either side of it", () => {
    const { strips } = hang(AK7300AS);
    expect(inches(strips!.x - strips!.widthFt / 2)).toBe(15);
  });
});

describe("where there are no strips", () => {
  it("has none beside a hood as wide as its slot", () => {
    expect(hang(PH36HWS).strips).toBeNull();
  });

  // Package B's liner is 33-3/4" in a 42" housing: 4-1/8" each side, well past
  // the half inch, so only the rule about inserts keeps the strips out.
  it("has none beside an insert liner, which hangs in its housing", () => {
    resetRoom();
    setActivePackage("package-b");
    const liner = APPLIANCE_BY_ID["thermador-vcin36gws"];
    setHoodModel(liner);
    const slot = SLOT_BY_ID["slot-hood"];
    expect({ gapEachSideIn: (slot.cutout.w - liner.widthIn!) / 2, strips: hoodSideFillers(slot, liner) }).toEqual({
      gapEachSideIn: 4.125,
      strips: null,
    });
  });

  it("has none beside a hood hung over an island", () => {
    const island = { ...SLOT_BY_ID["slot-hood"], mount: "island" as const };
    expect(hoodSideFillers(island, AK7300AS)).toBeNull();
  });
});
