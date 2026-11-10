import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { COMBO_OVEN, ovenFront } from "./columnModel";
import { ft } from "./roomShell";

/**
 * Each oven's front as its own sheet shows it (Leo, 2026-11-09, the plan's
 * section 5: 「样子照规格书」). The installation guides print no panel height
 * (8001185222_A, 8001140295_A, 8001189463), so the bands are measured off each
 * sheet's page-1 photograph, inches per pixel from the printed overall height
 * and checked by the printed width (D21: inferred; the method in
 * docs/decisions.md, "The ovens do not look like ovens").
 *
 * Lopsided on purpose: PO302W and PODS302B are 52-1/16" and 48-7/8" tall and
 * carry the same 5-3/8" panel, so a panel scaled off the machine's height
 * would give them two.
 */

const r = (n: number) => Math.round(n * 10000) / 10000;
const inch = (v: number) => r(v * 12);
const oven = (model: string) => APPLIANCE_BY_ID[`thermador-${model.toLowerCase()}`];
const front = (model: string) => {
  const a = oven(model);
  return ovenFront(a, { w: ft(a.widthIn!), h: ft(a.heightIn!) });
};
const bands = (model: string) =>
  front(model).doors.map((d) => ({ kind: d.kind, from: inch(d.band[0]), to: inch(d.band[1]) }));
const panels = (model: string) =>
  front(model).doors.filter((d) => d.kind === "control").map((d) => ({
    from: inch(d.band[0]),
    to: inch(d.band[1]),
    finish: d.panel?.finish ?? null,
    display: d.panel ? { colour: d.panel.display.colour, w: r(d.panel.display.wIn), h: r(d.panel.display.hIn) } : null,
    knobs: d.panel?.knobs.map((k) => r(k.xIn)) ?? [],
  }));

describe("the control panel, as each sheet's photograph shows it", () => {
  it("ME301YP: one grey glass panel across the top, 5-3/8\", a black display in it, no knobs", () => {
    expect(panels("ME301YP")).toEqual([
      { from: 23.625, to: 29, finish: "greyGlass", display: { colour: "black", w: 4.875, h: 2.0625 }, knobs: [] },
    ]);
  });

  it("MEM301WS: a panel across the top and another between the doors, steel framing grey glass, a pale display", () => {
    expect(panels("MEM301WS")).toEqual([
      { from: 23.625, to: 28.9375, finish: "framedGlass", display: { colour: "light", w: 5.5, h: 1.375 }, knobs: [] },
      { from: 43.625, to: 49, finish: "framedGlass", display: { colour: "light", w: 5.5, h: 1.375 }, knobs: [] },
    ]);
  });

  it.each(["PO302W", "PODS302B"])("%s: a steel panel across the top, 5-3/8\", four knobs, a pale display", (model) => {
    const a = oven(model);
    expect(panels(model)).toEqual([
      {
        from: r(a.heightIn! - 5.375),
        to: r(a.heightIn!),
        finish: "stainless",
        display: { colour: "light", w: 9.5, h: 2.75 },
        knobs: [2.75, 6.5, 23.25, 27],
      },
    ]);
  });
});

describe("the doors round the panels", () => {
  it("ME301YP: one door under the panel, its bar on it", () => {
    expect(bands("ME301YP").map((b) => b.kind)).toEqual(["oven", "control"]);
  });

  it("MEM301WS: the oven, its panel, the microwave, the top panel; the handles where the tower is hung from (39\" and 22\")", () => {
    const f = front("MEM301WS");
    expect(bands("MEM301WS").map((b) => b.kind)).toEqual(["oven", "control", "microwave", "control"]);
    const handle = (kind: string) => inch(f.doors.find((d) => d.kind === kind)!.handleAt!);
    expect([handle("microwave"), handle("oven")]).toEqual([COMBO_OVEN.microwaveHandleIn, COMBO_OVEN.ovenHandleIn]);
  });

  it.each(["ME301YP", "MEM301WS", "PO302W", "PODS302B"])("%s: bands in order inside the machine, each bar on its own door", (model) => {
    const f = front(model);
    const h = oven(model).heightIn!;
    let last = 0;
    for (const d of f.doors) {
      expect(inch(d.band[0]), `${model} ${d.kind}`).toBeGreaterThanOrEqual(last - 1e-6);
      expect(inch(d.band[1]), `${model} ${d.kind}`).toBeLessThanOrEqual(h + 1e-6);
      if (d.handleAt !== null) {
        expect(inch(d.handleAt)).toBeGreaterThan(inch(d.band[0]));
        expect(inch(d.handleAt)).toBeLessThan(inch(d.band[1]));
      }
      if (d.panel) {
        expect(d.panel.display.hIn).toBeLessThan(inch(d.band[1]) - inch(d.band[0]));
      }
      last = inch(d.band[1]);
    }
    expect(last).toBe(h);
  });
});
