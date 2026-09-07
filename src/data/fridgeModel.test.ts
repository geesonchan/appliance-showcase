import { describe, expect, it } from "vitest";
import { APPLIANCES, APPLIANCES_BY_SLOT } from "./catalogue";
import {
  FRIDGE_PROPORTIONS,
  GENERIC_SPLIT,
  doorConfigOf,
  doorSplitOf,
  fridgeParts,
  hasGenericDoors,
} from "./fridgeModel";
import { FIXTURES } from "./testFixtures";
import type { Appliance } from "../types";

const fridge = (over: Partial<Appliance> = {}) =>
  ({ ...FIXTURES.fridgeBuiltIn, category: "refrigerator", ...over }) as Appliance;
const box = { w: 3, h: 7 };
const parts = (over: Partial<Appliance> = {}) => fridgeParts(fridge(over), box);

describe("a refrigerator has the fronts its record says it has", () => {
  it("hangs two doors over two drawers on a four-door", () => {
    const panels = parts({ doorConfig: "french-door-2-drawer" });
    expect(panels).toHaveLength(4);
    expect(panels.filter((p) => p.id.startsWith("door"))).toHaveLength(2);
    expect(panels.filter((p) => p.id.startsWith("drawer"))).toHaveLength(2);
    // Four fronts, four handles: Leo's count for a T36BT120NS.
    expect(panels.map((p) => p.handle)).toHaveLength(4);
  });

  it("counts the fronts for every configuration", () => {
    const counts: Record<NonNullable<Appliance["doorConfig"]>, number> = {
      "french-door-2-drawer": 4,
      "french-door-1-drawer": 3,
      "bottom-freezer": 2,
      "side-by-side": 2,
      column: 1,
    };
    for (const [doorConfig, count] of Object.entries(counts)) {
      expect(parts({ doorConfig: doorConfig as Appliance["doorConfig"] }), doorConfig).toHaveLength(
        count,
      );
    }
  });

  it("tiles the front: every panel inside the box, none overlapping", () => {
    for (const doorConfig of [
      "french-door-2-drawer",
      "french-door-1-drawer",
      "bottom-freezer",
      "side-by-side",
      "column",
    ] as const) {
      for (const panel of parts({ doorConfig })) {
        expect(Math.abs(panel.x) + panel.w / 2, `${doorConfig} ${panel.id}`).toBeLessThanOrEqual(
          box.w / 2 + 1e-9,
        );
        expect(panel.y - panel.h / 2, `${doorConfig} ${panel.id}`).toBeGreaterThanOrEqual(-1e-9);
        expect(panel.y + panel.h / 2, `${doorConfig} ${panel.id}`).toBeLessThanOrEqual(
          box.h + 1e-9,
        );
      }
    }
  });

  // A french door pair opens outward from the middle, so its handles are in
  // the middle. Getting that backwards puts both handles against the cabinets.
  it("puts a pair's handles on the edges that open", () => {
    const doors = parts({ doorConfig: "french-door-2-drawer" }).filter((p) =>
      p.id.startsWith("door"),
    );
    for (const door of doors) {
      expect(Math.abs(door.handle.x)).toBeLessThan(Math.abs(door.x));
      expect(door.handle.along).toBe("y");
    }
  });

  it("pulls a drawer from a bar across it", () => {
    const drawers = parts({ doorConfig: "french-door-2-drawer" }).filter((p) =>
      p.id.startsWith("drawer"),
    );
    for (const drawer of drawers) expect(drawer.handle.along).toBe("x");
  });
});

describe("what the record does not say is marked as a guess", () => {
  it("draws the commonest front and flags it", () => {
    const unsaid = fridge({ doorConfig: null });
    expect(doorConfigOf(unsaid)).toBe("french-door-1-drawer");
    expect(hasGenericDoors(unsaid)).toBe(true);
    expect(hasGenericDoors(fridge({ doorConfig: "column" }))).toBe(false);
  });

  // Not a fixture: if the sheet ever loses this, the test says so.
  it("knows a T36BT120NS is a four-door", () => {
    const specified = APPLIANCES_BY_SLOT["slot-fridge"].find((a) => a.model === "T36BT120NS");
    expect(specified, "T36BT120NS is not in the catalogue").toBeDefined();
    expect(specified!.doorConfig).toBe("french-door-2-drawer");
    expect(hasGenericDoors(specified!)).toBe(false);
  });
});

describe("the front matches the elevation", () => {
  const four = () => parts({ doorConfig: "french-door-2-drawer" });
  const inches = (feet: number) => feet * 12;

  it("stands the fronts on the toe grille, not on the floor", () => {
    const lowest = Math.min(...four().map((p) => p.y - p.h / 2));
    expect(lowest).toBeCloseTo(doorSplitOf(fridge(), box.h).toe, 9);
    expect(lowest).toBeGreaterThan(0);
  });

  it("leaves an eighth between the doors and a quarter between the drawers", () => {
    const panels = four();
    const [left, right] = panels.filter((p) => p.id.startsWith("door"));
    expect(inches(right.x - right.w / 2 - (left.x + left.w / 2))).toBeCloseTo(
      FRIDGE_PROPORTIONS.centreGapIn,
      6,
    );

    const drawers = panels
      .filter((p) => p.id.startsWith("drawer"))
      .sort((a, b) => a.y - b.y);
    expect(inches(drawers[1].y - drawers[1].h / 2 - (drawers[0].y + drawers[0].h / 2))).toBeCloseTo(
      FRIDGE_PROPORTIONS.gapIn,
      6,
    );
  });

  it("runs a door handle down four fifths of its door and a drawer bar across nine tenths", () => {
    for (const panel of four()) {
      const fraction = panel.id.startsWith("door")
        ? FRIDGE_PROPORTIONS.doorHandleFraction
        : FRIDGE_PROPORTIONS.drawerHandleFraction;
      const against = panel.id.startsWith("door") ? panel.h : panel.w;
      expect(panel.handle.length / against, panel.id).toBeCloseTo(fraction, 6);
    }
  });

  it("keeps every handle on the panel it belongs to", () => {
    for (const panel of four()) {
      const half = panel.handle.length / 2;
      if (panel.handle.along === "y") {
        expect(panel.handle.y + half, panel.id).toBeLessThanOrEqual(panel.y + panel.h / 2 + 1e-9);
        expect(Math.abs(panel.handle.x - panel.x), panel.id).toBeLessThanOrEqual(panel.w / 2);
      } else {
        expect(panel.handle.x + half, panel.id).toBeLessThanOrEqual(panel.x + panel.w / 2 + 1e-9);
        expect(panel.handle.y, panel.id).toBeLessThanOrEqual(panel.y + panel.h / 2 + 1e-9);
      }
    }
  });
});

describe("the front divides the way the elevation does", () => {
  const specified = () =>
    APPLIANCES_BY_SLOT["slot-fridge"].find((a) => a.model === "T36BT120NS")!;
  const inches = (feet: number) => feet * 12;
  /** The opening a built-in refrigerator goes in, in feet. */
  const opening = 84 / 12;

  it("keeps the published split on the two models whose drawing was read", () => {
    for (const model of ["T36BT120NS", "T36IT100NP"]) {
      const appliance = APPLIANCES.find((a) => a.model === model);
      expect(appliance, `${model} is not in the catalogue`).toBeDefined();
      // Same series, same cabinet, same elevation.
      expect(appliance!.doorSplit, model).toEqual(GENERIC_SPLIT);
    }
  });

  // Leo's check: the four bands and the gaps between them fill the machine.
  it("stacks the four bands and their gaps to the full height", () => {
    const split = doorSplitOf(specified(), opening);
    const total =
      split.toe + split.drawerLow + split.drawerHigh + split.door + split.gap * 3;
    expect(inches(total)).toBeCloseTo(84, 6);
  });

  it("gives the doors more than half the front", () => {
    const split = doorSplitOf(specified(), opening);
    expect(split.door / opening).toBeGreaterThanOrEqual(0.55);
  });

  it("keeps the published proportions between the bands", () => {
    const published = specified().doorSplit!;
    const split = doorSplitOf(specified(), opening);
    // Every ratio survives the fit; only the scale changes.
    expect(split.door / split.drawerLow).toBeCloseTo(published.doorIn / published.drawerLowIn, 9);
    expect(split.drawerHigh / split.toe).toBeCloseTo(
      published.drawerHighIn / published.toeIn,
      9,
    );
  });

  it("draws the panels in the order the elevation has them", () => {
    const panels = fridgeParts(specified(), { w: 3, h: opening });
    const byHeight = [...panels].sort((a, b) => a.y - b.y);
    expect(byHeight[0].id).toBe("drawer-freezer");
    expect(byHeight[1].id).toBe("drawer-fresh");
    expect(byHeight.slice(2).every((p) => p.id.startsWith("door"))).toBe(true);
    // The low drawer is the deeper of the two, which is what the sheet says.
    expect(byHeight[0].h).toBeGreaterThan(byHeight[1].h);
  });
});
