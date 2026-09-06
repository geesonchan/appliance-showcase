import { describe, expect, it } from "vitest";
import { spreadPins, type PinBox } from "./pinLayout";

const GAP = 6;
const box = (over: Partial<PinBox> = {}): PinBox => ({
  x: 0,
  y: 0,
  w: 120,
  h: 24,
  hidden: false,
  ...over,
});

/** True when two boxes overlap, allowing for the gap that must sit between. */
const clashes = (a: PinBox, b: PinBox) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + GAP &&
  Math.abs(a.y - b.y) < (a.h + b.h) / 2 + GAP;

describe("pin collision avoidance", () => {
  it("leaves pins that do not overlap where they are", () => {
    const boxes = [box({ x: 100, y: 100 }), box({ x: 400, y: 300 })];
    const before = structuredClone(boxes);
    spreadPins(boxes, GAP);
    expect(boxes).toEqual(before);
  });

  // The number is the priority: 01 is where it points, later pins give way.
  it("keeps the lower-numbered pin on its anchor", () => {
    const boxes = [box({ x: 200, y: 200 }), box({ x: 205, y: 202 })];
    spreadPins(boxes, GAP);
    expect(boxes[0]).toEqual(box({ x: 200, y: 200 }));
    expect(boxes[1].y).not.toBe(202);
  });

  it("moves only along Y, so a pin never drifts onto its neighbour", () => {
    const boxes = [box({ x: 200, y: 200 }), box({ x: 205, y: 202 })];
    spreadPins(boxes, GAP);
    expect(boxes[1].x).toBe(205);
  });

  it("separates two pins that land on the same point", () => {
    const boxes = [box({ x: 300, y: 300 }), box({ x: 300, y: 300 })];
    spreadPins(boxes, GAP);
    expect(clashes(boxes[0], boxes[1])).toBe(false);
    // Upward on a tie: a label above its anchor reads as belonging to it.
    expect(boxes[1].y).toBeLessThan(boxes[0].y);
  });

  it("carries a pin on in the direction it was already leaning", () => {
    const above = [box({ x: 300, y: 300 }), box({ x: 300, y: 292 })];
    spreadPins(above, GAP);
    expect(above[1].y).toBeLessThan(292);

    const below = [box({ x: 300, y: 300 }), box({ x: 300, y: 308 })];
    spreadPins(below, GAP);
    expect(below[1].y).toBeGreaterThan(308);
  });

  it("resolves a pile of six, which is the whole set", () => {
    const boxes = Array.from({ length: 6 }, () => box({ x: 400, y: 250 }));
    spreadPins(boxes, GAP);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(clashes(boxes[i], boxes[j]), `pin ${i + 1} still covers pin ${j + 1}`).toBe(false);
      }
    }
  });

  // A hidden pin is behind a cabinet: it must neither move nor push.
  it("ignores hidden pins in both directions", () => {
    const boxes = [
      box({ x: 300, y: 300, hidden: true }),
      box({ x: 300, y: 300 }),
      box({ x: 300, y: 300, hidden: true }),
    ];
    spreadPins(boxes, GAP);
    expect(boxes[1].y).toBe(300);
    expect(boxes[2].y).toBe(300);
  });

  it("uses each label's own size rather than assuming they match", () => {
    const boxes = [box({ x: 300, y: 300, w: 60, h: 40 }), box({ x: 300, y: 300, w: 200, h: 20 })];
    spreadPins(boxes, GAP);
    expect(boxes[1].y).toBe(300 - (40 + 20) / 2 - GAP);
  });
});
