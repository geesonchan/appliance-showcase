import { describe, expect, it } from "vitest";
import { applianceBox } from "./applianceBox";
import { APPLIANCE_BY_ID } from "./catalogue";
import { CHIMNEY, chimneyParts, hoodCabinetFloor, isChimney } from "./hood";
import { packageContext } from "./rules";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE } from "./packages";
import { ROOM, SLOT_BY_ID, ft } from "./slots";

const inches = (feet: number) => feet * 12;

/**
 * The duct cover over a chimney hood.
 *
 * It is the part that makes a chimney hood one: it carries the duct from the
 * canopy to the ceiling, it is sized to the room rather than to the model, and
 * it is why nothing is built above one. Figures from Leo's round-17 note
 * against HMCB30WS.
 */
describe("a chimney reaches the ceiling", () => {
  it("finishes exactly at the ceiling, wherever the canopy is", () => {
    for (const canopyTopIn of [60, 74.5625, 80, 84.75]) {
      const canopyTop = ft(canopyTopIn);
      const chimney = chimneyParts(canopyTop);
      expect(inches(canopyTop + chimney.rise), `canopy top ${canopyTopIn}"`).toBeCloseTo(
        inches(ROOM.wallHeight),
        6,
      );
    }
  });

  it("splits that rise between two sections that tile it exactly", () => {
    for (const canopyTopIn of [60, 74.5625, 84.75]) {
      const chimney = chimneyParts(ft(canopyTopIn));
      expect(chimney.lower.h + chimney.upper.h, `canopy top ${canopyTopIn}"`).toBeCloseTo(
        chimney.rise,
        9,
      );
      expect(chimney.lower.h).toBeGreaterThan(0);
      expect(chimney.upper.h).toBeGreaterThan(0);
    }
  });

  it("steps the upper section in, because the lower one slides over it", () => {
    const chimney = chimneyParts(ft(74.5625));
    expect(inches(chimney.lower.w)).toBeCloseTo(CHIMNEY.widthIn, 6);
    expect(inches(chimney.lower.d)).toBeCloseTo(CHIMNEY.depthIn, 6);
    expect(inches(chimney.lower.w - chimney.upper.w)).toBeCloseTo(CHIMNEY.stepIn, 6);
    expect(inches(chimney.lower.d - chimney.upper.d)).toBeCloseTo(CHIMNEY.stepIn, 6);
  });

  it("moves with the canopy, which moves with the range under it", () => {
    const low = chimneyParts(ft(70));
    const high = chimneyParts(ft(80));
    expect(low.rise).toBeGreaterThan(high.rise);
    expect(inches(low.rise - high.rise)).toBeCloseTo(10, 6);
  });

  // 30-42" is what the assembly covers on its own. A taller room needs the
  // manufacturer's extension, and saying nothing would be drawing a chimney
  // that does not exist.
  it("asks for an extension only when the room is taller than it covers", () => {
    const fits = chimneyParts(ft(ROOM.wallHeight * 12 - CHIMNEY.maxIn));
    expect(fits.needsExtension).toBe(false);
    expect(fits.shortIn).toBe(0);

    const tall = chimneyParts(ft(ROOM.wallHeight * 12 - CHIMNEY.maxIn - 8));
    expect(tall.needsExtension).toBe(true);
    expect(tall.shortIn).toBeCloseTo(8, 6);
  });

  it("is the room the app actually builds, in package C", () => {
    setLayoutParams(DEFAULT_PARAMS);
    expect(setActivePackage("package-c").ok).toBe(true);
    try {
      const hood = APPLIANCE_BY_ID["thermador-hmcb30ws"];
      expect(isChimney(hood)).toBe(true);

      const slot = SLOT_BY_ID["slot-hood"];
      const canopyTop = slot.position[1] + applianceBox(slot, hood).h;
      const chimney = chimneyParts(canopyTop);

      expect(canopyTop + chimney.rise).toBeCloseTo(ROOM.wallHeight, 9);
      expect(chimney.lower.h + chimney.upper.h).toBeCloseTo(chimney.rise, 9);
      // An eight-foot ceiling is inside the assembly's own travel.
      expect(chimney.needsExtension).toBe(false);
    } finally {
      setActivePackage(DEFAULT_PACKAGE.id);
      setLayoutParams(DEFAULT_PARAMS);
    }
  });

  it("does not hang one on an under-cabinet hood", () => {
    expect(isChimney(APPLIANCE_BY_ID["thermador-ph36hws"])).toBe(false);
  });
});

/**
 * What the install list says about a chimney hood, and what it must not say.
 */
describe("the install list follows the hood that is actually specified", () => {
  it("does not ask for a cutout in a cabinet that is not there", () => {
    setLayoutParams(DEFAULT_PARAMS);
    expect(setActivePackage("package-c").ok).toBe(true);
    try {
      // Nothing is built over a chimney hood, so there is no cabinet floor to
      // cut. Telling an installer to cut one is worse than saying nothing.
      expect(hoodCabinetFloor()).toBe(null);
      const context = packageContext(
        APPLIANCE_BY_ID["thermador-hmcb30ws"],
        null,
        APPLIANCE_BY_ID["maytag-mfes4030rs"],
      );
      expect(context.hoodHasCabinetAbove).toBe(false);
    } finally {
      setActivePackage(DEFAULT_PACKAGE.id);
      setLayoutParams(DEFAULT_PARAMS);
    }
  });

  it("does ask for one under an under-cabinet hood, which has a box over it", () => {
    setLayoutParams(DEFAULT_PARAMS);
    setActivePackage(DEFAULT_PACKAGE.id);
    expect(hoodCabinetFloor()).not.toBe(null);
    const context = packageContext(
      APPLIANCE_BY_ID["thermador-ph36hws"],
      null,
      APPLIANCE_BY_ID["thermador-prg366wh"],
    );
    expect(context.hoodHasCabinetAbove).toBe(true);
  });
});
