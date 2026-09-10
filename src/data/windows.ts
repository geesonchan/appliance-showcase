import { ROOM, ft, type RunSegment } from "./roomShell";

/**
 * A window in one of the room's two walls.
 *
 * A kitchen with no window is a showroom bay, and this room is meant to read
 * as somebody's. It is also a constraint before it is a mood: nothing hangs in
 * front of a window, the sink goes under it because that is where people put
 * it, and the sill has to clear the worktop or the tap has nowhere to go. So
 * it is a layout parameter and it is checked like one. See docs/decisions.md
 * D11 rule 13.
 */
export interface WindowOpening {
  wall: "back" | "left";
  /**
   * Where its middle is along that wall, in inches from the room's own middle
   * — the same x for the back wall and z for the left one that everything else
   * is measured in.
   *
   * Null means "over the sink", which is what the default is and what most
   * kitchens are: the window is a fact of the building and the sink is put
   * under it. Where the sink is on the other leg, a null window centres itself
   * on the wall and takes its chances with the rules below.
   */
  centerIn: number | null;
  widthIn: number;
  /** Off the floor to the underside of the opening. */
  sillIn: number;
  heightIn: number;
}

/** A window with its place on the wall worked out, in feet. */
export interface ResolvedWindow extends WindowOpening {
  /** Along the wall, in the frame a run's segments are in. */
  along: readonly [number, number];
  /** Sill and head, off the floor. */
  band: readonly [number, number];
}

/**
 * How a window is built, in inches.
 *
 * A cased opening rather than a manufacturer's unit: what a showroom drawing
 * shows is the frame round the hole, the stone sill inside it, and the glass.
 * Nothing here is a product — it is joinery, and these are the figures a
 * joiner works to.
 */
export const WINDOW = {
  /** The frame round the opening, seen from the room. */
  frameIn: 4,
  /** The frame's own thickness, standing off the wall. */
  frameProudIn: 1.5,
  /** The stone sill inside the opening: how far it reaches into the room. */
  innerSillIn: 4,
  innerSillThickIn: 1.5,
  /** The glass, set back inside the reveal. */
  glassBackIn: 2.5,
  /**
   * How far the sill has to clear the worktop.
   *
   * Two inches. A window sill level with the stone is a sill you cannot wipe
   * under and a tap you cannot stand in front of, and the fabricator needs
   * somewhere to land the backsplash.
   */
  aboveCounterIn: 2,
  /**
   * How far the sink's middle may sit from the window's.
   *
   * Six inches, which is one cabinet step and a half. Nobody notices that
   * much; a foot reads as a mistake in a photograph.
   */
  sinkOffsetIn: 6,
};

/** The default: one window over the sink, 36" wide with its sill 6" over the stone. */
export const DEFAULT_WINDOW: WindowOpening = {
  wall: "back",
  centerIn: null,
  widthIn: 36,
  sillIn: 42,
  heightIn: 48,
};

/** The middle of a segment, along the run. */
const mid = (segment: RunSegment) => (segment.from + segment.to) / 2;

/**
 * Which wall a window is in.
 *
 * Its own, unless it has no figure of its own — a window that is defined as
 * being over the sink is on whichever wall the sink is on, and moving the sink
 * to the other leg moves it. That is what a customer means by "the window over
 * the sink", and it is why the default needs no figures at all.
 */
export const wallFor = (window: WindowOpening, sinkLeg: "left" | "back") =>
  window.centerIn === null ? sinkLeg : window.wall;

/**
 * Where a window actually lands on its wall.
 *
 * `centerIn` where the parameter names one, and over the sink where it does
 * not — `wallFor` has already put a window with no figure of its own on the
 * wall the sink is on, so "the sink is not on this leg" is a case that only
 * arises in a room without one. Nothing here decides whether the place is
 * allowed: `windowRefusals` does, and that is a separate question from where
 * the parameter puts it.
 */
export function resolveWindow(window: WindowOpening, segments: RunSegment[]): ResolvedWindow {
  const sink = segments.find((segment) => segment.fixture === "fixture-sink");
  const half = ft(window.widthIn) / 2;
  const centre =
    window.centerIn !== null ? ft(window.centerIn) : sink ? mid(sink) : middleOf(segments);
  return {
    ...window,
    along: [centre - half, centre + half] as const,
    band: [ft(window.sillIn), ft(window.sillIn + window.heightIn)] as const,
  };
}

/** The middle of a leg's run, for a window with nothing to sit over. */
function middleOf(segments: RunSegment[]): number {
  if (segments.length === 0) return 0;
  return (segments[0].from + segments[segments.length - 1].to) / 2;
}

/**
 * What a window may not stand in front of, on its own wall.
 *
 * A tall unit and a hood housing are both floor-to-ceiling joinery, and a
 * window behind either is a window nobody will ever see: the opening is real,
 * the wall is cut, and a cabinet is screwed over it. That is a refusal rather
 * than something to draw.
 */
export function blockedBy(
  window: ResolvedWindow,
  segments: RunSegment[],
  hood: readonly [number, number] | null,
): { key: string; from: number; to: number } | null {
  const overlaps = (from: number, to: number) =>
    Math.min(window.along[1], to) - Math.max(window.along[0], from) > 1e-6;

  for (const segment of segments) {
    if (segment.kind !== "tall") continue;
    if (overlaps(segment.from, segment.to)) {
      return { key: segment.slot ?? "tall", from: segment.from, to: segment.to };
    }
  }
  // The housing over a cooking surface, which is the other thing on that wall
  // that goes to the ceiling. Its own span rather than the range's: a 42"
  // breast over a 36" machine is wider than what is under it.
  if (hood && overlaps(hood[0], hood[1])) {
    return { key: "slot-hood", from: hood[0], to: hood[1] };
  }
  return null;
}

/** The sill a window may not go under: the worktop, plus somewhere to wipe. */
export const lowestSillIn = () => ROOM.counterHeight * 12 + WINDOW.aboveCounterIn;

/**
 * The stretches of a wall a window takes out of it, for the banks.
 *
 * A wall cabinet in front of a window is the same mistake as a tower in front
 * of one, and it is the commoner of the two: a bank is laid out along a whole
 * leg, and the window is in the middle of it. So the bank breaks at the
 * window, and what is either side of the opening is finished as an end.
 */
export const cutsFor = (windows: ResolvedWindow[], wall: "back" | "left") =>
  windows
    .filter((window) => window.wall === wall)
    .map((window) => ({ from: window.along[0], to: window.along[1], hood: false }));
