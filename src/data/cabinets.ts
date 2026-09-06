import type { SlotId } from "../types";
import { SLOT_BY_ID } from "./slots";
import {
  HOOD_OPENING,
  ISLAND,
  PANEL,
  ROOM,
  RUNS,
  RUN_BY_ID,
  type CabinetRun,
  type RunSegment,
  ft,
} from "./room";

export type CabinetKind = "base" | "tall" | "upper" | "counter" | "toe" | "surround";

export interface CabinetBox {
  id: string;
  kind: CabinetKind;
  /**
   * Boxes sharing an outline group are pieces of one visual volume (the
   * refrigerator surround). The mobile install view draws the union of each
   * group instead of every piece.
   */
  outline?: string;
  /**
   * The slot this box surrounds, when it is part of that appliance's own
   * enclosure. Such a box must never count as an occluder for that
   * appliance's pin, or the pin hides behind its own side panel.
   */
  slot?: SlotId;
  /** Centre of the box, in feet. */
  position: [number, number, number];
  /** Full extents, in feet. */
  size: [number, number, number];
}

const upperZ = -ROOM.halfZ + ROOM.upperDepth / 2;
const upperX = -ROOM.halfX + ROOM.upperDepth / 2;
const upperH = ROOM.upperTop - ROOM.upperBottom;
const upperY = ROOM.upperBottom + upperH / 2;
const counterT = ROOM.counterThickness;

/** The refrigerator opening's height, in feet, as the slot actually declares it. */
const FRIDGE_OPENING_H = ft(SLOT_BY_ID["slot-fridge"].cutout.h);

const span = ([a, b]: readonly [number, number]) => b - a;
const mid = ([a, b]: readonly [number, number]) => (a + b) / 2;

const backRun = RUN_BY_ID.back;
const leftRun = RUN_BY_ID.left;
const runExtent = (run: CabinetRun) =>
  [run.segments[0].from, run.segments[run.segments.length - 1].to] as const;

/** The wall cabinets on the left run stop where the tower starts. */
const LEFT_UPPER = [
  leftRun.segments[0].from,
  (leftRun.segments.find((s) => s.kind === "tall") ?? leftRun.segments[leftRun.segments.length - 1]).from,
] as const;

/**
 * Place a box on a run.
 *
 * A run travels along one axis and is centred on the other, so everything on it
 * is described in run-local terms — where it starts and stops along the run,
 * how far it stands off the wall — and this turns that into world coordinates.
 * The generator in M3-3 produces runs; this is what draws whatever it produces.
 */
function onRun(
  run: CabinetRun,
  id: string,
  kind: CabinetKind,
  along: readonly [number, number],
  y: readonly [number, number],
  depth: number,
  /** Shift toward the room, for a countertop's overhang. */
  offset = 0,
  extra: Partial<CabinetBox> = {},
): CabinetBox {
  const across = run.centre + offset;
  const size: [number, number, number] =
    run.axis === "x"
      ? [span(along), span(y), depth]
      : [depth, span(y), span(along)];
  const position: [number, number, number] =
    run.axis === "x" ? [mid(along), mid(y), across] : [across, mid(y), mid(along)];
  return { id, kind, position, size, ...extra };
}

/** Every stretch of a run that carries base cabinetry rather than an opening. */
const CARCASS_KINDS: RunSegment["kind"][] = ["counter", "corner", "fixture"];

/**
 * The countertop runs from the corner until a tall cabinet stops it.
 *
 * Rule 3 in docs/decisions.md D11: unbroken. The range is the one thing that
 * interrupts it, because a slide-in range is the counter's own thickness and
 * sits in it rather than under it.
 */
function counterSpans(run: CabinetRun): (readonly [number, number])[] {
  const spans: (readonly [number, number])[] = [];
  let start: number | null = null;
  for (const segment of run.segments) {
    const stops = segment.kind === "tall";
    const breaks = segment.slot === "slot-range";
    if (stops || breaks) {
      if (start !== null) spans.push([start, segment.from] as const);
      start = stops ? null : segment.to;
      if (stops) break;
    } else if (start === null) {
      start = segment.from;
    }
  }
  const last = run.segments[run.segments.length - 1];
  if (start !== null && last.kind !== "tall") spans.push([start, last.to] as const);
  return spans.filter(([a, b]) => b - a > 1e-6);
}

function runBoxes(run: CabinetRun): CabinetBox[] {
  const boxes: CabinetBox[] = [];
  const base = [0, ROOM.counterHeight] as const;

  for (const segment of run.segments) {
    const along = [segment.from, segment.to] as const;

    if (CARCASS_KINDS.includes(segment.kind)) {
      boxes.push(onRun(run, segment.id, "base", along, base, ROOM.counterDepth));
      continue;
    }

    if (segment.kind === "tall") {
      // A finished panel each side, the appliance opening between them, and a
      // bridging cabinet over the top. The bridge starts where the opening
      // stops, so raising the opening shortens the cabinet above it rather
      // than leaving the appliance poking through.
      const opening = [segment.from + PANEL, segment.to - PANEL] as const;
      const outline = segment.id;
      const tall = [0, ROOM.tallTop] as const;
      boxes.push(
        onRun(run, `${segment.id}-panel-a`, "surround", [segment.from, opening[0]], tall, ROOM.counterDepth, 0, { outline, slot: segment.slot }),
        onRun(run, `${segment.id}-panel-b`, "surround", [opening[1], segment.to], tall, ROOM.counterDepth, 0, { outline, slot: segment.slot }),
        onRun(run, `${segment.id}-bridge`, "upper", opening, [FRIDGE_OPENING_H, ROOM.tallTop], ROOM.counterDepth, 0, { outline, slot: segment.slot }),
      );
      continue;
    }
    // `appliance` segments are deliberate gaps in the carcass.
  }

  for (const [i, along] of counterSpans(run).entries()) {
    boxes.push(
      onRun(
        run,
        `${run.id}-counter-${i}`,
        "counter",
        along,
        [ROOM.counterHeight, ROOM.counterHeight + counterT],
        ROOM.counterDepth + ROOM.counterOverhang,
        ROOM.counterOverhang / 2,
      ),
    );
  }

  const first = run.segments[0];
  const last = run.segments[run.segments.length - 1];
  boxes.push(
    onRun(
      run,
      `${run.id}-toe`,
      "toe",
      [first.from, last.to],
      [0, ROOM.toeKick],
      ROOM.counterDepth - ft(3),
      -ft(1.5),
    ),
  );

  return boxes;
}

/**
 * The L-shaped cabinet run plus the island, derived once so the finished view,
 * the white model and the install wireframe all read from the same boxes.
 */
export const CABINETS: CabinetBox[] = [
  ...RUNS.flatMap(runBoxes),

  // --- uppers: the wall above the range is left clear for the hood ---
  {
    id: "upper-back-left",
    kind: "upper",
    position: [mid([runExtent(backRun)[0], HOOD_OPENING[0]]), upperY, upperZ],
    size: [span([runExtent(backRun)[0], HOOD_OPENING[0]]), upperH, ROOM.upperDepth],
  },
  {
    id: "upper-back-right",
    kind: "upper",
    position: [mid([HOOD_OPENING[1], runExtent(backRun)[1]]), upperY, upperZ],
    size: [span([HOOD_OPENING[1], runExtent(backRun)[1]]), upperH, ROOM.upperDepth],
  },
  {
    // Over the corner and the refrigerator's landing, stopping at the tower.
    id: "upper-left",
    kind: "upper",
    position: [upperX, upperY, mid(LEFT_UPPER)],
    size: [ROOM.upperDepth, upperH, span(LEFT_UPPER)],
  },

  // --- island ---
  // The two openings come in from opposite faces, so the carcass is the island
  // minus each of them: solid across the full depth where there is no opening,
  // and solid behind each opening on its own side.
  {
    id: "island-left",
    outline: "island",
    kind: "base",
    position: [mid([ISLAND.x[0], ISLAND.microwave[0]]), ROOM.counterHeight / 2, mid(ISLAND.z)],
    size: [span([ISLAND.x[0], ISLAND.microwave[0]]), ROOM.counterHeight, span(ISLAND.z)],
  },
  {
    id: "island-middle",
    outline: "island",
    kind: "base",
    position: [mid([ISLAND.microwave[1], ISLAND.wine[0]]), ROOM.counterHeight / 2, mid(ISLAND.z)],
    size: [span([ISLAND.microwave[1], ISLAND.wine[0]]), ROOM.counterHeight, span(ISLAND.z)],
  },
  {
    id: "island-right",
    outline: "island",
    kind: "base",
    position: [mid([ISLAND.wine[1], ISLAND.x[1]]), ROOM.counterHeight / 2, mid(ISLAND.z)],
    size: [span([ISLAND.wine[1], ISLAND.x[1]]), ROOM.counterHeight, span(ISLAND.z)],
  },
  {
    // Behind the microwave, on the seating side.
    id: "island-behind-microwave",
    outline: "island",
    kind: "base",
    position: [
      mid(ISLAND.microwave),
      ROOM.counterHeight / 2,
      mid([ISLAND.workingZ + ROOM.counterDepth, ISLAND.z[1]]),
    ],
    size: [
      span(ISLAND.microwave),
      ROOM.counterHeight,
      span([ISLAND.workingZ + ROOM.counterDepth, ISLAND.z[1]]),
    ],
  },
  {
    // Behind the wine cabinet, on the working side.
    id: "island-behind-wine",
    outline: "island",
    kind: "base",
    position: [
      mid(ISLAND.wine),
      ROOM.counterHeight / 2,
      mid([ISLAND.z[0], ISLAND.seatingZ - ROOM.counterDepth]),
    ],
    size: [
      span(ISLAND.wine),
      ROOM.counterHeight,
      span([ISLAND.z[0], ISLAND.seatingZ - ROOM.counterDepth]),
    ],
  },
  {
    id: "island-counter",
    kind: "counter",
    position: [mid(ISLAND.x), ROOM.counterHeight + counterT / 2, mid(ISLAND.z)],
    size: [
      span(ISLAND.x) + ROOM.counterOverhang * 2,
      counterT,
      span(ISLAND.z) + ROOM.counterOverhang * 2,
    ],
  },
  {
    id: "island-toe",
    kind: "toe",
    position: [mid(ISLAND.x), ROOM.toeKick / 2, mid(ISLAND.z)],
    size: [span(ISLAND.x) - ft(3), ROOM.toeKick, span(ISLAND.z) - ft(3)],
  },
];

/** Trim pieces that only add line noise at phone scale. */
const OUTLINE_SKIP: CabinetKind[] = ["counter", "toe"];

function unionBox(id: string, boxes: CabinetBox[]): CabinetBox {
  const axes = [0, 1, 2].map((axis) => {
    const min = Math.min(...boxes.map((b) => b.position[axis] - b.size[axis] / 2));
    const max = Math.max(...boxes.map((b) => b.position[axis] + b.size[axis] / 2));
    return { centre: (min + max) / 2, extent: max - min };
  });
  return {
    id,
    kind: boxes[0].kind,
    slot: boxes[0].slot,
    position: [axes[0].centre, axes[1].centre, axes[2].centre],
    size: [axes[0].extent, axes[1].extent, axes[2].extent],
  };
}

/**
 * The cabinetry reduced to its outer volumes: trim omitted, and each outline
 * group collapsed to a single box. This is what the install view draws on a
 * phone, where the full carcass wireframe turns into noise.
 */
export const CABINET_OUTLINES: CabinetBox[] = (() => {
  const result: CabinetBox[] = [];
  const groups = new Map<string, CabinetBox[]>();

  for (const box of CABINETS) {
    if (OUTLINE_SKIP.includes(box.kind)) continue;
    if (box.outline) {
      const bucket = groups.get(box.outline);
      if (bucket) bucket.push(box);
      else groups.set(box.outline, [box]);
    } else {
      result.push(box);
    }
  }

  for (const [id, boxes] of groups) result.push(unionBox(id, boxes));
  return result;
})();
