import { afterAll, describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import { flushOffset } from "./applianceBox";
import { ISLAND_HOOD, islandHoodParts } from "./hood";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import { resetRoom } from "./testRoom";
import { PACKAGE_BY_ID } from "./packages";
import { REQUESTED_PARAMS, RUNS, ft } from "./room";
import { ISLAND, SLOT_BY_ID } from "./slots";
import type { Appliance, Package, PackageSlot } from "../types";

/**
 * A hood hangs over the cooking surface, and the cooking surface may be in the
 * island. D22 step 3, round 52.
 *
 * Until this round the hood was placed on the run carrying `slot-range`, and a
 * package with no range threw on its way out of the generator: "the template
 * left something off the runs". A package with a cooktop in the island and a
 * hood over it — which is package E's shape — could not be built at all, and
 * that is what this builds, through the same `setActivePackage` the app uses.
 *
 * Package E's own configuration is a later round. This is package A with its
 * range, microwave drawer and wine cabinet taken off, the cooktop put in the
 * island, and the island hood over it: the smallest package that asks the
 * question.
 */
const ID = "test-hood-over-island";
const CATALOGUE = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
const byModel = (model: string) => CATALOGUE.find((entry) => entry.model === model)!;

const cooktopSlot: PackageSlot = {
  slotId: "slot-cooktop",
  category: "cooktop",
  widthIn: 36,
  heightIn: null,
  depthIn: null,
  installType: "drop-in",
  builtForCooktopIn: null,
  tallUnit: false,
  beside: null,
  sillIn: 0,
  standsOver: null,
  enclosure: false,
  panelReady: null,
  bestView: null,
  utilities: { gas: null, power: { voltage: 240, amps: 50, dedicated: true }, duct: null },
};

const islandHoodSlot = (base: PackageSlot): PackageSlot => ({
  ...base,
  widthIn: 42,
  installType: "island",
  // The hood is hung off the cooking surface, and this one's is the island's
  // counter: 36" to the top, with the glass a quarter proud of it (D20).
  builtForCooktopIn: 36,
  // Ducted as its guide shows. Round 58: an island hood may not be declared up
  // through a cabinet or out through a wall, and A's hood slot, which this is
  // built from, is up-through-cabinet.
  utilities: { gas: null, power: null, duct: { diameterIn: 8, route: "through-ceiling" } },
});

function islandCooking(): Package {
  const a = PACKAGE_BY_ID["package-a"];
  const hood = a.slots.find((slot) => slot.slotId === "slot-hood")!;
  const dropped = new Set(["slot-range", "slot-hood", "slot-microwave", "slot-wine"]);
  const {
    "slot-range": _r,
    "slot-microwave": _m,
    "slot-wine": _w,
    ...selection
  } = a.defaultSelection;
  return {
    ...a,
    id: ID,
    // Round 56: a cooktop island has a 48" aisle (D20), and choosing a
    // package whose island has a cooktop at the ordinary 42" is now refused.
    defaultLayout: { ...a.defaultLayout, aisleIn: 48 },
    slots: [
      ...a.slots.filter((slot) => !dropped.has(slot.slotId)),
      cooktopSlot,
      islandHoodSlot(hood),
    ],
    defaultSelection: {
      ...selection,
      "slot-cooktop": byModel("CIT367YG").id,
      "slot-hood": byModel("HMIB42WS").id,
    },
  };
}

function build(islandOrientation: "parallel" | "perpendicular") {
  PACKAGE_BY_ID[ID] = islandCooking();
  resetRoom();
  const active = setActivePackage(ID);
  expect(active.ok, JSON.stringify(active)).toBe(true);
  const result = setLayoutParamsGrowing({
    ...REQUESTED_PARAMS,
    islandLengthIn: 72,
    islandOrientation,
  });
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
  expect(ISLAND.present).toBe(true);
}

afterAll(() => {
  resetRoom();
  delete PACKAGE_BY_ID[ID];
});

describe.each(["parallel", "perpendicular"] as const)(
  "a hood over an island cooktop, island %s",
  (orientation) => {
    it("builds at all, which a package with no range did not", () => {
      build(orientation);
      expect(SLOT_BY_ID["slot-cooktop"].mount).toBe("island");
    });

    it("hangs the hood over the cooktop, not on the run the range would have been on", () => {
      build(orientation);
      const cooktop = SLOT_BY_ID["slot-cooktop"];
      const hood = SLOT_BY_ID["slot-hood"];
      expect(hood.mount).toBe("island");
      expect(hood.position[0]).toBeCloseTo(cooktop.position[0], 9);
      expect(hood.position[2]).toBeCloseTo(cooktop.position[2], 9);
    });

    it("is drawn over the cooktop too, with no wall to sit flush against", () => {
      build(orientation);
      const hood = SLOT_BY_ID["slot-hood"];
      const model = CATALOGUE.find((entry) => entry.model === "HMIB42WS")!;
      expect(flushOffset(hood, ft(model.depthIn ?? 0))).toBe(0);
    });

    it("faces the way the cooktop faces, so its own front is the cook's side", () => {
      build(orientation);
      expect(SLOT_BY_ID["slot-hood"].rotationY).toBeCloseTo(
        SLOT_BY_ID["slot-cooktop"].rotationY,
        9,
      );
    });

    it("hangs at the 72 inch underside D20 settled, inside the drawing's span", () => {
      build(orientation);
      const underside = SLOT_BY_ID["slot-hood"].position[1];
      expect(underside).toBeCloseTo(ft(ISLAND_HOOD.undersideIn), 9);
      expect(ISLAND_HOOD.undersideIn).toBe(72);
      expect(islandHoodParts(ISLAND_HOOD.undersideIn).withinSpan).toBe(true);
    });

    it("leaves the wall cabinets alone, because nothing cooks against the wall", () => {
      build(orientation);
      // No hood bank, no bridge, no chimney breast on either run: the machine
      // is not on a wall at all.
      const onAWall = RUNS.flatMap((run) =>
        [...run.segments, ...run.uppers].filter((part) =>
          "modules" in part ? part.modules.some((m) => m.slot === "slot-hood") : false,
        ),
      );
      expect(onAWall).toEqual([]);
    });
  },
);

describe("what a template cannot be built without", () => {
  it("accepts a package whose cooking surface is a cooktop", () => {
    PACKAGE_BY_ID[ID] = islandCooking();
    resetRoom();
    expect(setActivePackage(ID).ok).toBe(true);
  });

  /**
   * A package the template cannot build is a loud failure, not a refusal the
   * customer sees: it is a mistake in the data, and it is thrown where it is
   * found. So these say which slot was missing, which is the whole point of the
   * template naming what it needs.
   */
  const without = (slotId: string) => {
    const missing = `test-without-${slotId}`;
    const base = islandCooking();
    PACKAGE_BY_ID[missing] = {
      ...base,
      id: missing,
      slots: base.slots.filter((slot) => slot.slotId !== slotId),
      defaultSelection: Object.fromEntries(
        Object.entries(base.defaultSelection).filter(([slot]) => slot !== slotId),
      ),
    };
    resetRoom();
    try {
      setActivePackage(missing);
      return null;
    } catch (error) {
      return String(error);
    } finally {
      delete PACKAGE_BY_ID[missing];
      resetRoom();
    }
  };

  it("refuses a package with a cooking surface and no hood over it", () => {
    expect(without("slot-hood")).toContain("slot-hood");
  });

  it("refuses a package with no cooking surface at all, naming both", () => {
    const thrown = without("slot-cooktop");
    expect(thrown).toContain("slot-range or slot-cooktop");
  });
});
