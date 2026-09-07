import roughInFile from "../../data/rough-in.json";
import { applianceBox } from "./applianceBox";
import { hoodBridgeBand } from "./cabinets";
import { ROOM, RUNS, ft, type CabinetRun, type RunSegment } from "./room";
import { parseDataFile, roughInFileSchema, type RoughInPoint } from "./schema";
import { SLOT_BY_ID } from "./slots";
import type { Appliance, Slot, SlotId } from "../types";

/**
 * Where each model's connections actually land.
 *
 * The install view used to draw every service at one height for the whole room,
 * which is right for the trunk running along the wall and wrong for the last
 * three feet of it. A microwave drawer's outlet is on the back wall of its own
 * opening, 4" in and 14-5/8" up; a dishwasher's power, water and drain are all
 * in the *sink* cabinet, not its own. Those are the numbers an installer needs,
 * and they come off each model's drawing rather than from a rule.
 *
 * A model with no entry falls back to the generic heights and says so.
 */
const parsed = parseDataFile(roughInFileSchema, roughInFile, "data/rough-in.json");

export const ROUGH_IN = parsed.roughIn;

export const roughInFor = (appliance: Appliance | undefined) =>
  appliance ? (ROUGH_IN[appliance.id] ?? null) : null;

/** True when nobody has read this model's drawing yet. */
export const hasGenericRoughIn = (appliance: Appliance | undefined) =>
  roughInFor(appliance) === null;

export interface ResolvedPoint {
  point: RoughInPoint;
  /** Centre of the fitting, in world feet. */
  position: [number, number, number];
  /** Its extents in feet, so a bracket reads as a bracket. */
  size: [number, number, number];
  /** The box it sits in, for the check that it is actually inside one. */
  host: { id: string; min: [number, number, number]; max: [number, number, number] };
  /** A drain's high loop, when it has one, in world feet. */
  highLoopY: number | null;
}

/** A box in world space, as min/max corners. */
interface HostBox {
  id: string;
  run: CabinetRun;
  /** Extent along the run, in feet. */
  along: readonly [number, number];
  /** Floor and ceiling of the box, in feet. */
  band: readonly [number, number];
}

const segmentsOf = (run: CabinetRun) => run.segments;

function locate(slotId: SlotId): { run: CabinetRun; index: number } | null {
  for (const run of RUNS) {
    const index = segmentsOf(run).findIndex((s) => s.slot === slotId);
    if (index >= 0) return { run, index };
  }
  return null;
}

/**
 * The box a point sits in.
 *
 * `in-cutout` is the appliance's own opening; the others are a neighbour's
 * carcass, which is the whole point of recording the location — a dishwasher's
 * connections are in the sink base and drawing them in the dishwasher's own
 * opening would be a lie an installer would find on site.
 */
function hostFor(slot: Slot, appliance: Appliance, point: RoughInPoint): HostBox | null {
  const found = locate(slot.id);

  if (point.location === "above-cabinet") {
    // A hood has no base segment; the box above it is a bank of wall cabinets.
    for (const run of RUNS) {
      const bank = run.uppers.find((b) => b.modules.some((m) => m.slot === slot.id));
      if (!bank) continue;
      const [floor, top] = bank.band ?? hoodBridgeBand();
      return { id: bank.id, run, along: [bank.from, bank.to] as const, band: [floor, top] as const };
    }
    return null;
  }

  if (!found && point.location !== "in-cutout") return null;

  if (point.location === "in-cutout") {
    const box = applianceBox(slot, appliance);
    const segment = found?.run.segments[found.index];
    const centre = slot.position[found?.run.axis === "z" ? 2 : 0];
    const along = segment
      ? ([segment.from, segment.to] as const)
      : ([centre - box.w / 2, centre + box.w / 2] as const);
    return {
      id: `${slot.id}-opening`,
      run: found?.run ?? RUNS[0],
      along,
      band: [box.y, box.y + box.h] as const,
    };
  }

  if (point.location === "under-sink") {
    for (const run of RUNS) {
      const sink = run.segments.find((s) => s.fixture === "fixture-sink");
      if (sink) {
        return {
          id: sink.id,
          run,
          along: [sink.from, sink.to] as const,
          band: [0, ROOM.counterHeight - ROOM.counterThickness] as const,
        };
      }
    }
    return null;
  }

  // A neighbour on the same run. "Left" and "right" are read along the run from
  // the corner outward, which is the order the segments are already in.
  const step = point.location === "adjacent-cabinet-left" ? -1 : 1;
  const neighbour = pickNeighbour(found!.run.segments, found!.index, step);
  if (!neighbour) return null;
  return {
    id: neighbour.id,
    run: found!.run,
    along: [neighbour.from, neighbour.to] as const,
    band: [0, ROOM.counterHeight - ROOM.counterThickness] as const,
  };
}

/** The nearest carcass on one side; an opening is not somewhere to put a valve. */
function pickNeighbour(segments: RunSegment[], index: number, step: -1 | 1) {
  for (let i = index + step; i >= 0 && i < segments.length; i += step) {
    if (segments[i].kind !== "appliance") return segments[i];
  }
  // Nothing that way: take the other side rather than dropping the connection.
  for (let i = index - step; i >= 0 && i < segments.length; i -= step) {
    if (segments[i].kind !== "appliance") return segments[i];
  }
  return null;
}

const DEFAULT_SIZE: [number, number, number] = [3, 3, 1.5];

/** Resolve one model's points into world space. */
export function resolveRoughIn(slotId: SlotId, appliance: Appliance | undefined): ResolvedPoint[] {
  const entry = roughInFor(appliance);
  if (!entry || !appliance) return [];
  const slot = SLOT_BY_ID[slotId];

  const resolved: ResolvedPoint[] = [];
  for (const point of entry.points) {
    const host = hostFor(slot, appliance, point);
    if (!host) continue;

    const size = (point.size ?? DEFAULT_SIZE).map(ft) as [number, number, number];
    const along =
      point.x === "left"
        ? host.along[0] + size[0] / 2
        : point.x === "right"
          ? host.along[1] - size[0] / 2
          : point.x === "center"
            ? (host.along[0] + host.along[1]) / 2
            : host.along[0] + ft(point.x);

    const y =
      point.y === "bottom"
        ? host.band[0] + size[1] / 2
        : point.y === "top"
          ? host.band[1] - size[1] / 2
          : point.y === "center"
            ? (host.band[0] + host.band[1]) / 2
            : host.band[0] + ft(point.y);

    // Rear means against the wall the run stands on.
    const across =
      point.z === "rear"
        ? host.run.centre - ROOM.counterDepth / 2 + size[2] / 2
        : host.run.centre + ROOM.counterDepth / 2 - size[2] / 2;

    const position: [number, number, number] =
      host.run.axis === "x" ? [along, y, across] : [across, y, along];

    const min: [number, number, number] =
      host.run.axis === "x"
        ? [host.along[0], host.band[0], host.run.centre - ROOM.counterDepth / 2]
        : [host.run.centre - ROOM.counterDepth / 2, host.band[0], host.along[0]];
    const max: [number, number, number] =
      host.run.axis === "x"
        ? [host.along[1], host.band[1], host.run.centre + ROOM.counterDepth / 2]
        : [host.run.centre + ROOM.counterDepth / 2, host.band[1], host.along[1]];

    resolved.push({
      point,
      position,
      size,
      host: { id: host.id, min, max },
      highLoopY: point.highLoopApexIn === null ? null : ft(point.highLoopApexIn),
    });
  }
  return resolved;
}

/** Inches as a manual writes them, for the checklist line. */
const inch = (value: number) => {
  const whole = Math.floor(value + 1e-6);
  const sixteenths = Math.round((value - whole) * 16);
  if (sixteenths === 0) return `${whole}"`;
  let n = sixteenths;
  let d = 16;
  while (n % 2 === 0) {
    n /= 2;
    d /= 2;
  }
  return `${whole}-${n}/${d}"`;
};

/**
 * One line per connection, in the terms an installer would repeat back.
 *
 * The numbers are the ones off the drawing; the words say which box they are
 * measured in, because "4 inches from the side" means nothing without it.
 */
export function roughInSentence(point: RoughInPoint): { where: string; at: string } {
  const where =
    point.location === "in-cutout"
      ? point.z === "rear"
        ? "rear wall of the opening"
        : "front of the opening"
      : point.location === "under-sink"
        ? "inside the sink base"
        : point.location === "above-cabinet"
          ? "in the cabinet above"
          : point.location === "adjacent-cabinet-left"
            ? "in the cabinet to the left"
            : "in the cabinet to the right";

  const parts: string[] = [];
  if (typeof point.x === "number") parts.push(`${inch(point.x)} from the left side`);
  else if (point.x !== "center") parts.push(`at the ${point.x}`);
  if (typeof point.y === "number") parts.push(`${inch(point.y)} up`);
  else parts.push(`at the ${point.y}`);

  return { where, at: parts.join(", ") };
}
