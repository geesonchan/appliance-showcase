import type { SlotId } from "../types";

/**
 * Scene units are feet. Appliance and cabinet dimensions in the brief are
 * inches, so everything crossing that boundary goes through `ft()`.
 */
export const ft = (inches: number) => inches / 12;

/**
 * Room shell, in feet. A 14' x 10' kitchen with an L-shaped run against the
 * -X and -Z walls; the room opens toward the camera at +X / +Z. The depth is
 * kept tight so the default view is not mostly empty floor.
 */
export const ROOM = {
  halfX: 7,
  halfZ: 5,
  wallHeight: 9,
  counterHeight: ft(36),
  counterDepth: ft(24),
  counterOverhang: ft(1),
  counterThickness: ft(1.5),
  upperBottom: ft(54),
  upperTop: ft(84),
  upperDepth: ft(13),
  toeKick: ft(4),
};

/**
 * The two cabinet runs.
 *
 * Back run (against -Z) carries the range, sink base, dishwasher, microwave
 * base and the oven tower. Left run (against -X) carries the refrigerator
 * enclosure and a stretch of base cabinets. The corner belongs to the left run.
 */
export const RUN = {
  backZ: -ROOM.halfZ + ROOM.counterDepth / 2,
  leftX: -ROOM.halfX + ROOM.counterDepth / 2,
  backFrom: -3.75,
  backTo: ROOM.halfX,
  leftFrom: -ROOM.halfZ,
  leftTo: 2,
};

/** Thickness of a finished panel or a tower side, in feet. */
export const PANEL = ft(3);

/**
 * Segment boundaries along the back run, in feet. Each entry is the outside
 * extent of the cabinetry; openings that carry an appliance are sized to that
 * appliance's cutout plus its side panels.
 */
export const BACK_RUN = {
  cornerFiller: [-3.75, -3.5] as const,
  range: [-3.5, -1] as const,
  sinkBase: [-1, 0.25] as const,
  dishwasher: [0.25, 2.25] as const,
  ovenTower: [2.25, 5] as const,
  microwaveBase: [5, 7] as const,
  /** Wall left clear above the range for the hood. */
  hoodOpening: [-3.75, -0.75] as const,
};

/** Segment boundaries along the left run, in feet. */
export const LEFT_RUN = {
  /** Outside of the refrigerator enclosure: a 36" opening plus two panels. */
  fridgeEnclosure: [-5, -1.5] as const,
  base: [-1.45, 2] as const,
};

const mid = ([a, b]: readonly [number, number]) => (a + b) / 2;

/** The refrigerator opening, inset from the enclosure by one panel each side. */
export const FRIDGE_OPENING = [
  LEFT_RUN.fridgeEnclosure[0] + PANEL,
  LEFT_RUN.fridgeEnclosure[1] - PANEL,
] as const;

/** The oven tower, split around its opening by the cabinet layer. */
export const TALL_TOWER = {
  height: ROOM.upperTop,
  openingBottom: ft(34),
  openingHeight: ft(29),
  get openingTop() {
    return this.openingBottom + this.openingHeight;
  },
  /** The oven opening, inset from the tower by one panel each side. */
  opening: [
    BACK_RUN.ovenTower[0] + ft(1.5),
    BACK_RUN.ovenTower[1] - ft(1.5),
  ] as const,
};


/**
 * Where each slot sits in the room.
 *
 * Placement is scene construction, not product data: it is derived from the
 * cabinet run segments above and is not something maintained in the Sheet.
 * `data/slots.json` carries the rest of each slot — label, cutout, cabinet
 * configuration, utilities — and the two are merged in `slots.ts`.
 */
export interface SlotPlacement {
  /** Floor-level centre of the appliance footprint, in feet. */
  position: [number, number, number];
  /** Rotation about Y in radians. 0 faces +Z, out from the back wall. */
  rotationY: number;
}

export const SLOT_PLACEMENT: Record<SlotId, SlotPlacement> = {
  "slot-fridge": {
    position: [RUN.leftX, 0, mid(FRIDGE_OPENING)],
    rotationY: Math.PI / 2,
  },
  "slot-range": {
    position: [mid(BACK_RUN.range), 0, RUN.backZ],
    rotationY: 0,
  },
  "slot-hood": {
    position: [mid(BACK_RUN.range), ROOM.counterHeight + ft(30), RUN.backZ],
    rotationY: 0,
  },
  "slot-wall-oven": {
    position: [mid(TALL_TOWER.opening), TALL_TOWER.openingBottom, RUN.backZ],
    rotationY: 0,
  },
  "slot-dishwasher": {
    position: [mid(BACK_RUN.dishwasher), 0, RUN.backZ],
    rotationY: 0,
  },
  "slot-microwave": {
    position: [mid(BACK_RUN.microwaveBase), ft(6), RUN.backZ],
    rotationY: 0,
  },
};
