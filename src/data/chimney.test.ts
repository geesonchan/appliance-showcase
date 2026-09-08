import { describe, expect, it } from "vitest";
import { applianceBox } from "./applianceBox";
import { APPLIANCE_BY_ID } from "./catalogue";
import { CHIMNEY, canopySolid, chimneyParts, hoodCabinetFloor, isChimney } from "./hood";
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

  it("keeps both sections one section long and slides them, canopy to ceiling", () => {
    for (const canopyTopIn of [60, 74.5625, 84.75]) {
      const chimney = chimneyParts(ft(canopyTopIn));
      const where = `canopy top ${canopyTopIn}"`;

      // Neither section changes length: what changes is how much of the inner
      // one is still inside the outer.
      expect(inches(chimney.lower.h), where).toBeCloseTo(CHIMNEY.sectionIn, 6);
      expect(inches(chimney.upper.h), where).toBeCloseTo(CHIMNEY.sectionIn, 6);

      // The outer hangs off the canopy's top; the inner finishes at the ceiling.
      expect(chimney.lower.from, where).toBe(0);
      expect(chimney.upper.from + chimney.upper.h, where).toBeCloseTo(chimney.rise, 9);

      // And they still touch: the overlap is what the two lengths have left.
      expect(inches(chimney.overlap), where).toBeCloseTo(2 * CHIMNEY.sectionIn - inches(chimney.rise), 6);
      expect(chimney.overlap, where).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the two sections the same size to within half an inch", () => {
    const chimney = chimneyParts(ft(74.5625));
    expect(inches(chimney.lower.w)).toBeCloseTo(CHIMNEY.widthIn, 6);
    expect(inches(chimney.lower.d)).toBeCloseTo(CHIMNEY.depthIn, 6);
    // A telescope, not a stepped stack: the joint should barely read.
    expect(inches(chimney.lower.w - chimney.upper.w)).toBeLessThanOrEqual(0.5);
    expect(inches(chimney.lower.d - chimney.upper.d)).toBeLessThanOrEqual(0.5);
    expect(chimney.lower.w).toBeGreaterThan(chimney.upper.w);
  });

  it("moves with the canopy, which moves with the range under it", () => {
    const low = chimneyParts(ft(70));
    const high = chimneyParts(ft(80));
    expect(low.rise).toBeGreaterThan(high.rise);
    expect(inches(low.rise - high.rise)).toBeCloseTo(10, 6);
  });

  /**
   * What the part can do, rather than what the sheet rates it for.
   *
   * One section collapsed at the bottom, two nearly drawn apart at the top. A
   * room outside that is a room this chimney does not fit: below, it will not
   * shorten; above, it takes the extension, and saying nothing would be drawing
   * a chimney that does not exist.
   */
  it("covers one section at the shortest and two at the longest", () => {
    const ceilingIn = ROOM.wallHeight * 12;

    const collapsed = chimneyParts(ft(ceilingIn - CHIMNEY.sectionIn));
    expect(collapsed.needsExtension).toBe(false);
    expect(collapsed.tooLow).toBe(false);
    expect(inches(collapsed.overlap)).toBeCloseTo(CHIMNEY.sectionIn, 6);

    const extended = chimneyParts(ft(ceilingIn - CHIMNEY.sectionIn * 2));
    expect(extended.needsExtension).toBe(false);
    expect(inches(extended.overlap)).toBeCloseTo(0, 6);

    const tall = chimneyParts(ft(ceilingIn - CHIMNEY.sectionIn * 2 - 8));
    expect(tall.needsExtension).toBe(true);
    expect(tall.shortIn).toBeCloseTo(8, 6);

    const low = chimneyParts(ft(ceilingIn - CHIMNEY.sectionIn + 4));
    expect(low.tooLow).toBe(true);
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
      expect(chimney.upper.from + chimney.upper.h).toBeCloseTo(chimney.rise, 9);
      // An eight-foot ceiling is inside the assembly's own travel, at the
      // collapsed end of it: this is the room the sheet's 30" is drawn for.
      expect(chimney.needsExtension).toBe(false);
      expect(chimney.tooLow).toBe(false);
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

/**
 * The canopy is a frustum, not a wedge.
 *
 * A wall canopy collects on all three open sides and gathers into the flue, so
 * it draws in on the front and on both flanks. Seen from the front it is an
 * isosceles trapezoid whose sloping edges land on the chimney's own width;
 * extruding one section across the machine only ever tapered front to back.
 * From docs/reference/hmcb30ws-spec.png.
 */
describe("the canopy gathers into the flue", () => {
  const canopy = () =>
    canopySolid({
      widthIn: 29.9375,
      depthIn: 23.1875,
      heightIn: 8.5625,
      frontLipIn: 5,
      topWidthIn: CHIMNEY.widthIn,
      topDepthIn: CHIMNEY.depthIn,
    });

  it("lands on exactly the chimney's own section", () => {
    const c = canopy();
    expect(c.top.w).toBeCloseTo(CHIMNEY.widthIn, 6);
    expect(c.top.d).toBeCloseTo(CHIMNEY.depthIn, 6);
  });

  it("draws in the same amount on each flank", () => {
    const c = canopy();
    // Symmetric by construction, and the figure is worth stating: 29-15/16"
    // gathering to 13-3/16" is 8-3/8" off each side.
    expect(c.insetX).toBeCloseTo((29.9375 - CHIMNEY.widthIn) / 2, 6);
    expect(c.insetX).toBeGreaterThan(0);
    // And back on the front, with the wall side staying flat.
    expect(c.insetZ).toBeCloseTo(23.1875 - CHIMNEY.depthIn, 6);
    expect(c.backZ).toBe(0);
  });

  it("stands the front face up before the slope starts", () => {
    const c = canopy();
    expect(c.lip).toBe(5);
    expect(c.height).toBe(8.5625);
    expect(c.lip).toBeLessThan(c.height);
  });

  it("never gathers outward, whatever it is handed", () => {
    const c = canopySolid({
      widthIn: 12,
      depthIn: 8,
      heightIn: 6,
      frontLipIn: 9,
      topWidthIn: CHIMNEY.widthIn,
      topDepthIn: CHIMNEY.depthIn,
    });
    expect(c.top.w).toBeLessThanOrEqual(12);
    expect(c.top.d).toBeLessThanOrEqual(8);
    expect(c.lip).toBeLessThanOrEqual(c.height);
  });
});
