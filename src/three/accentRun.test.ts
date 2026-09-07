import { describe, expect, it } from "vitest";
import { CABINETS } from "../data/cabinets";
import { SLOT_ORDER } from "../data/catalogue";
import { runForSlot } from "../data/room";
import {
  ACCENT_COLORS,
  CABINET_COLORS,
  cabinetPaint,
  type AccentRun,
} from "../store/useAppStore";
import { SCENE_COLORS, finish } from "./materials";

/**
 * A kitchen is finished by the run, not by the shelf.
 *
 * The accent colour goes on one whole leg or on the island — wall cabinets,
 * base cabinets and towers together — because that is the decision a designer
 * makes. Splitting a run at counter height is a different thing and mostly a
 * dated one. See docs/decisions.md D15.
 *
 * Through `cabinetPaint`, which is what the layer calls. Restating the rule
 * here instead is how the bug got in: the test agreed with a copy of the rule
 * while a drawer front under the microwave was painted from a third place.
 */
function boxFinish(
  box: (typeof CABINETS)[number],
  primary: string,
  accent: string,
  accentRun: AccentRun,
) {
  const door = cabinetPaint({ cabinet: primary, accent, accentRun }, box.run);
  if (box.kind === "toe") return finish("realistic", "painted", SCENE_COLORS.toe);
  return finish("realistic", door.token, door.colour);
}

const doors = (accentRun: AccentRun, primary: string, accent: string) =>
  CABINETS.filter((box) => box.kind !== "counter" && box.kind !== "toe").map((box) => ({
    run: box.run,
    surface: boxFinish(box, primary, accent, accentRun),
  }));

const signature = (s: ReturnType<typeof finish>) => `${s.color}|${s.map ?? ""}`;

describe("the accent colour goes on a whole run", () => {
  const primary = CABINET_COLORS[0].value;
  const accent = ACCENT_COLORS[1].value;

  it("finishes every box on that run the same way, whichever run it is", () => {
    for (const accentRun of ["left", "back", "island"] as const) {
      const onRun = doors(accentRun, primary, accent).filter((box) => box.run === accentRun);
      expect(onRun.length, `nothing on the ${accentRun} run`).toBeGreaterThan(0);

      const signatures = new Set(onRun.map((box) => signature(box.surface)));
      expect(signatures.size, `${accentRun} run is not one colour`).toBe(1);
      expect([...signatures][0]).toBe(signature(finish("realistic", "painted", accent)));
    }
  });

  it("leaves every other run in the primary", () => {
    for (const accentRun of ["left", "back", "island"] as const) {
      const elsewhere = doors(accentRun, primary, accent).filter((box) => box.run !== accentRun);
      const signatures = new Set(elsewhere.map((box) => signature(box.surface)));
      expect(signatures.size, `${accentRun}: the rest is not one colour`).toBe(1);
      expect([...signatures][0]).toBe(signature(finish("realistic", "painted", primary)));
    }
  });

  // Wall cabinets, base cabinets and the tower on the same leg: the split that
  // used to be at counter height is gone.
  it("takes the wall cabinets and the towers with the base run", () => {
    const kinds = new Set(
      CABINETS.filter((box) => box.run === "left" && box.kind !== "toe").map((box) => box.kind),
    );
    expect(kinds.has("upper"), "no wall cabinets on the left run").toBe(true);
    expect(kinds.has("base") || kinds.has("surround"), "no base run on the left").toBe(true);

    const onRun = doors("left", primary, accent).filter((box) => box.run === "left");
    expect(new Set(onRun.map((box) => signature(box.surface))).size).toBe(1);
  });

  it("paints the whole room in the primary when no run is picked", () => {
    const signatures = new Set(doors("none", primary, accent).map((box) => signature(box.surface)));
    expect(signatures.size).toBe(1);
  });

  /**
   * The cabinetry around an appliance belongs to the run it stands in.
   *
   * The drawer front under the microwave, the panels either side of the fridge,
   * the strip beside the dishwasher: `ApplianceModel` draws them, and it has to
   * ask the same question the cabinet beside them asked. It used to paint them
   * from a constant, which is why they stayed green in a navy kitchen.
   */
  it("finishes the joinery round an appliance with the run it stands in", () => {
    for (const slot of SLOT_ORDER) {
      const run = runForSlot(slot);
      expect(["left", "back", "island"], `${slot} is on no run`).toContain(run);

      // On the accent run it is the accent, everywhere else the primary — and
      // it matches what a cabinet box on the same run is painted.
      const onRun = cabinetPaint({ cabinet: primary, accent, accentRun: run }, run);
      expect(onRun.value, `${slot} joinery ignores its own run`).toBe(accent);

      const neighbour = CABINETS.find((box) => box.run === run && box.kind !== "toe");
      expect(neighbour, `no cabinet on the ${run} run`).toBeTruthy();
      expect(signature(finish("realistic", onRun.token, onRun.colour))).toBe(
        signature(boxFinish(neighbour!, primary, accent, run)),
      );

      const offRun = cabinetPaint(
        { cabinet: primary, accent, accentRun: run === "left" ? "back" : "left" },
        run,
      );
      expect(offRun.value, `${slot} joinery takes an accent it should not`).toBe(primary);
    }
  });

  // An accent that is one of the five you just chose from is not an accent.
  it("offers a second palette that is not the first", () => {
    expect(ACCENT_COLORS).toHaveLength(CABINET_COLORS.length);
    // The oak swatch appears on both, because oak is oak. Nothing else does.
    const shared = ACCENT_COLORS.filter((a) =>
      CABINET_COLORS.some((c) => c.value === a.value),
    ).map((a) => a.token);
    expect(shared).toEqual(["wood-oak"]);
  });
});
