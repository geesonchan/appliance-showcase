import { describe, expect, it } from "vitest";
import { DRAW, type Ink, type TextureKind } from "./textures";
import { FINISHES } from "./materials";

/**
 * What each texture actually draws.
 *
 * There is no canvas in this environment, so the generators take an `Ink` —
 * the handful of context methods they use — and a test can pass one that
 * records instead of rasterising. That is enough to ask the questions that
 * matter: is this more than a flat colour, and is it a different thing from the
 * one beside it.
 *
 * The question is not academic. Marble and quartz came out looking the same
 * because both were noise on a pale ground; the difference between them is
 * that one has veins crossing the whole slab and the other has grain.
 */
interface Op {
  kind: "fill" | "stroke";
  /** For a fill, its size; for a stroke, its width and how far it travelled. */
  w: number;
  h: number;
  style: string;
}

function record(kind: TextureKind, size = 256) {
  const ops: Op[] = [];
  let at = { x: 0, y: 0 };
  let travelled = 0;

  const ink: Ink = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: (_x, _y, w, h) => ops.push({ kind: "fill", w, h, style: ink.fillStyle }),
    beginPath: () => {
      travelled = 0;
    },
    moveTo: (x, y) => {
      at = { x, y };
    },
    lineTo: (x, y) => {
      travelled += Math.hypot(x - at.x, y - at.y);
      at = { x, y };
    },
    quadraticCurveTo: (_cx, _cy, x, y) => {
      travelled += Math.hypot(x - at.x, y - at.y);
      at = { x, y };
    },
    ellipse: (_x, _y, rx, ry) => {
      travelled += (rx + ry) * Math.PI;
    },
    stroke: () =>
      ops.push({ kind: "stroke", w: ink.lineWidth, h: travelled, style: ink.strokeStyle }),
  };

  DRAW[kind](ink, size);
  return { ops, size };
}

const strokes = (kind: TextureKind) => record(kind).ops.filter((op) => op.kind === "stroke");
const fills = (kind: TextureKind) => record(kind).ops.filter((op) => op.kind === "fill");

describe("marble and quartz are different stones", () => {
  it("draws marble as a few long veins, not as noise", () => {
    const veins = strokes("marble");
    expect(veins.length, "marble draws nothing").toBeGreaterThan(0);
    // Every pass crosses most of the tile: that is what makes it a vein.
    const long = veins.filter((v) => v.h > 256 * 0.8);
    expect(long.length, "no vein crosses the slab").toBeGreaterThan(0);
    // And some of them are wide, which is the bleed either side of the line.
    expect(Math.max(...veins.map((v) => v.w))).toBeGreaterThan(256 / 24);
  });

  it("draws quartz as fine grain, with nothing crossing it", () => {
    expect(strokes("quartz"), "quartz has veins in it").toEqual([]);
    const grains = fills("quartz").slice(1);
    expect(grains.length).toBeGreaterThan(1000);
    // A sixteenth of an inch at three feet of counter to a tile — which at this
    // resolution is under a pixel, so a pixel is the floor. Nothing here is a
    // feature; it is all grain.
    const sixteenth = Math.max(1, 256 / 576);
    for (const grain of grains) {
      expect(grain.w).toBeLessThanOrEqual(sixteenth);
      expect(grain.h).toBeLessThanOrEqual(sixteenth);
    }
  });

  it("makes neither of them a flat colour", () => {
    for (const kind of ["marble", "quartz"] as const) {
      const { ops, size } = record(kind);
      const ground = ops.filter((op) => op.kind === "fill" && op.w === size && op.h === size);
      expect(ground, `${kind} has no ground`).toHaveLength(1);
      expect(ops.length, `${kind} is a flat colour`).toBeGreaterThan(20);
    }
  });

  it("gives them different surfaces as well as different patterns", () => {
    const marble = FINISHES["marble-veined"];
    const quartz = FINISHES["quartz-white"];
    expect(marble.map).not.toBe(quartz.map);
    // Marble is polished harder than engineered quartz, which is half of what
    // tells them apart across a room.
    expect(marble.roughness).toBeLessThan(quartz.roughness);
    // And a vein has to cross a counter to read as one, so its tile is bigger.
    expect(marble.repeatFt!).toBeGreaterThan(quartz.repeatFt!);
  });
});

describe("every texture draws something", () => {
  it("puts more than a ground on each of them", () => {
    for (const kind of Object.keys(DRAW) as TextureKind[]) {
      const { ops } = record(kind);
      const expected = kind.startsWith("blank") ? 1 : 10;
      expect(ops.length, kind).toBeGreaterThanOrEqual(expected);
    }
  });
});
