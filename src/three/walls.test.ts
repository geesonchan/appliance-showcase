import { describe, expect, it } from "vitest";
import { CABINET_COLORS } from "../store/useAppStore";
import { FINISHES } from "./materials";
import { SCENE_COLORS, WALL_COLORS, wallColor, type WallFinish } from "./materials";

/**
 * The walls' paint. Round 35, Leo: not white — a light warm grey a step below
 * the counters and the pale doors, with mid grey, taupe and white to choose.
 */
const hex = (value: string) => ({
  r: parseInt(value.slice(1, 3), 16),
  g: parseInt(value.slice(3, 5), 16),
  b: parseInt(value.slice(5, 7), 16),
});
const luminance = (value: string) => {
  const { r, g, b } = hex(value);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("the walls", () => {
  it("are a warm grey by default, a step below the counter and the palest door", () => {
    const wall = wallColor("realistic", "day");
    expect(wall).toBe("#D6D2CB");
    const { r, b } = hex(wall);
    expect(r, "not warm").toBeGreaterThan(b);
    // Below the quartz counter's ground and the bone door, by a visible step.
    const bone = CABINET_COLORS.find((paint) => paint.key === "finish.cabinet.bone")!.value;
    expect(luminance(wall)).toBeLessThan(luminance("#EFEEE8") - 15);
    expect(luminance(wall)).toBeLessThan(luminance(bone) - 5);
    // And no longer the white they were.
    expect(luminance(wall)).toBeLessThan(luminance(SCENE_COLORS.wall) - 15);
  });

  it("offers four paints, each its own colour, each darker after dark", () => {
    const paints = Object.keys(WALL_COLORS) as WallFinish[];
    expect(paints).toEqual(["warm-grey", "mid-grey", "taupe", "white"]);
    expect(new Set(paints.map((paint) => wallColor("realistic", "day", paint))).size).toBe(4);
    for (const paint of paints) {
      expect(luminance(wallColor("realistic", "night", paint)), paint).toBeLessThan(
        luminance(wallColor("realistic", "day", paint)),
      );
    }
    // The white model is still one colour for every surface.
    for (const paint of paints) expect(wallColor("white", "day", paint)).toBe(SCENE_COLORS.whiteModel);
  });

  it("leaves the backsplash its own tile", () => {
    expect(FINISHES["tile-white"].map).toBe("tile");
  });
});
