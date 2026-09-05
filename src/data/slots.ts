import type { Slot, SlotId } from "../types";

/**
 * Scene units are feet. Appliance and cabinet dimensions in the brief are
 * inches, so everything crossing that boundary goes through `ft()`.
 */
export const ft = (inches: number) => inches / 12;

/** Room shell, in feet. Walls stand on -X and -Z; the room opens toward +X/+Z. */
export const ROOM = {
  width: 12,
  depth: 12,
  wallHeight: 9,
  /** Half-extent: walls sit at x = -6 and z = -6. */
  half: 6,
  counterHeight: ft(36),
  counterDepth: ft(24),
  counterOverhang: ft(1),
  upperBottom: ft(54),
  upperTop: ft(84),
  upperDepth: ft(13),
  toeKick: ft(4),
};

/** Centre line of the two cabinet runs. */
export const RUN = {
  /** Back run hugs -Z; its cabinet boxes are centred at this z. */
  backZ: -ROOM.half + ROOM.counterDepth / 2,
  /** Left run hugs -X; its cabinet boxes are centred at this x. */
  leftX: -ROOM.half + ROOM.counterDepth / 2,
  /** Back run spans this x range (the corner belongs to the left run). */
  backFrom: -4,
  backTo: 6,
  /** Left run spans this z range. */
  leftFrom: -6,
  leftTo: 2,
};

/**
 * M1 hard-codes the six slots in the shape of the brief's §3.5.2 Slot type.
 * M2 replaces this module with a `data/slots.json` load; nothing else should
 * need to change, so keep this file free of scene/React imports.
 */
export const SLOTS: Slot[] = [
  {
    id: "slot-wall-oven",
    labelKey: "slot.wallOven",
    position: [RUN.leftX, 0, -4.75],
    rotationY: Math.PI / 2,
    cutout: { w: 30, h: 50, d: 24 },
    compatibleCategories: ["wall-oven"],
    cabinetConfig: {
      type: "tall",
      openingIn: { w: 30, h: 50, d: 24 },
      panelReady: false,
      finishedSides: 1,
    },
    utilities: {
      power: { voltage: 240, amps: 30, dedicated: true },
    },
  },
  {
    id: "slot-fridge",
    labelKey: "slot.fridge",
    position: [RUN.leftX, 0, -1.75],
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
    position: [-2, 0, RUN.backZ],
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
    position: [-2, ROOM.counterHeight + ft(30), RUN.backZ],
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
    id: "slot-dishwasher",
    labelKey: "slot.dishwasher",
    position: [1, 0, RUN.backZ],
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
    position: [3.5, ft(6), RUN.backZ],
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
