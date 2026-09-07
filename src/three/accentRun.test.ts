import { describe, expect, it } from "vitest";
import { CABINETS } from "../data/cabinets";
import { ACCENT_COLORS, CABINET_COLORS, cabinetToken, type AccentRun } from "../store/useAppStore";
import { SCENE_COLORS, finish } from "./materials";

/**
 * A kitchen is finished by the run, not by the shelf.
 *
 * The accent colour goes on one whole leg or on the island — wall cabinets,
 * base cabinets and towers together — because that is the decision a designer
 * makes. Splitting a run at counter height is a different thing and mostly a
 * dated one. See docs/decisions.md D15.
 *
 * This is the layer's rule stated once, so the test and the component cannot
 * disagree about it.
 */
function boxFinish(
  box: (typeof CABINETS)[number],
  primary: string,
  accent: string,
  accentRun: AccentRun,
) {
  const colour = box.run === accentRun ? accent : primary;
  const token = box.kind === "toe" ? "painted" : cabinetToken(colour);
  const override =
    box.kind === "toe" ? SCENE_COLORS.toe : token === "painted" ? colour : undefined;
  return finish("realistic", token, override);
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
