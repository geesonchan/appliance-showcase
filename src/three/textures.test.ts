import { describe, expect, it } from "vitest";
import {
  DRAW,
  FLOOR_TILE,
  MARBLE,
  OAK_TONES,
  TILE_FORMATS,
  type Ink,
  type TextureKind,
  type TileFormat,
} from "./textures";
import { FINISHES } from "./materials";
import { ACCENT_COLORS, CABINET_COLORS } from "../store/useAppStore";

/**
 * What each texture actually draws.
 *
 * There is no canvas in this environment, so the generators take an `Ink` —
 * the handful of context methods they use — and a test can pass one that
 * records instead of rasterising. That is enough to ask the questions that
 * matter: is this more than a flat colour, and is it a different thing from the
 * one beside it.
 */
interface Op {
  kind: "fill" | "stroke" | "dot";
  /** For a fill, its position and size; for a stroke, its width and how far it
   * travelled; for a dot, its centre and its two radii. */
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
}

function record(kind: TextureKind, size = 256) {
  const ops: Op[] = [];
  let at = { x: 0, y: 0 };
  let travelled = 0;
  let ellipse = { x: 0, y: 0, rx: 0, ry: 0 };

  const ink: Ink = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: (x, y, w, h) => ops.push({ kind: "fill", x, y, w, h, style: ink.fillStyle }),
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
    ellipse: (x, y, rx, ry) => {
      ellipse = { x, y, rx, ry };
      travelled += (rx + ry) * Math.PI;
    },
    stroke: () =>
      ops.push({ kind: "stroke", x: 0, y: 0, w: ink.lineWidth, h: travelled, style: ink.strokeStyle }),
    fill: () =>
      ops.push({ kind: "dot", x: ellipse.x, y: ellipse.y, w: ellipse.rx, h: ellipse.ry, style: ink.fillStyle }),
  };

  DRAW[kind](ink, size);
  return { ops, size };
}

const rgba = (style: string) => {
  const m = style.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
};
const hex = (value: string) => ({
  r: parseInt(value.slice(1, 3), 16),
  g: parseInt(value.slice(3, 5), 16),
  b: parseInt(value.slice(5, 7), 16),
});
const luminance = ({ r, g, b }: { r: number; g: number; b: number }) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Strokes that read as drawn lines: a single width carried more than an inch.
 * Returned rather than asserted, so the check can be shown to catch one.
 */
function drawnLines(ops: Op[], pxPerInch: number) {
  return ops.filter((op) => op.kind === "stroke" && op.h > pxPerInch);
}

describe("marble is ink bleeding into stone, not lines drawn on it", () => {
  const size = 256;
  const { ops } = record("marble", size);
  const sx = size / MARBLE.alongIn;
  const sy = size / MARBLE.acrossIn;
  const inkDots = ops.filter((op) => op.kind === "dot" && op.style.startsWith(`rgba(${MARBLE.ink},`));

  it("draws no stroke at all, so nothing has a width, a start or an end", () => {
    expect(ops.filter((op) => op.kind === "stroke")).toEqual([]);
    expect(drawnLines(ops, sx)).toEqual([]);
    // The check itself: an inch-and-a-half stroke of one width is what it is for.
    expect(
      drawnLines([{ kind: "stroke", x: 0, y: 0, w: 2, h: 1.5 * sx, style: "" }], sx),
    ).toHaveLength(1);
  });

  it("builds the veining out of more than five hundred ink dots", () => {
    expect(inkDots.length).toBeGreaterThan(500);
  });

  it("keeps every ink dot small and nearly transparent", () => {
    const [rMin, rMax] = MARBLE.dotRadiusIn;
    const [aMin, aMax] = MARBLE.dotAlpha;
    for (const dot of inkDots) {
      // Measured in inches on each axis, so it is round on the counter.
      expect(dot.w / sx).toBeGreaterThanOrEqual(rMin - 1e-9);
      expect(dot.w / sx).toBeLessThanOrEqual(rMax + 1e-9);
      expect(dot.h / sy).toBeCloseTo(dot.w / sx, 9);
      const { a } = rgba(dot.style)!;
      expect(a).toBeGreaterThanOrEqual(aMin - 1e-9);
      expect(a).toBeLessThanOrEqual(aMax + 1e-9);
    }
  });

  it("piles the dots up along a band that crosses the whole slab", () => {
    // Every tenth of the slab's length has ink in it.
    const columns = new Set(inkDots.map((dot) => Math.floor((dot.x / size) * 10)));
    for (let c = 0; c < 10; c += 1) expect(columns.has(c), `column ${c}`).toBe(true);
    // And the dots are denser at the band's middle than out at its edges. The
    // band wanders several inches across the slab along its length, so this is
    // asked of short stretches, where its middle is in one place: in most of
    // them, the most crowded inch across holds at least three times the average.
    const stretches = 12;
    let banded = 0;
    for (let s = 0; s < stretches; s += 1) {
      const rows = new Array<number>(MARBLE.acrossIn).fill(0);
      for (const dot of inkDots) {
        if (Math.floor((dot.x / size) * stretches) !== s) continue;
        rows[Math.min(MARBLE.acrossIn - 1, Math.floor(dot.y / sy))] += 1;
      }
      const mean = rows.reduce((sum, n) => sum + n, 0) / MARBLE.acrossIn;
      if (mean > 0 && Math.max(...rows) >= mean * 3) banded += 1;
    }
    expect(banded, "stretches where the dots pile into a band").toBeGreaterThanOrEqual(
      Math.ceil(stretches * 0.75),
    );
  });

  it("stains in a dark grey with brown in it, never neutral and never black", () => {
    const { r, g, b } = rgba(`rgba(${MARBLE.ink},1)`)!;
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(b);
    expect(Math.min(r, g, b)).toBeGreaterThan(40);
    expect(luminance({ r, g, b })).toBeLessThan(luminance(hex(MARBLE.ground)) * 0.5);
  });
});

describe("marble and quartz are different stones", () => {
  it("lays marble on a warm grey ground and keeps quartz pale", () => {
    const marble = record("marble").ops[0];
    const quartz = record("quartz").ops[0];
    const m = hex(marble.style);
    const q = hex(quartz.style);
    // Not white: a warm grey, clearly darker than the quartz beside it.
    expect(m.r).toBeGreaterThan(m.b);
    expect(luminance(m)).toBeLessThan(230);
    expect(luminance(q) - luminance(m)).toBeGreaterThan(15);
  });

  it("keeps marble clearly darker than quartz once the finish's own colour is on it", () => {
    // What reaches the screen is the map multiplied by the finish's colour, so
    // item 3 is held there: the marble counter must not come out white.
    const onScreen = (ground: string, multiplier: string) => {
      const g = hex(ground);
      const m = hex(multiplier);
      return luminance({ r: (g.r * m.r) / 255, g: (g.g * m.g) / 255, b: (g.b * m.b) / 255 });
    };
    const marble = onScreen(record("marble").ops[0].style, FINISHES["marble-veined"].color);
    const quartz = onScreen(record("quartz").ops[0].style, FINISHES["quartz-white"].color);
    expect(quartz - marble).toBeGreaterThan(40);
  });

  it("draws quartz as fine grain, with nothing crossing it", () => {
    const { ops } = record("quartz");
    expect(ops.filter((op) => op.kind === "stroke"), "quartz has veins in it").toEqual([]);
    const grains = ops.filter((op) => op.kind === "fill").slice(1);
    expect(grains.length).toBeGreaterThan(1000);
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
    expect(marble.roughness).toBeLessThan(quartz.roughness);
    expect(marble.repeatFt!).toBeGreaterThan(quartz.repeatFt!);
    // The texture is drawn to the tile the finish lays it at.
    expect(marble.repeatFt! * 12).toBe(MARBLE.alongIn);
    expect(marble.repeatAcrossFt! * 12).toBe(MARBLE.acrossIn);
  });
});

describe("a large-format tile floor", () => {
  for (const format of Object.keys(TILE_FORMATS) as TileFormat[]) {
    it(`lays ${format} panels a third offset, with a sixteenth-inch joint and some variation`, () => {
      const size = 1024;
      const { ops } = record(`floor-tile-${format}`, size);
      const { alongIn, acrossIn } = TILE_FORMATS[format];
      const sx = size / (alongIn * FLOOR_TILE.along);
      const sy = size / (acrossIn * FLOOR_TILE.rows);
      const gx = Math.max(1, FLOOR_TILE.groutIn * sx);
      const gy = Math.max(1, FLOOR_TILE.groutIn * sy);

      const panels = ops.filter((op) => op.kind === "fill" && op.w > 2 && op.w < size);
      expect(panels.length).toBe(FLOOR_TILE.along * FLOOR_TILE.rows * 2);

      for (const panel of panels) {
        // Its real size, less one joint.
        expect(panel.w).toBeCloseTo(alongIn * sx - gx, 6);
        expect(panel.h).toBeCloseTo(acrossIn * sy - gy, 6);
        // The joint is a sixteenth of an inch, or a pixel where that is less.
        expect(gx).toBeLessThanOrEqual(Math.max(1, sx / 16) + 1e-9);
      }

      // Each row starts a third of a panel further along than the last, and
      // comes round after three.
      const panelPx = alongIn * sx;
      for (let row = 0; row < FLOOR_TILE.rows; row += 1) {
        const top = row * acrossIn * sy + gy / 2;
        const starts = panels
          .filter((panel) => Math.abs(panel.y - top) < 1e-6)
          .map((panel) => (((panel.x - gx / 2) % panelPx) + panelPx) % panelPx);
        const expected = ((row % 3) * panelPx) / 3;
        for (const start of starts) {
          const off = Math.min(Math.abs(start - expected), panelPx - Math.abs(start - expected));
          expect(off, `row ${row}`).toBeLessThan(1e-6);
        }
      }

      // Every panel is near the base grey, and they are not all the same.
      const shades = new Set<string>();
      for (const panel of panels) {
        const { r, g, b } = rgba(panel.style)!;
        const [br, bg, bb] = FLOOR_TILE.base;
        expect(Math.abs(r - br)).toBeLessThanOrEqual(FLOOR_TILE.shadeSpread);
        expect(Math.abs(g - bg)).toBeLessThanOrEqual(FLOOR_TILE.shadeSpread);
        expect(Math.abs(b - bb)).toBeLessThanOrEqual(FLOOR_TILE.shadeSpread);
        shades.add(panel.style);
      }
      expect(shades.size).toBeGreaterThanOrEqual(3);

      // And the floor finish repeats the texture at exactly the inches it covers.
      const finish = FINISHES[`floor-tile-${format}`];
      expect(finish.repeatFt! * 12).toBeCloseTo(alongIn * FLOOR_TILE.along, 9);
      expect(finish.repeatAcrossFt! * 12).toBeCloseTo(acrossIn * FLOOR_TILE.rows, 9);
    });
  }

  it("does not change the backsplash, which is still the small white tile", () => {
    expect(FINISHES["tile-white"].map).toBe("tile");
  });
});

describe("oak is a mid brown", () => {
  const mean = (tones: readonly string[]) => {
    const all = tones.map(hex);
    return {
      r: all.reduce((s, c) => s + c.r, 0) / all.length,
      g: all.reduce((s, c) => s + c.g, 0) / all.length,
      b: all.reduce((s, c) => s + c.b, 0) / all.length,
    };
  };

  it("sits around #8B6B47 on a door, and a step darker on the floor", () => {
    const target = hex("#8B6B47");
    const door = mean(OAK_TONES.cabinet);
    for (const channel of ["r", "g", "b"] as const) {
      expect(Math.abs(door[channel] - target[channel]), channel).toBeLessThan(16);
    }
    expect(luminance(mean(OAK_TONES.floor))).toBeLessThan(luminance(door));
    // Deeper than the pale yellow oak it replaced, which averaged about #C8A67D.
    expect(luminance(door)).toBeLessThan(luminance(hex("#C8A67D")) - 40);
  });

  it("keeps the boards brown rather than grey, and the rings visible on them", () => {
    for (const kind of ["oak", "oak-floor"] as const) {
      const { ops } = record(kind);
      const rings = ops.filter((op) => op.kind === "stroke");
      expect(rings.length, kind).toBeGreaterThan(10);
      for (const ring of rings) {
        const ink = rgba(ring.style)!;
        expect(ink.r, kind).toBeGreaterThan(ink.b);
      }
    }
    const door = mean(OAK_TONES.cabinet);
    expect(door.r - door.b).toBeGreaterThan(40);
  });

  it("shows the wood's own tone on the oak swatches, and a deep cool burgundy beside it", () => {
    const oak = CABINET_COLORS.find((paint) => paint.key === "finish.cabinet.oak")!;
    expect(oak.value).toBe("#8B6B47");
    expect(ACCENT_COLORS.find((paint) => paint.key === "finish.accent.oak")!.value).toBe("#8B6B47");
    // Burgundy, round 35: a deep wine red leaning cool rather than orange —
    // red first, then blue over green — and dark.
    const burgundy = CABINET_COLORS.find((paint) => paint.key === "finish.cabinet.burgundy")!;
    expect(burgundy.value).toBe("#6E2639");
    const c = hex(burgundy.value);
    expect(c.r).toBeGreaterThan(c.b * 1.5);
    expect(c.b, "leans orange: green over blue").toBeGreaterThan(c.g);
    expect(luminance(c)).toBeLessThan(luminance(hex(oak.value)) - 30);
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
