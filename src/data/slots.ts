import type { Slot, SlotId } from "../types";

/**
 * Scene units are feet. Appliance and cabinet dimensions in the brief are
 * inches, so everything crossing that boundary goes through `ft()`.
 */
export const ft = (inches: number) => inches / 12;

/**
 * Room shell, in feet. A 14' x 12' kitchen with an L-shaped run against the
 * -X and -Z walls; the room opens toward the camera at +X / +Z.
 */
export const ROOM = {
  halfX: 7,
  halfZ: 6,
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
  fridgeEnclosure: [-6, -2.5] as const,
  base: [-2.45, 2] as const,
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
 * M1 hard-codes the six slots in the shape of the brief's §3.5.2 Slot type.
 * M2 replaces this module with a `data/slots.json` load, so keep it free of
 * scene and React imports.
 */
export const SLOTS: Slot[] = [
  {
    id: "slot-fridge",
    labelKey: "slot.fridge",
    position: [RUN.leftX, 0, mid(FRIDGE_OPENING)],
    rotationY: Math.PI / 2,
    cutout: { w: 36, h: 72, d: 25 },
    compatibleCategories: ["refrigerator"],
    cabinetConfig: {
      type: "enclosure",
      openingIn: { w: 36, h: 72, d: 25 },
      panelReady: true,
      finishedSides: 2,
    },
    utilities: {
      power: { voltage: 120, amps: 15, dedicated: true },
      water: { supply: true, drain: false },
    },
  },
  {
    id: "slot-range",
    labelKey: "slot.range",
    position: [mid(BACK_RUN.range), 0, RUN.backZ],
    rotationY: 0,
    cutout: { w: 30, h: 36, d: 24 },
    compatibleCategories: ["range"],
    cabinetConfig: {
      type: "base",
      openingIn: { w: 30, h: 36, d: 24 },
      panelReady: false,
      finishedSides: 2,
    },
    utilities: {
      gas: { pipeSize: '1/2"', shutoff: true },
      power: { voltage: 120, amps: 15, dedicated: true },
    },
  },
  {
    id: "slot-hood",
    labelKey: "slot.hood",
    position: [mid(BACK_RUN.range), ROOM.counterHeight + ft(30), RUN.backZ],
    rotationY: 0,
    cutout: { w: 36, h: 30, d: 20 },
    compatibleCategories: ["hood"],
    cabinetConfig: {
      type: "upper",
      openingIn: { w: 36, h: 30, d: 20 },
      panelReady: false,
      finishedSides: 2,
    },
    utilities: {
      power: { voltage: 120, amps: 15, dedicated: true },
      duct: { diameterIn: 8, route: "up-through-cabinet" },
    },
  },
  {
    id: "slot-wall-oven",
    labelKey: "slot.wallOven",
    position: [mid(TALL_TOWER.opening), TALL_TOWER.openingBottom, RUN.backZ],
    rotationY: 0,
    cutout: { w: 30, h: 29, d: 24 },
    compatibleCategories: ["wall-oven"],
    cabinetConfig: {
      type: "tall",
      openingIn: { w: 30, h: 29, d: 24 },
      panelReady: false,
      finishedSides: 1,
    },
    utilities: {
      power: { voltage: 240, amps: 30, dedicated: true },
    },
  },
  {
    id: "slot-dishwasher",
    labelKey: "slot.dishwasher",
    position: [mid(BACK_RUN.dishwasher), 0, RUN.backZ],
    rotationY: 0,
    cutout: { w: 24, h: 34, d: 24 },
    compatibleCategories: ["dishwasher"],
    cabinetConfig: {
      type: "base",
      openingIn: { w: 24, h: 34, d: 24 },
      panelReady: true,
      finishedSides: 0,
    },
    utilities: {
      power: { voltage: 120, amps: 15, dedicated: true },
      water: { supply: true, drain: true },
    },
  },
  {
    id: "slot-microwave",
    labelKey: "slot.microwave",
    position: [mid(BACK_RUN.microwaveBase), ft(6), RUN.backZ],
    rotationY: 0,
    cutout: { w: 24, h: 16, d: 22 },
    compatibleCategories: ["microwave"],
    cabinetConfig: {
      type: "base",
      openingIn: { w: 24, h: 16, d: 22 },
      panelReady: false,
      finishedSides: 0,
    },
    utilities: {
      power: { voltage: 120, amps: 20, dedicated: true },
    },
  },
];

export const SLOT_BY_ID: Record<SlotId, Slot> = Object.fromEntries(
  SLOTS.map((slot) => [slot.id, slot]),
) as Record<SlotId, Slot>;
