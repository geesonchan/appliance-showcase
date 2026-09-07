import { describe, expect, it } from "vitest";
import { APPLIANCES_BY_SLOT } from "./catalogue";
import {
  FRIDGE_PROPORTIONS,
  doorConfigOf,
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
    expect(inches(lowest)).toBeCloseTo(FRIDGE_PROPORTIONS.toeGrilleIn, 6);
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
