import type { FixtureId, SlotId } from "../types";

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
  /** Finished counter height: a 34.5" base box under a 1.5" top. */
  counterHeight: ft(36),
  counterThickness: ft(1.5),
  counterDepth: ft(24),
  counterOverhang: ft(1),
  /** Wall cabinets: 12" deep, 42" tall, hung 18" above the counter. */
  upperDepth: ft(12),
  upperBottom: ft(54),
  upperTop: ft(96),
  /** Tall cabinets are 24" deep and run to the same 96" as the uppers. */
  tallTop: ft(96),
  toeKick: ft(4),
};

/**
 * The dimensions a North American kitchen is actually built to.
 *
 * Written as inches because that is how the trade states them, and kept apart
 * from ROOM because these are the constraints — the numbers a layout is checked
 * against — while ROOM is this particular room. See docs/decisions.md D13.
 */
export const CABINET_STANDARDS = {
  base: { depthIn: 24, boxHeightIn: 34.5, counterHeightIn: 36 },
  /** Cabinet widths come in 3" increments between 12" and 36". */
  widthIn: { min: 12, max: 36, step: 3 },
  upper: { depthIn: 12, heightsIn: [30, 36, 42], bottomAboveCounterIn: 18 },
  tall: { depthIn: 24, heightsIn: [84, 90, 96] },
  /** A lazy susan is a 36" square; a blind corner is 42" along one run. */
  corner: { lazySusanIn: 36, blindIn: 42 },
  /** An L needs a short leg of at least 8ft and a long leg of 10-12ft. */
  legIn: { shortMin: 96, longMin: 120, longMax: 144 },
  /**
   * Ventilation, from the Thermador clearance sheet
   * (docs/reference/thermador-hood-clearance.png).
   */
  hood: {
    bodyHeightIn: 18,
    /** Canopy bottom above the cooking surface. Gas sets the 30" minimum. */
    aboveCooktopMinIn: 30,
    aboveCooktopMaxIn: 40,
    /** The duct collar sits this far above the canopy top. */
    outletAboveBodyIn: 8.375,
  },
};

/** Thickness of a finished panel or a tower side, in feet. */
export const PANEL = ft(3);

/**
 * What a stretch of a cabinet run is for.
 *
 * `corner` is the L itself — a lazy susan or a blind corner, never an appliance.
 * `tall` is a full-height enclosure. `appliance` and `fixture` are openings the
 * carcass leaves for something to sit in. `counter` is plain base cabinetry.
 */
export type SegmentKind = "corner" | "counter" | "appliance" | "tall" | "fixture";

/**
 * One cabinet, as it would be ordered.
 *
 * A run is built out of these and nothing else, the way a kitchen actually is:
 * boxes off a size list, fillers absorbing the remainder, and the widths adding
 * up to the wall exactly. `docs/reference/cabinet-modules.md` has the size lists
 * and where they come from.
 */
export type ModuleKind =
  | "base"
  | "drawer-base"
  | "sink-base"
  | "wall"
  | "bridge"
  | "tall"
  | "corner"
  | "filler"
  | "opening";

export interface CabinetModule {
  /** The trade code: B24, SB30, DB18, LS36, W3042, T4296, BF3, RO36. */
  code: string;
  kind: ModuleKind;
  widthIn: number;
  /** Present where the height is part of the code — wall and tall boxes. */
  heightIn?: number;
  /** The appliance or fixture this module houses. */
  slot?: SlotId;
  fixture?: FixtureId;
}

export interface RunSegment {
  id: string;
  kind: SegmentKind;
  /** Extent along the run's axis, in feet. */
  from: number;
  to: number;
  slot?: SlotId;
  fixture?: FixtureId;
  /**
   * The cabinets this segment is built from, in order. Their widths have to
   * add up to the segment exactly; `checkLayout` says by how much they miss.
   */
  modules: CabinetModule[];
}

/** A stretch of wall cabinets, which have their own widths and heights. */
export interface UpperBank {
  id: string;
  from: number;
  to: number;
  /** Bottom and top above the floor, in feet. */
  band: readonly [number, number];
  modules: CabinetModule[];
}

export interface CabinetRun {
  id: "back" | "left";
  /** The axis this run travels along. */
  axis: "x" | "z";
  /** The run's centre line on the other horizontal axis, in feet. */
  centre: number;
  /**
   * Segments in order, starting at the corner. "End of the run" therefore
   * means the last entry, which is what rule 1 is about.
   */
  segments: RunSegment[];
  uppers: UpperBank[];
}

/** Shorthand for the module lists below. Widths are inches throughout. */
const M = (
  code: string,
  kind: ModuleKind,
  widthIn: number,
  extra: Partial<CabinetModule> = {},
): CabinetModule => ({ code, kind, widthIn, ...extra });

/**
 * Scheme 01, cabinet by cabinet.
 *
 * Read each run from its inside corner outward, so "the end of the run" is the
 * last entry — which is where the refrigerator tower goes (D11 rule 1). The
 * corner square belongs to the left run, so the back run starts one lazy susan
 * clear of the wall it meets.
 *
 * Every width here is off the size lists in docs/reference/cabinet-modules.md,
 * and the modules in each segment add up to the segment exactly. That is the
 * point of writing them out: a wall that cannot be composed from real boxes is
 * a wall nobody can order.
 */
export const RUNS: CabinetRun[] = [
  {
    id: "left",
    axis: "z",
    centre: -ROOM.halfX + ROOM.counterDepth / 2,
    // 36 + 24 + 18 + 18 + 42 = 138", the short leg of the L.
    segments: [
      {
        id: "left-corner",
        kind: "corner",
        from: -6,
        to: -3,
        modules: [M("LS36", "corner", 36)],
      },
      {
        id: "left-base",
        kind: "counter",
        from: -3,
        to: -1,
        modules: [M("B24", "base", 24)],
      },
      {
        id: "left-drawers",
        kind: "counter",
        from: -1,
        to: 0.5,
        modules: [M("DB18", "drawer-base", 18)],
      },
      // D11 rule 6: the refrigerator's landing, on the corner side of the tower.
      {
        id: "left-fridge-landing",
        kind: "counter",
        from: 0.5,
        to: 2,
        modules: [M("B18", "base", 18)],
      },
      // D11 rule 1: the tower is the last thing on the run.
      {
        id: "left-fridge",
        kind: "tall",
        from: 2,
        to: 5.5,
        slot: "slot-fridge",
        modules: [M("T4296", "tall", 42, { heightIn: 96, slot: "slot-fridge" })],
      },
    ],
    uppers: [
      {
        id: "upper-left",
        from: -6,
        to: 2,
        band: [ROOM.upperBottom, ROOM.upperTop],
        modules: [
          M("WER2442", "corner", 24, { heightIn: 42 }),
          M("W3042", "wall", 30, { heightIn: 42 }),
          M("W3042", "wall", 30, { heightIn: 42 }),
          M("W1242", "wall", 12, { heightIn: 42 }),
        ],
      },
    ],
  },
  {
    id: "back",
    axis: "x",
    centre: -ROOM.halfZ + ROOM.counterDepth / 2,
    // 15 + 36 + 15 + 30 + 24 + 12 = 132", the long leg.
    segments: [
      {
        id: "back-range-landing-left",
        kind: "counter",
        from: -4,
        to: -2.75,
        modules: [M("B15", "base", 15)],
      },
      {
        id: "back-range",
        kind: "appliance",
        from: -2.75,
        to: 0.25,
        slot: "slot-range",
        modules: [M("RO36", "opening", 36, { slot: "slot-range" })],
      },
      {
        id: "back-range-landing-right",
        kind: "counter",
        from: 0.25,
        to: 1.5,
        modules: [M("B15", "base", 15)],
      },
      {
        id: "back-sink",
        kind: "fixture",
        from: 1.5,
        to: 4,
        fixture: "fixture-sink",
        modules: [M("SB30", "sink-base", 30, { fixture: "fixture-sink" })],
      },
      // D11 rule 5: hard against the sink base, on the side away from the range.
      {
        id: "back-dishwasher",
        kind: "appliance",
        from: 4,
        to: 6,
        slot: "slot-dishwasher",
        modules: [M("RO24", "opening", 24, { slot: "slot-dishwasher" })],
      },
      {
        id: "back-end",
        kind: "counter",
        from: 6,
        to: 7,
        modules: [M("B12", "base", 12)],
      },
    ],
    uppers: [
      {
        id: "upper-back-left",
        from: -4,
        to: -3,
        band: [ROOM.upperBottom, ROOM.upperTop],
        modules: [M("W1242", "wall", 12, { heightIn: 42 })],
      },
      {
        // The bridge over the canopy: 84" to 96", so its top lines up with the
        // 42" cabinets either side.
        id: "upper-back-hood",
        from: -3,
        to: 0.5,
        band: [
          ROOM.counterHeight +
            ft(CABINET_STANDARDS.hood.aboveCooktopMinIn + CABINET_STANDARDS.hood.bodyHeightIn),
          ROOM.upperTop,
        ],
        modules: [M("W4212", "bridge", 42, { heightIn: 12, slot: "slot-hood" })],
      },
      {
        id: "upper-back-right",
        from: 0.5,
        to: 7,
        band: [ROOM.upperBottom, ROOM.upperTop],
        modules: [
          M("W3042", "wall", 30, { heightIn: 42 }),
          M("W3042", "wall", 30, { heightIn: 42 }),
          M("W1842", "wall", 18, { heightIn: 42 }),
        ],
      },
    ],
  },
];

export const RUN_BY_ID: Record<CabinetRun["id"], CabinetRun> = Object.fromEntries(
  RUNS.map((run) => [run.id, run]),
) as Record<CabinetRun["id"], CabinetRun>;

/** Centre lines of the two runs, kept as named values for the scene code. */
export const RUN = {
  backZ: RUN_BY_ID.back.centre,
  leftX: RUN_BY_ID.left.centre,
};

const segment = (runId: CabinetRun["id"], segmentId: string): RunSegment => {
  const found = RUN_BY_ID[runId].segments.find((s) => s.id === segmentId);
  if (!found) throw new Error(`room.ts: no segment ${segmentId} on the ${runId} run`);
  return found;
};

/** The segment carrying a slot, wherever it is. */
export function segmentForSlot(slotId: SlotId): RunSegment | undefined {
  for (const run of RUNS) {
    const found = run.segments.find((s) => s.slot === slotId);
    if (found) return found;
  }
  return undefined;
}

export const extent = (s: RunSegment) => [s.from, s.to] as const;
const mid = (s: RunSegment) => (s.from + s.to) / 2;
export const spanOf = (s: RunSegment) => s.to - s.from;

/**
 * The refrigerator opening, inset from its enclosure by one finished panel
 * each side.
 */
export const FRIDGE_OPENING = [
  segment("left", "left-fridge").from + PANEL,
  segment("left", "left-fridge").to - PANEL,
] as const;

/** Wall left clear above the range for the hood, 3" proud of it each side. */
export const HOOD_OPENING = [
  segment("back", "back-range").from - ft(3),
  segment("back", "back-range").to + ft(3),
] as const;

/**
 * The island: 72" x 36" of counter at standard height, standing clear of both
 * perimeter runs.
 *
 * The two openings face opposite ways, and that is deliberate. The microwave
 * drawer opens toward the perimeter, where the cook stands. The wine cabinet
 * opens toward the seating side, where the person pouring stands — and, not by
 * accident, toward the camera, so the overview shows a glass door rather than a
 * blank cabinet end. See docs/decisions.md D5.
 */
export const ISLAND = {
  x: [-0.5, 5.5] as const,
  /** 42" of aisle to the back run behind it, and the same to the open side. */
  z: [-0.5, 2.5] as const,
  /** The working face, toward the back run. */
  workingZ: -0.5,
  /** The seating face, toward the open room. */
  seatingZ: 2.5,
  height: ROOM.counterHeight,
  /** Openings along the island, in feet. */
  microwave: [0, 2] as const,
  wine: [2.5, 4.5] as const,
};

/**
 * Where each slot sits in the room.
 *
 * Placement is scene construction, not product data: it is derived from the run
 * segments above and is not something maintained in the Sheet. `data/slots.json`
 * carries the rest of each slot — label, cutout, cabinet configuration,
 * utilities — and the two are merged in `slots.ts`.
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
}

const islandMid = ([a, b]: readonly [number, number]) => (a + b) / 2;

export const SLOT_PLACEMENT: Record<SlotId, SlotPlacement> = {
  "slot-fridge": {
    position: [RUN.leftX, 0, islandMid(FRIDGE_OPENING)],
    rotationY: Math.PI / 2,
    mount: "wall",
  },
  "slot-range": {
    position: [mid(segment("back", "back-range")), 0, RUN.backZ],
    rotationY: 0,
    mount: "wall",
  },
  "slot-hood": {
    // The canopy's underside, 30" above the cooking surface: the gas minimum,
    // which is what a 36" counter plus a 30" clearance puts at 66".
    position: [
      mid(segment("back", "back-range")),
      ROOM.counterHeight + ft(CABINET_STANDARDS.hood.aboveCooktopMinIn),
      RUN.backZ,
    ],
    rotationY: 0,
    mount: "wall",
  },
  "slot-dishwasher": {
    position: [mid(segment("back", "back-dishwasher")), 0, RUN.backZ],
    rotationY: 0,
    mount: "wall",
  },
  "slot-microwave": {
    position: [islandMid(ISLAND.microwave), 0, ISLAND.workingZ + ROOM.counterDepth / 2],
    rotationY: Math.PI,
    mount: "island",
  },
  "slot-wine": {
    position: [islandMid(ISLAND.wine), 0, ISLAND.seatingZ - ROOM.counterDepth / 2],
    rotationY: 0,
    mount: "island",
  },
};

/** Fixtures sit on the runs the same way slots do, and are placed the same way. */
export const FIXTURE_PLACEMENT: Record<FixtureId, SlotPlacement> = {
  "fixture-sink": {
    position: [mid(segment("back", "back-sink")), 0, RUN.backZ],
    rotationY: 0,
    mount: "wall",
  },
};
