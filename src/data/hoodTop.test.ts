import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as layoutState from "./layoutState";
import { APPLIANCE_BY_ID } from "./catalogue";
import { CABINETS } from "./cabinets";
import { hoodCabinetFloor } from "./hood";
import { resolveRoughIn } from "./roughIn";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import type { Appliance } from "../types";

/**
 * The top of a wall canopy has one answer: the model's own height. Round 78.
 *
 * The bridge over the canopy, the duct hole in its floor and a power point in
 * that cabinet all read the slot's 18" until round 78, while the canopy and its
 * duct collar were drawn at the model's height. Package A with Zephyr's
 * AK7136BS-BF, 7-3/8" tall (docs/reference/gustb_spec.pdf p. 1), hung with
 * 10-5/8" of open wall over it.
 *
 * Everything here is read off what is built — the cabinet boxes and the
 * model's own figure — never off `hoodBridgeBand`, which is under test. The
 * hood is set through `setHoodModel` where it exists, so the same file runs on
 * the code before it and shows the gap there. One assertion per test.
 */
const PH36HWS = APPLIANCE_BY_ID["thermador-ph36hws"];
const AK7136BS = APPLIANCE_BY_ID["zephyr-ak7136bs-bf"];
// "+ 0" so a rounding of -0.0000001 reads as 0, not -0.
const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000 + 0;

function hang(hood: Appliance) {
  resetRoom();
  (layoutState as { setHoodModel?: (a: Appliance) => void }).setHoodModel?.(hood);
}

/** The canopy's top as the model says it is: where it hangs plus its own height. */
const canopyTop = (hood: Appliance) => SLOT_BY_ID["slot-hood"].position[1] + (hood.heightIn ?? 0) / 12;

/** The floor of the cabinet over the canopy, as the boxes were cut. */
const bridgeFloor = () => {
  const bridge = CABINETS.filter((box) => box.slot === "slot-hood" && box.kind === "upper");
  return Math.min(...bridge.map((box) => box.position[1] - box.size[1] / 2));
};

beforeEach(() => resetRoom());
afterAll(() => hang(PH36HWS));

describe("a wall canopy's top has one answer", () => {
  it("has a 7-3/8 inch body for AK7136BS-BF, the figure the gap below is measured against", () => {
    expect(AK7136BS.heightIn).toBe(7.375);
  });

  it("stands the cabinet over AK7136BS-BF on its top, with no open wall between", () => {
    hang(AK7136BS);
    expect(inches(bridgeFloor() - canopyTop(AK7136BS))).toBe(0);
  });

  it("cuts AK7136BS-BF's duct hole at its own top, where its collar is", () => {
    hang(AK7136BS);
    expect(inches((hoodCabinetFloor() ?? Number.NaN) - canopyTop(AK7136BS))).toBe(0);
  });

  it("keeps package A's own PH36HWS where it was: the cabinet over it at 84-3/4 inches", () => {
    hang(PH36HWS);
    expect(inches(bridgeFloor())).toBe(84.75);
  });

  // No model in the catalogue both roughs in a point in the cabinet over it
  // and is other than 18" tall, so the case is built lopsided: PH36HWS's own
  // point, on a PH36HWS 12" tall.
  it("moves a power point in the cabinet over the hood with that cabinet's floor", () => {
    const where = (hood: Appliance) => {
      hang(hood);
      const [point] = resolveRoughIn("slot-hood", hood);
      return { floor: inches(bridgeFloor()), offset: inches(point.position[1] - bridgeFloor()) };
    };
    const standard = where(PH36HWS);
    const short = where({ ...PH36HWS, heightIn: 12 } as Appliance);
    expect({ floorMoved: short.floor !== standard.floor, offset: short.offset }).toEqual({
      floorMoved: true,
      offset: standard.offset,
    });
  });
});
