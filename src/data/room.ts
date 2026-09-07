import {
  DEFAULT_PARAMS,
  fridgeOpeningOf,
  generateLayout,
  type GeneratedLayout,
  type LayoutParams,
  type Refusal,
  type SlotPlacement,
} from "./layoutTemplate";
import { setRoomSize, type CabinetRun, type RunSegment } from "./roomShell";
import type { FixtureId, SlotId } from "../types";

export * from "./roomShell";
export { PARAM_LIMITS, DEFAULT_PARAMS } from "./layoutTemplate";
export type {
  LayoutParams,
  Refusal,
  RequirementItem,
  SlotPlacement,
  IslandLayout,
  WallRequirement,
} from "./layoutTemplate";
export { feasibleRange, wallRequirement, generateLayout } from "./layoutTemplate";

/**
 * The room this page is showing.
 *
 * Scheme 01 is no longer written out by hand: it is what the L-with-island
 * template produces for a set of parameters. Those parameters are now changed
 * on screen while the page is running, so nothing here can be a constant —
 * every export is a live binding that `applyLayout` reassigns, and the modules
 * derived from them (slots, fixtures, cabinets) have rebuild functions of their
 * own that `layoutState.ts` calls in order.
 *
 * Live bindings rather than a context or a store because this is not interface
 * state: it is the room. Half the code that reads it is geometry that runs
 * inside the render loop, and threading a hook through all of it would make
 * every one of those files know about React.
 */

/** What the parameters asked for, which is not always what could be built. */
export let REQUESTED_PARAMS: LayoutParams = DEFAULT_PARAMS;

/** What the template refused to build, and why. Empty when it built. */
export let LAYOUT_ISSUES: Refusal[] = [];

export let LAYOUT: GeneratedLayout;
export let LAYOUT_PARAMS: LayoutParams;
export let RUNS: CabinetRun[];
export let RUN_BY_ID: Record<CabinetRun["id"], CabinetRun>;

/** Centre lines of the two runs, kept as named values for the scene code. */
export let RUN: { backZ: number; leftX: number };

/**
 * The refrigerator opening, inset from its enclosure by one finished panel
 * each side.
 */
export let FRIDGE_OPENING: readonly [number, number];

/**
 * Wall left clear above the range for the canopy.
 *
 * The canopy's own width, which is the range's: the wall cabinets come right up
 * to its flanks on both sides. See docs/decisions.md D13.
 */
export let HOOD_OPENING: readonly [number, number];

/**
 * The island: as long and as deep as the parameters ask for, standing clear of
 * both perimeter runs.
 *
 * The two openings face opposite ways, and that is deliberate. The microwave
 * drawer opens toward the perimeter, where the cook stands. The wine cabinet
 * opens toward the seating side, where the person pouring stands — and, not by
 * accident, toward the camera, so the overview shows a glass door rather than a
 * blank cabinet end. See docs/decisions.md D5.
 */
export let ISLAND: GeneratedLayout["island"];

export let SLOT_PLACEMENT: Record<SlotId, SlotPlacement>;
export let FIXTURE_PLACEMENT: Record<FixtureId, SlotPlacement>;

/** Install a generated layout as the room. Everything derived follows. */
export function applyLayout(layout: GeneratedLayout, requested: LayoutParams, issues: Refusal[]) {
  LAYOUT = layout;
  LAYOUT_PARAMS = layout.params;
  // The shell follows the walls the layout was generated for, so the room, the
  // camera framing and the plan cannot disagree about how big the kitchen is.
  setRoomSize(layout.params.backWallIn, layout.params.leftWallIn);
  REQUESTED_PARAMS = requested;
  LAYOUT_ISSUES = issues;

  RUNS = layout.runs;
  RUN_BY_ID = Object.fromEntries(RUNS.map((run) => [run.id, run])) as Record<
    CabinetRun["id"],
    CabinetRun
  >;
  RUN = { backZ: RUN_BY_ID.back.centre, leftX: RUN_BY_ID.left.centre };

  FRIDGE_OPENING = fridgeOpeningOf(layout);
  const range = segmentForSlot("slot-range");
  HOOD_OPENING = range ? ([range.from, range.to] as const) : ([0, 0] as const);

  ISLAND = layout.island;
  SLOT_PLACEMENT = layout.slots;
  FIXTURE_PLACEMENT = layout.fixtures;
}

/** The segment carrying a slot, wherever it is. */
export function segmentForSlot(slotId: SlotId): RunSegment | undefined {
  for (const run of RUNS) {
    const found = run.segments.find((s) => s.slot === slotId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Which stretch of cabinetry a slot stands in.
 *
 * The cabinetry around an appliance is finished with the run it belongs to, so
 * anything drawn as joinery beside an appliance has to be able to ask this. An
 * island slot is on the island; everything else is on the leg carrying it.
 */
export function runForSlot(slotId: SlotId): "left" | "back" | "island" {
  if (SLOT_PLACEMENT[slotId]?.mount === "island") return "island";
  for (const run of RUNS) {
    if (run.segments.some((segment) => segment.slot === slotId)) return run.id;
  }
  return "back";
}

export const extent = (s: RunSegment) => [s.from, s.to] as const;
export const spanOf = (s: RunSegment) => s.to - s.from;

/**
 * The starting parameters, from the query string.
 *
 * Every parameter has a name there — `?island=96&fridge=back&corner=blind` —
 * because a link is a reproducible room where a slider drag is not, and the
 * screenshot runs need to ask for a particular kitchen without clicking.
 */
function readParams(): { params: LayoutParams; issues: Refusal[] } {
  if (typeof window === "undefined") return { params: DEFAULT_PARAMS, issues: [] };

  const query = new URLSearchParams(window.location.search);
  const issues: Refusal[] = [];
  const params = { ...DEFAULT_PARAMS };

  const number = (name: string, key: "backWallIn" | "leftWallIn" | "islandLengthIn" | "islandDepthIn" | "aisleIn") => {
    const raw = query.get(name);
    if (raw === null) return;
    if (!Number.isFinite(Number(raw))) issues.push({ key: "refusal.notALength", vars: { raw } });
    else params[key] = Number(raw);
  };
  const choice = <K extends "fridgeEnd" | "sinkLeg" | "cornerType">(
    name: string,
    key: K,
    allowed: readonly LayoutParams[K][],
  ) => {
    const raw = query.get(name) as LayoutParams[K] | null;
    if (raw === null) return;
    if (!allowed.includes(raw))
      issues.push({ key: "refusal.notAChoice", vars: { raw, allowed: allowed.join(", ") } });
    else params[key] = raw;
  };

  number("back", "backWallIn");
  number("left", "leftWallIn");
  number("island", "islandLengthIn");
  number("islandDepth", "islandDepthIn");
  number("aisle", "aisleIn");
  choice("fridge", "fridgeEnd", ["left", "back"]);
  choice("sink", "sinkLeg", ["left", "back"]);
  choice("corner", "cornerType", ["lazy-susan", "blind"]);
  if (query.get("island") === "none") {
    params.hasIsland = false;
    params.islandLengthIn = DEFAULT_PARAMS.islandLengthIn;
    issues.length = 0;
  }

  return issues.length > 0 ? { params: DEFAULT_PARAMS, issues } : { params, issues: [] };
}

const requested = readParams();
const attempt = generateLayout(requested.params);
const fallback = generateLayout(DEFAULT_PARAMS);

if (!fallback.ok) {
  // The defaults are the one set of parameters that must always build.
  throw new Error(`the default layout is unbuildable: ${fallback.reasons.join(" ")}`);
}

applyLayout(
  attempt.ok ? attempt.layout : fallback.layout,
  requested.params,
  requested.issues.length > 0 || attempt.ok ? requested.issues : attempt.reasons,
);
