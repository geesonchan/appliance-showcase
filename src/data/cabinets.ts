import type { SlotId } from "../types";
import {
  BACK_RUN,
  ISLAND,
  FRIDGE_OPENING,
  LEFT_RUN,
  PANEL,
  ROOM,
  RUN,
  ft,
} from "./slots";

export type CabinetKind = "base" | "tall" | "upper" | "counter" | "toe" | "surround";

export interface CabinetBox {
  id: string;
  kind: CabinetKind;
  /**
   * Boxes sharing an outline group are pieces of one visual volume (the oven
   * tower split around its opening, the refrigerator surround). The mobile
   * install view draws the union of each group instead of every piece.
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

const { backZ, leftX } = RUN;
const upperZ = -ROOM.halfZ + ROOM.upperDepth / 2;
const upperX = -ROOM.halfX + ROOM.upperDepth / 2;
const upperH = ROOM.upperTop - ROOM.upperBottom;
const upperY = ROOM.upperBottom + upperH / 2;
const counterT = ROOM.counterThickness;

const span = ([a, b]: readonly [number, number]) => b - a;
const mid = ([a, b]: readonly [number, number]) => (a + b) / 2;

/** A base cabinet along the back wall, given its x extents. */
function backBase(
  id: string,
  x: readonly [number, number],
  slot?: SlotId,
): CabinetBox {
  return {
    id,
    slot,
    kind: "base",
    position: [mid(x), ROOM.counterHeight / 2, backZ],
    size: [span(x), ROOM.counterHeight, ROOM.counterDepth],
  };
}

function backCounter(id: string, x: readonly [number, number]): CabinetBox {
  return {
    id,
    kind: "counter",
    position: [mid(x), ROOM.counterHeight + counterT / 2, backZ + ROOM.counterOverhang / 2],
    size: [span(x), counterT, ROOM.counterDepth + ROOM.counterOverhang],
  };
}

/**
 * The L-shaped cabinet run, derived once so the finished view, the white model
 * and the install wireframe all read from the same boxes.
 *
 * Openings are deliberate gaps: the range, the dishwasher and the wall oven
 * each get an empty volume for the appliance to sit in.
 */
export const CABINETS: CabinetBox[] = [
  // --- back wall run ---
  backBase("back-corner-filler", BACK_RUN.cornerFiller),
  backBase("back-sink-base", BACK_RUN.sinkBase),
  backBase("back-right-base", BACK_RUN.base),
  backCounter("counter-corner", BACK_RUN.cornerFiller),
  // One continuous run from the sink base to the end of the wall: it passes
  // over the dishwasher, and only the range breaks it.
  backCounter("counter-main", [BACK_RUN.sinkBase[0], BACK_RUN.base[1]]),

  // --- left wall run ---
  {
    id: "left-base",
    kind: "base",
    position: [leftX, ROOM.counterHeight / 2, mid(LEFT_RUN.base)],
    size: [ROOM.counterDepth, ROOM.counterHeight, span(LEFT_RUN.base)],
  },
  {
    id: "counter-left",
    kind: "counter",
    position: [
      leftX + ROOM.counterOverhang / 2,
      ROOM.counterHeight + counterT / 2,
      mid(LEFT_RUN.base),
    ],
    size: [ROOM.counterDepth + ROOM.counterOverhang, counterT, span(LEFT_RUN.base)],
  },

  // --- refrigerator enclosure: two finished side panels and a bridging upper ---
  {
    id: "fridge-panel-back",
    outline: "fridge-enclosure",
    slot: "slot-fridge",
    kind: "surround",
    position: [leftX, ROOM.upperTop / 2, LEFT_RUN.fridgeEnclosure[0] + PANEL / 2],
    size: [ROOM.counterDepth, ROOM.upperTop, PANEL],
  },
  {
    id: "fridge-panel-front",
    outline: "fridge-enclosure",
    slot: "slot-fridge",
    kind: "surround",
    position: [leftX, ROOM.upperTop / 2, LEFT_RUN.fridgeEnclosure[1] - PANEL / 2],
    size: [ROOM.counterDepth, ROOM.upperTop, PANEL],
  },
  {
    id: "fridge-bridge",
    outline: "fridge-enclosure",
    slot: "slot-fridge",
    kind: "upper",
    position: [leftX, ft(72) + (ROOM.upperTop - ft(72)) / 2, mid(FRIDGE_OPENING)],
    size: [ROOM.counterDepth, ROOM.upperTop - ft(72), span(FRIDGE_OPENING)],
  },

  // --- uppers (the hood occupies the wall above the range) ---
  {
    id: "upper-back",
    kind: "upper",
    position: [mid([BACK_RUN.hoodOpening[1], BACK_RUN.base[1]]), upperY, upperZ],
    size: [span([BACK_RUN.hoodOpening[1], BACK_RUN.base[1]]), upperH, ROOM.upperDepth],
  },
  {
    id: "upper-left",
    kind: "upper",
    position: [upperX, upperY, mid(LEFT_RUN.base)],
    size: [ROOM.upperDepth, upperH, span(LEFT_RUN.base)],
  },

  // --- island ---
  // Carcass in three pieces, leaving the two appliance openings empty. The
  // whole box is one volume for the mobile outline.
  {
    id: "island-left",
    outline: "island",
    kind: "base",
    position: [
      mid([ISLAND.x[0], ISLAND.microwave[0]]),
      ROOM.counterHeight / 2,
      mid(ISLAND.z),
    ],
    size: [span([ISLAND.x[0], ISLAND.microwave[0]]), ROOM.counterHeight, span(ISLAND.z)],
  },
  {
    id: "island-middle",
    outline: "island",
    kind: "base",
    position: [
      mid([ISLAND.microwave[1], ISLAND.wine[0]]),
      ROOM.counterHeight / 2,
      mid(ISLAND.z),
    ],
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
    id: "island-back",
    outline: "island",
    kind: "base",
    // The far half of the island, behind the appliance openings.
    position: [
      mid(ISLAND.x),
      ROOM.counterHeight / 2,
      mid([ISLAND.z[0] + ROOM.counterDepth, ISLAND.z[1]]),
    ],
    size: [
      span(ISLAND.x),
      ROOM.counterHeight,
      span([ISLAND.z[0] + ROOM.counterDepth, ISLAND.z[1]]),
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

  // --- toe kicks ---
  {
    id: "toe-back",
    kind: "toe",
    position: [
      mid([BACK_RUN.cornerFiller[0], BACK_RUN.base[1]]),
      ROOM.toeKick / 2,
      backZ - ft(1.5),
    ],
    size: [
      span([BACK_RUN.cornerFiller[0], BACK_RUN.base[1]]),
      ROOM.toeKick,
      ROOM.counterDepth - ft(3),
    ],
  },
  {
    id: "toe-left",
    kind: "toe",
    position: [leftX - ft(1.5), ROOM.toeKick / 2, mid([LEFT_RUN.fridgeEnclosure[0], LEFT_RUN.base[1]])],
    size: [
      ROOM.counterDepth - ft(3),
      ROOM.toeKick,
      span([LEFT_RUN.fridgeEnclosure[0], LEFT_RUN.base[1]]),
    ],
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
