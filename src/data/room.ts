import type { SlotId } from "../types";

/**
 * Scene units are feet. Appliance and cabinet dimensions in the brief are
 * inches, so everything crossing that boundary goes through `ft()`.
 */
export const ft = (inches: number) => inches / 12;

/**
 * Room shell, in feet. A 14' x 12' kitchen with an L-shaped run against the
 * -X and -Z walls; the room opens toward the camera at +X / +Z.
 *
 * The depth is set by the island rather than by taste: a 24" run plus a 36"
 * island plus the 42" aisles either side of it is what a working kitchen needs,
 * and anything shallower puts the island within arm's reach of the range.
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
 * The perimeter cabinet runs.
 *
 * Back run (against -Z) carries the range, the sink base, the dishwasher and a
 * stretch of base cabinets. Left run (against -X) carries the refrigerator
 * enclosure and more base cabinets. The corner belongs to the left run.
 *
 * The microwave and the wine cabinet are not here: they live under the island.
 * See docs/decisions.md D5.
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
  /** 36", to match the range and the hood above it. */
  range: [-3.5, -0.5] as const,
  sinkBase: [-0.5, 1.5] as const,
  dishwasher: [1.5, 3.5] as const,
  /** The stretch the oven tower used to occupy. */
  base: [3.5, 7] as const,
  /** Wall left clear above the range for the hood. */
  hoodOpening: [-3.75, -0.25] as const,
};

/** Segment boundaries along the left run, in feet. */
export const LEFT_RUN = {
  /** Outside of the refrigerator enclosure: a 36" opening plus two panels. */
  fridgeEnclosure: [-6, -2.5] as const,
  base: [-2.45, 1] as const,
};

const mid = ([a, b]: readonly [number, number]) => (a + b) / 2;

/** The refrigerator opening, inset from the enclosure by one panel each side. */
export const FRIDGE_OPENING = [
  LEFT_RUN.fridgeEnclosure[0] + PANEL,
  LEFT_RUN.fridgeEnclosure[1] - PANEL,
] as const;

/** The oven tower, split around its opening by the cabinet layer. */
/**
 * The island: 72" x 36" of counter at standard height, standing clear of both
 * perimeter runs.
 *
 * Its two 24" base openings face the perimeter, which is where the cook stands.
 * That is the correct orientation for a working kitchen and the one Leo asked
 * for; the consequence is that the default isometric view sees the island's
 * seating side, so the fly-in orbits round to the working side. See
 * docs/decisions.md D5.
 */
export const ISLAND = {
  x: [-0.5, 5.5] as const,
  /** 42" of aisle to the back run behind it, and the same to the open side. */
  z: [-0.5, 2.5] as const,
  /** The face carrying the two appliance openings, toward the back run. */
  frontZ: -0.5,
  height: ROOM.counterHeight,
  /** Openings along the island's front face, in feet. */
  microwave: [0, 2] as const,
  wine: [2.5, 4.5] as const,
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
  /**
   * Where the services come from. Wall-mounted slots are fed by trunks running
   * along the walls; island slots are fed from below, which is what the install
   * view draws.
   */
  mount: "wall" | "island";
  /**
   * Azimuth the fly-in views this slot from, in radians, when the default
   * isometric angle would show its back. Only the island needs it.
   */
  viewAzimuth?: number;
}

/** The island openings face -Z, so the fly-in views them from behind the room. */
const ISLAND_VIEW_AZIMUTH = Math.PI * 1.25;

export const SLOT_PLACEMENT: Record<SlotId, SlotPlacement> = {
  "slot-fridge": {
    position: [RUN.leftX, 0, mid(FRIDGE_OPENING)],
    rotationY: Math.PI / 2,
    mount: "wall",
  },
  "slot-range": {
    position: [mid(BACK_RUN.range), 0, RUN.backZ],
    rotationY: 0,
    mount: "wall",
  },
  "slot-hood": {
    position: [mid(BACK_RUN.range), ROOM.counterHeight + ft(30), RUN.backZ],
    rotationY: 0,
    mount: "wall",
  },
  "slot-dishwasher": {
    position: [mid(BACK_RUN.dishwasher), 0, RUN.backZ],
    rotationY: 0,
    mount: "wall",
  },
  "slot-microwave": {
    position: [mid(ISLAND.microwave), 0, ISLAND.frontZ],
    rotationY: Math.PI,
    mount: "island",
    viewAzimuth: ISLAND_VIEW_AZIMUTH,
  },
  "slot-wine": {
    position: [mid(ISLAND.wine), 0, ISLAND.frontZ],
    rotationY: Math.PI,
    mount: "island",
    viewAzimuth: ISLAND_VIEW_AZIMUTH,
  },
};
