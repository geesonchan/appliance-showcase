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
  /** A tall cabinet is finished off with a short return, not left as a cliff. */
  tallReturnIn: { min: 24, max: 48 },
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

export interface RunSegment {
  id: string;
  kind: SegmentKind;
  /** Extent along the run's axis, in feet. */
  from: number;
  to: number;
  slot?: SlotId;
  fixture?: FixtureId;
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
}

/**
 * Scheme 01, laid out to the rules in docs/decisions.md D11.
 *
 * Read each run from its corner outward. The left run ends in the refrigerator
 * tower, with its 15" landing between the tower and the corner cabinet. The
 * back run puts 18" of counter either side of the range, then the sink with the
 * dishwasher immediately beside it, then counter to the open end.
 *
 * The corner square belongs to the left run, so the back run starts one
 * cabinet depth clear of the wall it meets.
 */
export const RUNS: CabinetRun[] = [
  {
    id: "left",
    axis: "z",
    centre: -ROOM.halfX + ROOM.counterDepth / 2,
    // 36 + 18 + 42 + 24 = 120", the short leg of the L.
    segments: [
      { id: "left-corner", kind: "corner", from: -6, to: -3 },
      // Rule 6: the refrigerator's landing, on its door side.
      { id: "left-fridge-landing", kind: "counter", from: -3, to: -1.5 },
      { id: "left-fridge", kind: "tall", from: -1.5, to: 2, slot: "slot-fridge" },
      // D13: a tower is finished off with a short return, not left as a cliff.
      { id: "left-return", kind: "counter", from: 2, to: 4 },
    ],
  },
  {
    id: "back",
    axis: "x",
    centre: -ROOM.halfZ + ROOM.counterDepth / 2,
    // 18 + 36 + 12 + 30 + 24 + 12 = 132", the long leg.
    segments: [
      { id: "back-range-landing-left", kind: "counter", from: -4, to: -2.5 },
      { id: "back-range", kind: "appliance", from: -2.5, to: 0.5, slot: "slot-range" },
      { id: "back-range-landing-right", kind: "counter", from: 0.5, to: 1.5 },
      { id: "back-sink", kind: "fixture", from: 1.5, to: 4, fixture: "fixture-sink" },
      // Rule 5: hard against the sink base, on the side away from the range.
      { id: "back-dishwasher", kind: "appliance", from: 4, to: 6, slot: "slot-dishwasher" },
      { id: "back-end", kind: "counter", from: 6, to: 7 },
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
