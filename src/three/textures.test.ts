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
  it("draws marble as veins that cross the slab, not as noise", () => {
    const veins = strokes("marble");
    expect(veins.length, "marble draws nothing").toBeGreaterThan(0);

    // A vein is walked in short segments so its width can change along it, so
    // "does it cross the slab" is the sum of a run rather than one stroke.
    const travelled = veins.reduce((sum, v) => sum + v.h, 0);
    expect(travelled, "nothing crosses the slab").toBeGreaterThan(256 * 3);

    // Its width varies: a line of one width is a drawn line, not a vein.
    const widths = new Set(veins.map((v) => v.w.toFixed(3)));
    expect(widths.size, "every stroke is the same width").toBeGreaterThan(20);

    // And there is clouding under it — strokes far wider than any vein.
    expect(Math.max(...veins.map((v) => v.w))).toBeGreaterThan(256 * 0.1);
  });

  // Warm grey with brown in it, never a neutral grey and never black: it is
  // what separates a marble from a photocopy of one.
  it("keeps the veining warm rather than neutral", () => {
    const inks = strokes("marble")
      .map((v) => v.style.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])] as const);

    expect(inks.length).toBeGreaterThan(0);
    for (const [r, g, b] of inks) {
      expect(r, "vein is not warm").toBeGreaterThan(b);
      expect(g).toBeGreaterThan(b);
      expect(Math.min(r, g, b), "vein is nearly black").toBeGreaterThan(60);
    }
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
