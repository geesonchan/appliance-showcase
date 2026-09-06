import type { SlotId } from "../types";
import { SLOT_BY_ID } from "./slots";
import { bowlExtent, FIXTURE_BY_ID } from "./fixtures";
import {
  CABINET_STANDARDS,
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

const counterT = ROOM.counterThickness;
/** The base box under the top: 34.5" plus a 1.5" counter makes 36". */
const BASE_BOX = [0, ROOM.counterHeight - counterT] as const;
const UPPER_BAND = [ROOM.upperBottom, ROOM.upperTop] as const;
/**
 * Over the hood the run picks up again where the canopy stops, which the
 * clearance sheet puts at 84": 36" counter, 30" to the canopy, 18" of canopy.
 */
const OVER_HOOD_BAND = [
  ROOM.counterHeight +
    ft(CABINET_STANDARDS.hood.aboveCooktopMinIn + CABINET_STANDARDS.hood.bodyHeightIn),
  ROOM.upperTop,
] as const;

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

/** A wall cabinet on a run, at the standard 12" depth. */
function upper(
  id: string,
  run: CabinetRun,
  along: readonly [number, number],
  band: readonly [number, number],
): CabinetBox {
  const inset = (ROOM.counterDepth - ROOM.upperDepth) / 2;
  return onRun(run, id, "upper", along, band, ROOM.upperDepth, -inset);
}

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

/** Extents along a run and across it, in run-local feet. */
interface CounterPiece {
  along: readonly [number, number];
  across: readonly [number, number];
}

/** Where each basin cuts through the top, in run-local feet. */
function bowlHoles(run: CabinetRun): CounterPiece[] {
  const holes: CounterPiece[] = [];
  for (const segment of run.segments) {
    if (!segment.fixture) continue;
    const bowl = bowlExtent(FIXTURE_BY_ID[segment.fixture]);
    if (!bowl) continue;
    const centre = (segment.from + segment.to) / 2;
    holes.push({
      along: [centre - bowl.alongHalf, centre + bowl.alongHalf],
      across: [bowl.acrossCentre - bowl.acrossHalf, bowl.acrossCentre + bowl.acrossHalf],
    });
  }
  return holes.sort((a, b) => a.along[0] - b.along[0]);
}

/**
 * The countertop, in one piece from the corner to wherever something stops it.
 *
 * Rule 3 in docs/decisions.md D11: unbroken. Two things break it and they break
 * it differently. A slide-in range sits *in* the top, so the run resumes on the
 * far side of it; a tall cabinet goes through to the ceiling, so what follows is
 * a separate stretch of counter rather than the same one continuing.
 *
 * A sink is a hole, not a break: the top carries on around it. Cutting a real
 * opening rather than laying the bowl on the surface is also what stops the two
 * from z-fighting, since they then never share a plane.
 */
function counterPieces(run: CabinetRun): CounterPiece[] {
  const backEdge = -ROOM.counterDepth / 2;
  const frontEdge = ROOM.counterDepth / 2 + ROOM.counterOverhang;
  const full = [backEdge, frontEdge] as const;

  const spans: (readonly [number, number])[] = [];
  let start: number | null = null;
  for (const segment of run.segments) {
    if (segment.kind === "tall" || segment.slot === "slot-range") {
      if (start !== null) spans.push([start, segment.from] as const);
      start = segment.to;
    } else if (start === null) {
      start = segment.from;
    }
  }
  const last = run.segments[run.segments.length - 1];
  if (start !== null) spans.push([start, last.to] as const);

  const holes = bowlHoles(run);
  const pieces: CounterPiece[] = [];

  for (const span of spans) {
    if (span[1] - span[0] <= 1e-6) continue;
    let cursor = span[0];
    for (const hole of holes) {
      if (hole.along[0] < span[0] || hole.along[1] > span[1]) continue;
      if (hole.along[0] - cursor > 1e-6) {
        pieces.push({ along: [cursor, hole.along[0]], across: full });
      }
      // The strips behind and in front of the opening.
      if (hole.across[0] - backEdge > 1e-6) {
        pieces.push({ along: hole.along, across: [backEdge, hole.across[0]] });
      }
      if (frontEdge - hole.across[1] > 1e-6) {
        pieces.push({ along: hole.along, across: [hole.across[1], frontEdge] });
      }
      cursor = hole.along[1];
    }
    if (span[1] - cursor > 1e-6) pieces.push({ along: [cursor, span[1]], across: full });
  }
  return pieces;
}

function runBoxes(run: CabinetRun): CabinetBox[] {
  const boxes: CabinetBox[] = [];
  const base = BASE_BOX;

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

  for (const [i, piece] of counterPieces(run).entries()) {
    boxes.push(
      onRun(
        run,
        `${run.id}-counter-${i}`,
        "counter",
        piece.along,
        [ROOM.counterHeight - counterT, ROOM.counterHeight],
        piece.across[1] - piece.across[0],
        (piece.across[0] + piece.across[1]) / 2,
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

  // --- uppers ---
  // 42" boxes hung 18" over the counter. The canopy interrupts them, and the
  // run picks up again at 84" where the canopy stops, so the tops line up.
  upper("upper-back-left", backRun, [runExtent(backRun)[0], HOOD_OPENING[0]], UPPER_BAND),
  upper("upper-back-hood", backRun, HOOD_OPENING, OVER_HOOD_BAND),
  upper("upper-back-right", backRun, [HOOD_OPENING[1], runExtent(backRun)[1]], UPPER_BAND),
  // Over the corner and the refrigerator's landing, stopping at the tower.
  upper("upper-left", leftRun, LEFT_UPPER, UPPER_BAND),

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
