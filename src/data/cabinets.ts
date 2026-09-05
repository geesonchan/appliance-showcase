import {
  BACK_RUN,
  FRIDGE_OPENING,
  LEFT_RUN,
  PANEL,
  ROOM,
  RUN,
  TALL_TOWER,
  ft,
} from "./slots";

export type CabinetKind = "base" | "tall" | "upper" | "counter" | "toe" | "surround";

export interface CabinetBox {
  id: string;
  kind: CabinetKind;
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
function backBase(id: string, x: readonly [number, number]): CabinetBox {
  return {
    id,
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
  backBase("back-microwave-base", BACK_RUN.microwaveBase),
  backCounter("counter-corner", BACK_RUN.cornerFiller),
  // The countertop runs continuously over the dishwasher but not over the
  // range, and breaks again for the oven tower.
  backCounter("counter-main", [BACK_RUN.sinkBase[0], BACK_RUN.ovenTower[0]]),
  backCounter("counter-right", BACK_RUN.microwaveBase),

  // --- oven tower, split around the wall-oven opening ---
  {
    id: "oven-tower-lower",
    kind: "tall",
    position: [mid(BACK_RUN.ovenTower), TALL_TOWER.openingBottom / 2, backZ],
    size: [span(BACK_RUN.ovenTower), TALL_TOWER.openingBottom, ROOM.counterDepth],
  },
  {
    id: "oven-tower-upper",
    kind: "tall",
    position: [
      mid(BACK_RUN.ovenTower),
      TALL_TOWER.openingTop + (TALL_TOWER.height - TALL_TOWER.openingTop) / 2,
      backZ,
    ],
    size: [
      span(BACK_RUN.ovenTower),
      TALL_TOWER.height - TALL_TOWER.openingTop,
      ROOM.counterDepth,
    ],
  },
  {
    id: "oven-tower-side-left",
    kind: "tall",
    position: [
      mid([BACK_RUN.ovenTower[0], TALL_TOWER.opening[0]]),
      mid([TALL_TOWER.openingBottom, TALL_TOWER.openingTop]),
      backZ,
    ],
    size: [
      span([BACK_RUN.ovenTower[0], TALL_TOWER.opening[0]]),
      TALL_TOWER.openingHeight,
      ROOM.counterDepth,
    ],
  },
  {
    id: "oven-tower-side-right",
    kind: "tall",
    position: [
      mid([TALL_TOWER.opening[1], BACK_RUN.ovenTower[1]]),
      mid([TALL_TOWER.openingBottom, TALL_TOWER.openingTop]),
      backZ,
    ],
    size: [
      span([TALL_TOWER.opening[1], BACK_RUN.ovenTower[1]]),
      TALL_TOWER.openingHeight,
      ROOM.counterDepth,
    ],
  },

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
    kind: "surround",
    position: [leftX, ROOM.upperTop / 2, LEFT_RUN.fridgeEnclosure[0] + PANEL / 2],
    size: [ROOM.counterDepth, ROOM.upperTop, PANEL],
  },
  {
    id: "fridge-panel-front",
    kind: "surround",
    position: [leftX, ROOM.upperTop / 2, LEFT_RUN.fridgeEnclosure[1] - PANEL / 2],
    size: [ROOM.counterDepth, ROOM.upperTop, PANEL],
  },
  {
    id: "fridge-bridge",
    kind: "upper",
    position: [leftX, ft(72) + (ROOM.upperTop - ft(72)) / 2, mid(FRIDGE_OPENING)],
    size: [ROOM.counterDepth, ROOM.upperTop - ft(72), span(FRIDGE_OPENING)],
  },

  // --- uppers (the hood occupies the wall above the range) ---
  {
    id: "upper-back",
    kind: "upper",
    position: [mid([BACK_RUN.hoodOpening[1], BACK_RUN.ovenTower[0]]), upperY, upperZ],
    size: [
      span([BACK_RUN.hoodOpening[1], BACK_RUN.ovenTower[0]]),
      upperH,
      ROOM.upperDepth,
    ],
  },
  {
    id: "upper-back-right",
    kind: "upper",
    position: [mid(BACK_RUN.microwaveBase), upperY, upperZ],
    size: [span(BACK_RUN.microwaveBase), upperH, ROOM.upperDepth],
  },
  {
    id: "upper-left",
    kind: "upper",
    position: [upperX, upperY, mid(LEFT_RUN.base)],
    size: [ROOM.upperDepth, upperH, span(LEFT_RUN.base)],
  },

  // --- toe kicks ---
  {
    id: "toe-back",
    kind: "toe",
    position: [
      mid([BACK_RUN.cornerFiller[0], BACK_RUN.microwaveBase[1]]),
      ROOM.toeKick / 2,
      backZ - ft(1.5),
    ],
    size: [
      span([BACK_RUN.cornerFiller[0], BACK_RUN.microwaveBase[1]]),
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
