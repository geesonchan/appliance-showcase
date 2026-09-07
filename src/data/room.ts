import {
  DEFAULT_PARAMS,
  fridgeOpeningOf,
  generateLayout,
  type LayoutParams,
  type SlotPlacement,
} from "./layoutTemplate";
import { ft, type CabinetRun, type RunSegment } from "./roomShell";
import type { FixtureId, SlotId } from "../types";

export * from "./roomShell";
export { PARAM_LIMITS, DEFAULT_PARAMS } from "./layoutTemplate";
export type { LayoutParams, SlotPlacement, IslandLayout } from "./layoutTemplate";

/**
 * The room this page is showing.
 *
 * Scheme 01 is no longer written out by hand: it is what the L-with-island
 * template produces for a set of parameters. Step one of M3-3 takes those
 * parameters from the query string — `?island=96&fridge=back` — which is enough
 * to prove the generator without making every module constant reactive. Turning
 * the parameters into controls on screen is the next step, not this one.
 *
 * A set of parameters the template cannot build does not fall back silently:
 * the room reverts to the default and the reasons are kept for the interface to
 * say out loud.
 */
function readParams(): { params: LayoutParams; issues: string[] } {
  if (typeof window === "undefined") return { params: DEFAULT_PARAMS, issues: [] };

  const query = new URLSearchParams(window.location.search);
  const island = query.get("island");
  const fridge = query.get("fridge");

  if (island !== null && !Number.isFinite(Number(island))) {
    return { params: DEFAULT_PARAMS, issues: [`"${island}" is not a length.`] };
  }
  if (fridge !== null && fridge !== "left" && fridge !== "back") {
    return {
      params: DEFAULT_PARAMS,
      issues: [`The refrigerator goes at the left end or the back end, not "${fridge}".`],
    };
  }

  return {
    params: {
      islandLengthIn: island === null ? DEFAULT_PARAMS.islandLengthIn : Number(island),
      fridgeEnd: fridge === "back" ? "back" : DEFAULT_PARAMS.fridgeEnd,
    },
    issues: [],
  };
}

const requested = readParams();
const attempt = generateLayout(requested.params);
const fallback = generateLayout(DEFAULT_PARAMS);

if (!fallback.ok) {
  // The defaults are the one set of parameters that must always build.
  throw new Error(`the default layout is unbuildable: ${fallback.reasons.join(" ")}`);
}

/** What the template refused to build, and why. Empty when it built. */
export const LAYOUT_ISSUES: string[] =
  requested.issues.length > 0 || attempt.ok
    ? requested.issues
    : attempt.reasons;

export const LAYOUT = attempt.ok ? attempt.layout : fallback.layout;
export const LAYOUT_PARAMS = LAYOUT.params;

export const RUNS: CabinetRun[] = LAYOUT.runs;

export const RUN_BY_ID: Record<CabinetRun["id"], CabinetRun> = Object.fromEntries(
  RUNS.map((run) => [run.id, run]),
) as Record<CabinetRun["id"], CabinetRun>;

/** Centre lines of the two runs, kept as named values for the scene code. */
export const RUN = {
  backZ: RUN_BY_ID.back.centre,
  leftX: RUN_BY_ID.left.centre,
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
export const spanOf = (s: RunSegment) => s.to - s.from;

/**
 * The refrigerator opening, inset from its enclosure by one finished panel
 * each side.
 */
export const FRIDGE_OPENING = fridgeOpeningOf(LAYOUT);

/** Wall left clear above the range for the hood, 3" proud of it each side. */
export const HOOD_OPENING = (() => {
  const range = segmentForSlot("slot-range");
  if (!range) return [0, 0] as const;
  return [range.from - ft(3), range.to + ft(3)] as const;
})();

/**
 * The island: 36" deep at standard counter height, as long as the parameters
 * ask for, standing clear of both perimeter runs.
 *
 * The two openings face opposite ways, and that is deliberate. The microwave
 * drawer opens toward the perimeter, where the cook stands. The wine cabinet
 * opens toward the seating side, where the person pouring stands — and, not by
 * accident, toward the camera, so the overview shows a glass door rather than a
 * blank cabinet end. See docs/decisions.md D5.
 */
export const ISLAND = LAYOUT.island;

export const SLOT_PLACEMENT: Record<SlotId, SlotPlacement> = LAYOUT.slots;
export const FIXTURE_PLACEMENT: Record<FixtureId, SlotPlacement> = LAYOUT.fixtures;
