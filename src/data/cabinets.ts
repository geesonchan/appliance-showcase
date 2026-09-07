import type { SlotId } from "../types";
import { SLOT_BY_ID } from "./slots";
import {
  ISLAND,
  PANEL,
  ROOM,
  RUNS,
  type CabinetModule,
  type CabinetRun,
  type RunSegment,
  type UpperBank,
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
  /** The cabinet this box is, when it is one. Shown under ?debug=1. */
  module?: CabinetModule;
  /** Centre of the box, in feet. */
  position: [number, number, number];
  /** Full extents, in feet. */
  size: [number, number, number];
}

/** The base box under the top: 34.5" plus a 1.5" counter makes 36". */
const BASE_BOX = [0, ROOM.counterHeight - ROOM.counterThickness] as const;

/** The refrigerator opening's height, in feet, as the slot actually declares it. */
const FRIDGE_OPENING_H = ft(SLOT_BY_ID["slot-fridge"].cutout.h);

const span = ([a, b]: readonly [number, number]) => b - a;
const mid = ([a, b]: readonly [number, number]) => (a + b) / 2;

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

/** Walk a segment's modules, handing each its own stretch of the run. */
function eachModule(
  from: number,
  modules: CabinetModule[],
  visit: (module: CabinetModule, along: readonly [number, number]) => void,
) {
  let cursor = from;
  for (const module of modules) {
    const next = cursor + ft(module.widthIn);
    visit(module, [cursor, next] as const);
    cursor = next;
  }
}

/**
 * The base run, one box per cabinet.
 *
 * Drawn module by module rather than segment by segment, because that is what
 * is standing there: a wall of separate boxes, each one orderable, with a
 * reveal between the doors. It also means the debug view can name every one of
 * them, and a run that does not add up shows as a gap rather than being
 * silently stretched to fit.
 */
function segmentBoxes(run: CabinetRun, segment: RunSegment): CabinetBox[] {
  const boxes: CabinetBox[] = [];
  const base = BASE_BOX;

  eachModule(segment.from, segment.modules, (module, along) => {
    if (module.kind === "opening") return;

    if (module.kind === "tall") {
      // A finished panel each side, the appliance opening between them, and a
      // bridging cabinet over the top. The bridge starts where the opening
      // stops, so raising the opening shortens the cabinet above it rather
      // than leaving the appliance poking through.
      const opening = [along[0] + PANEL, along[1] - PANEL] as const;
      const outline = segment.id;
      const tall = [0, ft(module.heightIn ?? 96)] as const;
      boxes.push(
        onRun(run, `${segment.id}-panel-a`, "surround", [along[0], opening[0]], tall, ROOM.counterDepth, 0, { outline, slot: module.slot, module }),
        onRun(run, `${segment.id}-panel-b`, "surround", [opening[1], along[1]], tall, ROOM.counterDepth, 0, { outline, slot: module.slot, module }),
        onRun(run, `${segment.id}-bridge`, "upper", opening, [FRIDGE_OPENING_H, tall[1]], ROOM.counterDepth, 0, { outline, slot: module.slot, module }),
      );
      return;
    }

    // A lazy susan is a square: it belongs to both legs, so it is as deep as
    // it is wide and the other leg starts where it stops. Drawing it one
    // cabinet deep is what left a hole at the inside corner.
    const depth = module.kind === "corner" ? ft(module.widthIn) : ROOM.counterDepth;
    const offset = module.kind === "corner" ? (depth - ROOM.counterDepth) / 2 : 0;
    boxes.push(
      onRun(run, `${segment.id}-${module.code}`, "base", along, base, depth, offset, {
        module,
      }),
    );
  });

  return boxes;
}

/**
 * The bridge over a canopy: from the canopy's top up to the ceiling, less a
 * closing scribe.
 *
 * It cannot be a stock box. Hanging the canopy 30" over a 36-3/4" cooking
 * surface puts its top at 84-3/4", and 96" less that is 11-1/4" — no supplier
 * lists an 11" bridge. A made-to-size bridge over a hood is ordinary, so it is
 * ordered to the whole inch and the remainder becomes the closing gap D13
 * allows at the ceiling.
 */
export function hoodBridgeBand(): readonly [number, number] {
  const hood = SLOT_BY_ID["slot-hood"];
  const floor = hood.position[1] + ft(hood.cutout.h);
  const heightIn = Math.floor((ROOM.wallHeight - floor) * 12);
  return [floor, floor + ft(heightIn)] as const;
}

/** A bank of wall cabinets, likewise one box per module. */
function upperBoxes(run: CabinetRun, bank: UpperBank): CabinetBox[] {
  const boxes: CabinetBox[] = [];
  const inset = (ROOM.counterDepth - ROOM.upperDepth) / 2;
  const band = bank.band ?? hoodBridgeBand();
  eachModule(bank.from, bank.modules, (module, along) => {
    // Same at high level: a corner wall cabinet reaches into both legs, so the
    // run next to it starts where its square stops rather than overlapping it.
    const corner = module.kind === "corner";
    const depth = corner ? ft(module.widthIn) : ROOM.upperDepth;
    const across = corner ? -(ROOM.counterDepth - depth) / 2 : -inset;
    boxes.push(
      onRun(run, `${bank.id}-${module.code}`, "upper", along, band, depth, across, {
        module,
        slot: module.slot,
      }),
    );
  });
  return boxes;
}

function runBoxes(run: CabinetRun): CabinetBox[] {
  const boxes: CabinetBox[] = run.segments.flatMap((segment) => segmentBoxes(run, segment));

  for (const bank of run.uppers) boxes.push(...upperBoxes(run, bank));

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

  // --- island ---
  // The two openings come in from opposite faces, so the carcass is the island
  // minus each of them: solid across the full depth where there is no opening,
  // and solid behind each opening on its own side.
  {
    id: "island-left",
    outline: "island",
    kind: "base",
    position: [mid([ISLAND.x[0], ISLAND.microwave[0]]), BASE_BOX[1] / 2, mid(ISLAND.z)],
    size: [span([ISLAND.x[0], ISLAND.microwave[0]]), BASE_BOX[1], span(ISLAND.z)],
  },
  {
    id: "island-middle",
    outline: "island",
    kind: "base",
    position: [mid([ISLAND.microwave[1], ISLAND.wine[0]]), BASE_BOX[1] / 2, mid(ISLAND.z)],
    size: [span([ISLAND.microwave[1], ISLAND.wine[0]]), BASE_BOX[1], span(ISLAND.z)],
  },
  {
    id: "island-right",
    outline: "island",
    kind: "base",
    position: [mid([ISLAND.wine[1], ISLAND.x[1]]), BASE_BOX[1] / 2, mid(ISLAND.z)],
    size: [span([ISLAND.wine[1], ISLAND.x[1]]), BASE_BOX[1], span(ISLAND.z)],
  },
  {
    // Behind the microwave, on the seating side.
    id: "island-behind-microwave",
    outline: "island",
    kind: "base",
    position: [
      mid(ISLAND.microwave),
      BASE_BOX[1] / 2,
      mid([ISLAND.workingZ + ROOM.counterDepth, ISLAND.z[1]]),
    ],
    size: [
      span(ISLAND.microwave),
      BASE_BOX[1],
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
      BASE_BOX[1] / 2,
      mid([ISLAND.z[0], ISLAND.seatingZ - ROOM.counterDepth]),
    ],
    size: [
      span(ISLAND.wine),
      BASE_BOX[1],
      span([ISLAND.z[0], ISLAND.seatingZ - ROOM.counterDepth]),
    ],
  },
  {
    id: "island-counter",
    kind: "counter",
    position: [mid(ISLAND.x), ROOM.counterHeight - ROOM.counterThickness / 2, mid(ISLAND.z)],
    size: [
      span(ISLAND.x) + ROOM.counterOverhang * 2,
      ROOM.counterThickness,
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

/**
 * One label per cabinet, not per box.
 *
 * A tall enclosure is drawn as three pieces — two panels and the bridge over
 * the opening — that all carry the same module, and three copies of "T4296"
 * stacked on each other reads as a rendering fault.
 */
export function labelledBoxes() {
  const seen = new Set<CabinetModule>();
  return CABINETS.filter((box) => {
    if (!box.module || box.module.kind === "opening") return false;
    if (seen.has(box.module)) return false;
    seen.add(box.module);
    return true;
  });
}
