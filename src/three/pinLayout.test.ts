import { describe, expect, it } from "vitest";
import { clampPins, layoutPins, type KeepOut, type PinBox } from "./pinLayout";

const GAP = 6;
const HEIGHT = 800;
const box = (over: Partial<PinBox> = {}): PinBox => ({
  x: 0,
  y: 400,
  w: 120,
  h: 24,
  hidden: false,
  ...over,
});
const area = (over: Partial<KeepOut> = {}): KeepOut => ({ x: 0, y: 400, w: 200, h: 200, ...over });

/** True when two rectangles overlap, allowing for the gap between them. */
const clash = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + GAP && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + GAP;

describe("labels stay off each other", () => {
  it("leaves labels that do not overlap where they are", () => {
    const boxes = [box({ x: 100, y: 100 }), box({ x: 400, y: 300 })];
    const before = structuredClone(boxes);
    layoutPins(boxes, [], GAP, HEIGHT);
    expect(boxes).toEqual(before);
  });

  // The number is the priority: 01 is where it points, later pins give way.
  it("keeps the lower-numbered label on its anchor", () => {
    const boxes = [box({ x: 200, y: 200 }), box({ x: 205, y: 202 })];
    layoutPins(boxes, [], GAP, HEIGHT);
    expect(boxes[0]).toEqual(box({ x: 200, y: 200 }));
    expect(boxes[1].y).not.toBe(202);
    expect(clash(boxes[0], boxes[1])).toBe(false);
  });

  it("moves only along Y, so a label never drifts onto its neighbour", () => {
    const boxes = [box({ x: 200, y: 200 }), box({ x: 205, y: 202 })];
    layoutPins(boxes, [], GAP, HEIGHT);
    expect(boxes[1].x).toBe(205);
  });

  it("resolves a pile of six, which is the whole set", () => {
    const boxes = Array.from({ length: 6 }, () => box({ x: 400, y: 250 }));
    layoutPins(boxes, [], GAP, HEIGHT);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(clash(boxes[i], boxes[j]), `label ${i + 1} still covers label ${j + 1}`).toBe(false);
      }
    }
  });

  // A hidden label is behind a cabinet: it must neither move nor push.
  it("ignores hidden labels in both directions", () => {
    const boxes = [
      box({ x: 300, y: 300, hidden: true }),
      box({ x: 300, y: 300 }),
      box({ x: 300, y: 300, hidden: true }),
    ];
    layoutPins(boxes, [], GAP, HEIGHT);
    expect(boxes[1].y).toBe(300);
    expect(boxes[2].y).toBe(300);
  });
});

describe("labels stay off the appliances", () => {
  it("lifts a label clear of the appliance it lands on", () => {
    const boxes = [box({ x: 0, y: 400 })];
    const areas = [area()];
    layoutPins(boxes, areas, GAP, HEIGHT);
    expect(clash(boxes[0], areas[0])).toBe(false);
    // Upward, because the wall above the room is where the space is.
    expect(boxes[0].y).toBeLessThan(400);
  });

  it("goes below instead when above would leave the canvas", () => {
    const boxes = [box({ x: 0, y: 60 })];
    const areas = [area({ y: 60, h: 200 })];
    layoutPins(boxes, areas, GAP, HEIGHT);
    expect(clash(boxes[0], areas[0])).toBe(false);
    expect(boxes[0].y).toBeGreaterThan(60);
  });

  // The case that made one pass insufficient: clearing the hood dropped the
  // range's label onto the hood's label, and separating those put it back.
  it("settles when an appliance and a label are both in the way", () => {
    const boxes = [box({ x: 400, y: 150 }), box({ x: 400, y: 300 })];
    const areas = [area({ x: 400, y: 300, w: 200, h: 160 })];
    layoutPins(boxes, areas, GAP, HEIGHT);
    for (const box_ of boxes) {
      expect(clash(box_, areas[0])).toBe(false);
    }
    expect(clash(boxes[0], boxes[1])).toBe(false);
  });

  it("clears every appliance, not just the first one it hit", () => {
    const boxes = [box({ x: 400, y: 400 })];
    const areas = [
      area({ x: 400, y: 400, w: 200, h: 120 }),
      area({ x: 400, y: 300, w: 200, h: 120 }),
    ];
    layoutPins(boxes, areas, GAP, HEIGHT);
    for (const a of areas) expect(clash(boxes[0], a)).toBe(false);
  });

  it("uses each label's own size rather than assuming they match", () => {
    const boxes = [box({ x: 300, y: 300, w: 60, h: 40 }), box({ x: 300, y: 300, w: 200, h: 20 })];
    layoutPins(boxes, [], GAP, HEIGHT);
    expect(boxes[1].y).toBe(300 - (40 + 20) / 2 - GAP);
  });
});

describe("labels stay on the canvas", () => {
  it("pulls a label back inside the edges", () => {
    const boxes = [box({ x: -40, y: -20 }), box({ x: 2000, y: 2000 })];
    clampPins(boxes, 1000, 800);
    expect(boxes[0].x).toBeGreaterThan(0);
    expect(boxes[0].y).toBeGreaterThan(0);
    expect(boxes[1].x).toBeLessThan(1000);
    expect(boxes[1].y).toBeLessThan(800);
  });

  it("leaves hidden labels alone", () => {
    const boxes = [box({ x: -40, y: -20, hidden: true })];
    clampPins(boxes, 1000, 800);
    expect(boxes[0].x).toBe(-40);
  });
});
