import { describe, expect, it } from "vitest";
import { APPLIANCES_BY_SLOT } from "./catalogue";
import { applianceBox, flushOffset } from "./applianceBox";
import { burnerCount, knobCount, rangeParts, RANGE_PROPORTIONS } from "./rangeModel";
import { ROOM, SLOT_BY_ID, ft } from "./slots";
import { FIXTURES } from "./testFixtures";
import type { Appliance } from "../types";

const inches = (feet: number) => feet * 12;
const proRange = (over: Partial<Appliance> = {}) =>
  ({
    ...FIXTURES.gasRange36,
    installType: ["freestanding"],
    widthIn: 36,
    heightIn: 36.75,
    depthIn: 24.75,
    burners: 6,
    ...over,
  }) as Appliance;

const box = (appliance: Appliance) => applianceBox(SLOT_BY_ID["slot-range"], appliance);
const parts = (appliance: Appliance) => rangeParts(appliance, box(appliance));

describe("a range is the size the model is", () => {
  it("takes its envelope from the record, not from the opening", () => {
    const range = proRange();
    const measured = box(range);
    expect(inches(measured.w)).toBe(36);
    expect(inches(measured.h)).toBe(36.75);
    expect(inches(measured.d)).toBe(24.75);
  });

  // Everything drawn on the front has to land inside that envelope, or the
  // room shows a machine bigger than its own spec sheet.
  it("stacks the front into bands that fill the height exactly", () => {
    for (const widthIn of [30, 36]) {
      const range = proRange({ widthIn, burners: widthIn >= 36 ? 6 : 4 });
      const { bands } = parts(range);
      const order = [bands.toe, bands.plinth, bands.door, bands.control, bands.deck, bands.grate];

      expect(order[0][0], `${widthIn}"`).toBe(0);
      for (let i = 1; i < order.length; i += 1) {
        expect(order[i][0], `${widthIn}" band ${i}`).toBeCloseTo(order[i - 1][1], 9);
      }
      expect(order[order.length - 1][1], `${widthIn}"`).toBeCloseTo(box(range).h, 9);
    }
  });

  it("keeps the grates inside the deck", () => {
    const range = proRange();
    const measured = box(range);
    for (const grate of parts(range).grates) {
      expect(Math.abs(grate.x) + grate.w / 2).toBeLessThanOrEqual(measured.w / 2 + 1e-9);
      expect(Math.abs(grate.z) + grate.d / 2).toBeLessThanOrEqual(measured.d / 2 + 1e-9);
    }
  });

  it("keeps the knobs on the fascia", () => {
    const range = proRange();
    const measured = box(range);
    const { bands, knobs } = parts(range);
    for (const knob of knobs) {
      expect(Math.abs(knob.x) + knob.r).toBeLessThanOrEqual(measured.w / 2 + 1e-9);
      expect(knob.y - knob.r).toBeGreaterThanOrEqual(bands.control[0] - 1e-9);
      expect(knob.y + knob.r).toBeLessThanOrEqual(bands.control[1] + 1e-9);
    }
  });
});

describe("what is on the front is what the machine has", () => {
  it("lays one grate per burner", () => {
    for (const burners of [4, 6]) {
      expect(parts(proRange({ burners })).grates).toHaveLength(burners);
    }
  });

  // Leo's figure: a PRG366WH has six burners and eight knobs, four each side of
  // the display. The oven and the griddle are the other two.
  it("puts a knob on the fascia for every burner, and two more", () => {
    for (const burners of [4, 6]) {
      const { knobs } = parts(proRange({ burners }));
      expect(knobs.length).toBeGreaterThanOrEqual(burners);
      expect(knobs).toHaveLength(knobCount(burners));
      expect(knobs.filter((k) => k.x < 0)).toHaveLength(knobs.length / 2);
      expect(knobs.filter((k) => k.x > 0)).toHaveLength(knobs.length / 2);
    }
  });

  it("lays the grates two deep, in as many columns as that takes", () => {
    const { grates } = parts(proRange({ burners: 6 }));
    const rows = new Set(grates.map((g) => g.z.toFixed(6)));
    const columns = new Set(grates.map((g) => g.x.toFixed(6)));
    expect(rows.size).toBe(RANGE_PROPORTIONS.grateRows);
    expect(columns.size).toBe(3);
  });

  // Nothing between them: on a pro range the cast iron is continuous, so a pan
  // slides from one burner to the next.
  it("leaves no deck showing between one grate and the next", () => {
    const { grates } = parts(proRange({ burners: 6 }));
    const along = [...new Set(grates.map((g) => g.x))].sort((a, b) => a - b);
    for (let i = 1; i < along.length; i += 1) {
      expect(along[i] - along[i - 1]).toBeCloseTo(grates[0].w, 9);
    }
  });

  it("counts the burners off the record, and guesses by class when it has none", () => {
    expect(burnerCount(proRange({ burners: 6 }))).toBe(6);
    expect(burnerCount(proRange({ burners: null, widthIn: 36 }))).toBe(6);
    expect(burnerCount(proRange({ burners: null, widthIn: 30 }))).toBe(4);
  });
});

describe("how it is installed changes what it looks like", () => {
  it("finishes the sides of a freestanding range and not a slide-in", () => {
    expect(parts(proRange({ installType: ["freestanding"] })).sides).toBe("finished");
    expect(parts(proRange({ installType: ["slide-in"] })).sides).toBe("unfinished");
  });

  it("laps a slide-in over the counter, and leaves a freestanding one standing", () => {
    const slideIn = parts(proRange({ installType: ["slide-in"] })).counterLip;
    expect(slideIn).not.toBeNull();
    expect(inches(slideIn!.d)).toBe(RANGE_PROPORTIONS.counterLipIn);
    expect(parts(proRange({ installType: ["freestanding"] })).counterLip).toBeNull();
  });

  // The one part above the line the machine is sold at.
  it("stands the island trim above the cooking surface", () => {
    const trim = parts(proRange()).islandTrim;
    expect(inches(trim.h)).toBe(RANGE_PROPORTIONS.islandTrimIn);
  });
});

describe("the range in the catalogue", () => {
  // The model Leo specified, checked against live data rather than a fixture:
  // if the sheet ever loses its dimensions this says so.
  it("knows how big a PRG366WH is and how many burners it has", () => {
    const range = APPLIANCES_BY_SLOT["slot-range"].find((a) => a.model === "PRG366WH");
    expect(range, "PRG366WH is not in the catalogue").toBeDefined();
    expect(range!.widthIn).toBe(36);
    expect(range!.heightIn).toBe(36.75);
    expect(range!.depthIn).toBe(24.75);
    expect(range!.burners).toBe(6);
    expect(range!.installType).toContain("freestanding");
  });

  it("stands its cooking surface within a scribe of the counter", () => {
    const range = APPLIANCES_BY_SLOT["slot-range"].find((a) => a.model === "PRG366WH")!;
    const surface = box(range).h;
    expect(surface).toBeGreaterThanOrEqual(ROOM.counterHeight);
    expect(inches(surface - ROOM.counterHeight)).toBeLessThanOrEqual(1);
    expect(surface).toBeCloseTo(ft(36.75), 9);
  });
});

describe("the front reads like the drawing", () => {
  it("gives the knobs the diameter the sheet publishes", () => {
    for (const widthIn of [30, 36]) {
      const range = proRange({ widthIn, burners: widthIn >= 36 ? 6 : 4 });
      for (const knob of parts(range).knobs) {
        expect(inches(knob.r * 2), `${widthIn}"`).toBeCloseTo(
          RANGE_PROPORTIONS.knobDiameterIn,
          6,
        );
      }
    }
  });

  it("spaces each bank of knobs evenly", () => {
    const { knobs } = parts(proRange({ burners: 6 }));
    for (const side of [-1, 1]) {
      const bank = knobs.filter((k) => Math.sign(k.x) === side).map((k) => k.x).sort();
      const steps = bank.slice(1).map((x, i) => x - bank[i]);
      for (const step of steps) expect(step).toBeCloseTo(steps[0], 9);
    }
  });

  it("leaves the display between the two banks, touching neither", () => {
    const { knobs, display } = parts(proRange({ burners: 6 }));
    for (const knob of knobs) {
      expect(Math.abs(knob.x) - knob.r).toBeGreaterThan(display.w / 2);
    }
  });
});

/**
 * A freestanding range is a different machine, not a variant of a pro one.
 *
 * Sold at its full height with the backguard on and cooking at 36"; its
 * controls on the front rather than on a fascia under the deck; a storage
 * drawer at the bottom rather than a toe kick; painted flanks. From Leo's
 * round-17 note against the Maytag MFES4030RS.
 */
const freestanding = (over: Partial<Appliance> = {}) =>
  ({
    ...FIXTURES.gasRange36,
    installType: ["freestanding"],
    widthIn: 29.875,
    heightIn: 47.875,
    depthIn: 28,
    cooktopIn: 36,
    backguardIn: 11.875,
    burners: 5,
    ...over,
  }) as Appliance;

describe("a freestanding range with a backguard", () => {
  it("draws to the envelope the model publishes, backguard included", () => {
    const measured = box(freestanding());
    expect(inches(measured.w)).toBeCloseTo(29.875, 4);
    expect(inches(measured.h)).toBeCloseTo(47.875, 4);
    expect(inches(measured.d)).toBeCloseTo(28, 4);
  });

  it("stands its backguard above the cooking surface", () => {
    const p = parts(freestanding());
    expect(p.style).toBe("backguard");
    expect(p.backguard).toBeTruthy();
    expect(inches(p.cooktop)).toBeCloseTo(36, 4);
    // The panel is above the cooktop, and the two together are the machine.
    expect(inches(p.backguard!.h)).toBeCloseTo(11.875, 4);
    expect(inches(p.cooktop + p.backguard!.h)).toBeCloseTo(47.875, 4);
    // Nothing on the front reaches past the cooking surface.
    expect(p.bands.grate[1]).toBeCloseTo(p.cooktop, 6);
  });

  it("puts one knob on the front per burner, and none on the backguard", () => {
    const p = parts(freestanding());
    expect(p.knobs).toHaveLength(p.burners);
    expect(p.burners).toBe(5);
    // Every knob is on the control strip, which is above the oven door.
    for (const knob of p.knobs) {
      expect(knob.y).toBeGreaterThan(p.bands.door[1]);
      expect(knob.y).toBeLessThan(p.cooktop);
      expect(Math.abs(knob.x) + knob.r).toBeLessThanOrEqual(box(freestanding()).w / 2);
    }
    // The display is up on the backguard, not between two banks of knobs.
    expect(p.display.y).toBeGreaterThan(p.cooktop);
  });

  it("lays the cast iron straight across, one grate per burner", () => {
    const p = parts(freestanding());
    expect(p.grates).toHaveLength(5);
    const rows = new Set(p.grates.map((grate) => grate.z.toFixed(6)));
    expect(rows.size, "grates are laid in one row").toBe(1);
  });

  it("stands on a storage drawer rather than a toe kick", () => {
    const p = parts(freestanding());
    expect(p.bands.toe[0]).toBe(0);
    expect(p.bands.toe[1]).toBe(0);
    expect(inches(p.bands.plinth[1] - p.bands.plinth[0])).toBeCloseTo(7, 4);
    expect(p.bands.plinth[0]).toBe(0);
    // The oven door is about half the front, as the note says.
    expect((p.bands.door[1] - p.bands.door[0]) / p.cooktop).toBeCloseTo(0.5, 2);
  });

  it("leaves a pro range exactly as it was", () => {
    const p = parts(proRange());
    expect(p.style).toBe("pro");
    expect(p.backguard).toBe(null);
    expect(p.vent).toBe(null);
    expect(p.knobs).toHaveLength(knobCount(6));
    expect(inches(p.cooktop)).toBeCloseTo(36.75, 4);
    expect(inches(p.islandTrim.h)).toBe(RANGE_PROPORTIONS.islandTrimIn);
  });

  it("stands against the wall rather than inside it when it is deeper than the run", () => {
    const deep = freestanding();
    const shallow = proRange();
    // 28" of range in a 24" run: it projects into the room, it does not sink
    // into the wall.
    expect(flushOffset(SLOT_BY_ID["slot-range"], box(deep).d)).toBeGreaterThan(0);
    expect(inches(flushOffset(SLOT_BY_ID["slot-range"], box(deep).d))).toBeCloseTo(2, 4);
    // A pro range is 24-3/4" in a 24" run: it stands against the wall too, by
    // three eighths of an inch, rather than a quarter inch inside it.
    expect(inches(flushOffset(SLOT_BY_ID["slot-range"], box(shallow).d))).toBeCloseTo(0.375, 4);
    // Anything shallower than the run is still flush with the cabinet face.
    const shallowBox = box(proRange({ depthIn: 20 }));
    expect(flushOffset(SLOT_BY_ID["slot-range"], shallowBox.d)).toBeCloseTo(
      (ROOM.counterDepth - shallowBox.d) / 2 + ft(0.5),
      6,
    );
  });
});
