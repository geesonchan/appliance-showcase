import appliancesFile from "../../data/appliances.json";
import roughInFile from "../../data/rough-in.json";
import { applianceBox } from "./applianceBox";
import { hoodBridgeBand } from "./cabinets";
import { ROOM, RUNS, carries, ft, type CabinetRun, type RunSegment } from "./room";
import { parseDataFile, roughInFileSchema, type RoughInPoint } from "./schema";
import { SLOT_BY_ID } from "./slots";
import {
  alongIsToTheRight,
  axisIndex,
  facingOf,
  onAxis,
  sizeOnPlan,
  stripFacing,
  toPlan,
  type Facing,
} from "./frame";
import type { Appliance, Slot, SlotId } from "../types";

/**
 * Where each model's connections actually land.
 *
 * The install view used to draw every service at one height for the whole room,
 * which is right for the trunk running along the wall and wrong for the last
 * three feet of it. A microwave drawer's outlet is on the back wall of its own
 * opening, 4" in and 14-5/8" up; a dishwasher's power, water and drain are all
 * in the *sink* cabinet, not its own. Those are the numbers an installer needs,
 * and they come from each model's own entry rather than from a rule — each
 * point saying whether off a drawing, from site practice, or inferred (D21).
 *
 * A model with no entry falls back to the generic heights and says so.
 */
const parsed = parseDataFile(roughInFileSchema, roughInFile, "data/rough-in.json");

export const ROUGH_IN = parsed.roughIn;

/**
 * Keys in `data/rough-in.json` that name no model in the catalogue.
 *
 * A misspelt key is never used and never says so: package B's insert hood was
 * entered as `thermador-vcin36ws` against the catalogue's `thermador-vcin36gws`,
 * and B's hood drew no rough-in point at all. So the file refuses to load with
 * one. Round 43.
 */
export function orphanRoughInKeys(keys: string[], catalogueIds: Iterable<string>): string[] {
  const known = new Set(catalogueIds);
  return keys.filter((key) => !known.has(key));
}

const ORPHANS = orphanRoughInKeys(
  Object.keys(ROUGH_IN),
  (appliancesFile as { appliances: { id: string }[] }).appliances.map((appliance) => appliance.id),
);
if (ORPHANS.length > 0) {
  throw new Error(`data/rough-in.json has entries for models not in the catalogue: ${ORPHANS.join(", ")}`);
}

/**
 * The three ways a connection is drawn (D21, round 41), one meaning each.
 * `confirmed`: off a drawing — a solid fitting in the service's colour.
 * `unconfirmed`: reviewed, but site practice, an inference or a figure the
 * drawing leaves unclear — a grey dashed outline. `unreviewed`: nobody has
 * classified it — a faint thin grey line, weaker than a dashed one, which is
 * also how every generic run along the walls is drawn.
 */
export type LineTier = "confirmed" | "unconfirmed" | "unreviewed";

export const lineTier = (point: RoughInPoint): LineTier =>
  point.provenance === null ? "unreviewed" : point.provenance === "drawing" ? "confirmed" : "unconfirmed";

/** The callout for a connection, which says where its figures come from. */
export const roughInCalloutKey = (point: RoughInPoint) =>
  `roughIn.callout.${point.provenance ?? "unreviewed"}`;

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
  /**
   * The box it sits in, for the check that it is actually inside one, and which
   * way that box faces — the side a leader line leaves it by.
   */
  host: { id: string; min: [number, number, number]; max: [number, number, number]; facing: Facing };
  /**
   * Left and right as an installer says them, standing facing the box: which
   * side a figure across it is measured from, and which side of the machine the
   * neighbouring cabinet is on (null where the point is not in one).
   *
   * Worked out once, where the point is placed, and read by the sentence — so
   * what the list says and what the room draws are one derivation, not two.
   * Round 70: they were two, and on the left run the drawing measured from the
   * corner end, which faces the installer's right, while the sentence said left.
   */
  sides: { measuredFrom: Side; cabinet: Side | null };
  /** A drain's high loop, when it has one, in world feet. */
  highLoopY: number | null;
}

/** An installer's left or right, facing the box. */
export type Side = "left" | "right";

/**
 * Where a point's leader line ends: 4" out of the face its host opens by, so
 * the point can be seen and clicked through a wireframe.
 *
 * Round 50 (D22 step 2). This used to guess the face from the host's
 * proportions and always leave by its +x or +z side, so every point in an
 * island opening facing the runs ran its leader back into the island.
 */
export function leaderEnd(resolved: ResolvedPoint): [number, number, number] {
  const end = [...resolved.position] as [number, number, number];
  const { facing, min, max } = resolved.host;
  const index = axisIndex(facing.axis);
  end[index] = facing.sign > 0 ? max[index] + ft(4) : min[index] - ft(4);
  return end;
}

/** A box in world space, as min/max corners. */
interface HostBox {
  id: string;
  run: CabinetRun;
  /** Extent along the run, in feet. */
  along: readonly [number, number];
  /** Floor and ceiling of the box, in feet. */
  band: readonly [number, number];
  /** For the cabinet beside a tower: which end of `along` meets the tower. */
  nearEnd?: 0 | 1;
  /** For a neighbour's cabinet: which way along the run it lies from the machine. */
  step?: -1 | 1;
  /**
   * For an opening on no wall run — an island slot — the opening's own frame:
   * `along` and `band` are then local, across the face from its left edge and
   * up, and the point is turned with the slot. `run` is not read. Round 43.
   */
  frame?: { origin: readonly [number, number]; rotationY: number; depth: number };
}

const segmentsOf = (run: CabinetRun) => run.segments;

function locate(slotId: SlotId): { run: CabinetRun; index: number } | null {
  for (const run of RUNS) {
    const index = segmentsOf(run).findIndex((s) => carries(s, slotId));
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
    const band = [box.y, box.y + box.h] as const;
    // An island slot stands on no wall run, so its opening is measured in its
    // own frame and turned with the island. It used to borrow the first wall
    // run instead, which drew MD24BS's outlet and anti-tip block on the left
    // wall beside the refrigerator. Round 43.
    if (!found) {
      const halfW = ft(slot.cutout.w) / 2;
      return {
        id: `${slot.id}-opening`,
        run: RUNS[0],
        along: [-halfW, halfW] as const,
        band,
        frame: {
          origin: [slot.position[0], slot.position[2]] as const,
          rotationY: slot.rotationY,
          depth: ft(slot.cutout.d),
        },
      };
    }
    const segment = found.run.segments[found.index];
    return {
      id: `${slot.id}-opening`,
      run: found.run,
      along: [segment.from, segment.to] as const,
      band,
    };
  }

  // A dishwasher that is not beside the sink cannot borrow the sink base: the
  // second one, under the coffee machine, has its services brought to the base
  // cabinet beside its own tower. D11 rule 14.
  if (point.location === "under-sink" && slot.id !== "slot-dishwasher" && found) {
    const segments = found.run.segments;
    for (let reach = 1; reach < segments.length; reach += 1) {
      for (const at of [found.index + reach, found.index - reach]) {
        const neighbour = segments[at];
        if (neighbour?.kind !== "counter") continue;
        return {
          id: neighbour.id,
          run: found.run,
          along: [neighbour.from, neighbour.to] as const,
          band: [0, ROOM.counterHeight - ROOM.counterThickness] as const,
        };
      }
    }
    return null;
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

  // The base cabinet beside a tower. Not behind the machine: both ovens' own
  // sheets put the junction box above, beside or below the unit, and a box in
  // the cabinet next to it is one an electrician reaches by opening a door.
  // Whichever side has a cabinet; where both do, the side toward the cooking
  // surface, which is the landing. A tall board beside the tower is part of it.
  if (point.location === "beside-tower") {
    if (!found) return null;
    const segments = found.run.segments;
    const reach = (step: -1 | 1): number | null => {
      for (let i = found.index + step; i >= 0 && i < segments.length; i += step) {
        const segment = segments[i];
        if (segment.kind === "counter") return i;
        const board = segment.kind === "tall" && segment.modules.every((m) => m.kind === "panel");
        if (!board) return null;
      }
      return null;
    };
    const sides = ([-1, 1] as const).flatMap((step) => {
      const at = reach(step);
      return at === null ? [] : [{ step, at }];
    });
    if (sides.length === 0) return null;
    const rangeAt = segments.findIndex((s) => s.slot === "slot-range");
    const towardRange = rangeAt >= 0 ? Math.sign(rangeAt - found.index) : 0;
    const side = sides.find((s) => s.step === towardRange) ?? sides[0];
    const cabinet = segments[side.at];
    return {
      id: cabinet.id,
      run: found.run,
      along: [cabinet.from, cabinet.to] as const,
      band: [0, ROOM.counterHeight - ROOM.counterThickness] as const,
      // The end of the cabinet that meets the tower.
      nearEnd: side.step === 1 ? 0 : 1,
    };
  }

  // A neighbour on the same run, on the installer's left or right. Round 70:
  // this used to read "right" as further from the corner, which is the
  // installer's right on the back run and their left on the left run.
  const toRight = alongIsToTheRight(found!.run.axis) ? 1 : -1;
  const step = point.location === "adjacent-cabinet-left" ? -toRight : toRight;
  const neighbour = pickNeighbour(found!.run.segments, found!.index, step as -1 | 1);
  if (!neighbour) return null;
  return {
    id: neighbour.segment.id,
    run: found!.run,
    along: [neighbour.segment.from, neighbour.segment.to] as const,
    band: [0, ROOM.counterHeight - ROOM.counterThickness] as const,
    step: neighbour.step,
  };
}

/** The nearest carcass on one side; an opening is not somewhere to put a valve. */
function pickNeighbour(
  segments: RunSegment[],
  index: number,
  step: -1 | 1,
): { segment: RunSegment; step: -1 | 1 } | null {
  for (let i = index + step; i >= 0 && i < segments.length; i += step) {
    if (segments[i].kind !== "appliance") return { segment: segments[i], step };
  }
  // Nothing that way: take the other side rather than dropping the connection.
  const back = -step as -1 | 1;
  for (let i = index + back; i >= 0 && i < segments.length; i += back) {
    if (segments[i].kind !== "appliance") return { segment: segments[i], step: back };
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

    // Left and right as the installer facing the box says them. Along a run
    // that is `frame.ts`'s answer: further along is their right on the back
    // run and their left on the left run. An island opening is measured in the
    // machine's own frame, whose +x is the right of somebody facing it.
    const toRight = host.frame ? 1 : alongIsToTheRight(host.run.axis) ? 1 : -1;
    const endOn = (side: Side) => ((side === "left") === toRight > 0 ? host.along[0] : host.along[1]);
    const inward = (side: Side) => (side === "left" ? toRight : -toRight);
    const sideOf = (step: -1 | 1): Side => (step === toRight ? "right" : "left");

    // In the machine's own opening, or the sink base, the figure is from the
    // left side panel, as a manual dimensions it. In a neighbour's cabinet or
    // the one beside a tower it is from the side that meets the machine — the
    // installer's left or right depending on which side of the machine that
    // cabinet stands (round 70; see schema.ts).
    const cabinet: Side | null = host.step === undefined ? null : sideOf(host.step);
    const measuredFrom: Side =
      host.nearEnd !== undefined
        ? sideOf(host.nearEnd === 0 ? -1 : 1)
        : cabinet !== null
          ? cabinet === "right"
            ? "left"
            : "right"
          : "left";

    const along =
      point.x === "center"
        ? (host.along[0] + host.along[1]) / 2
        : point.x === "left" || point.x === "right"
          ? endOn(point.x) + (inward(point.x) * size[0]) / 2
          : endOn(measuredFrom) + inward(measuredFrom) * ft(point.x);
    const sides = { measuredFrom, cabinet };

    const y =
      point.y === "bottom"
        ? host.band[0] + size[1] / 2
        : point.y === "top"
          ? host.band[1] - size[1] / 2
          : point.y === "center"
            ? (host.band[0] + host.band[1]) / 2
            : host.band[0] + ft(point.y);

    // An island opening: local across-the-face and back-from-the-face, turned
    // the way the slot is turned (the same frame the pins use: +Z out of the
    // face, rotated about Y).
    if (host.frame) {
      const { origin, rotationY, depth } = host.frame;
      const turned = { position: [origin[0], 0, origin[1]], rotationY };
      const turn = (lx: number, lz: number): [number, number] => toPlan(turned, lx, lz);
      const localZ = point.z === "rear" ? -depth / 2 + size[2] / 2 : depth / 2 - size[2] / 2;
      const [px, pz] = turn(along, localZ);
      const corners = [
        turn(host.along[0], -depth / 2),
        turn(host.along[1], -depth / 2),
        turn(host.along[0], depth / 2),
        turn(host.along[1], depth / 2),
      ];
      const xs = corners.map((c) => c[0]);
      const zs = corners.map((c) => c[1]);
      // A quarter turn swaps which world axis the fitting's width lies along.
      const [sizeX, sizeZ] = sizeOnPlan(rotationY, size[0], size[2]);
      resolved.push({
        point,
        position: [px, y, pz],
        size: [sizeX, size[1], sizeZ],
        host: {
          id: host.id,
          min: [Math.min(...xs), host.band[0], Math.min(...zs)],
          max: [Math.max(...xs), host.band[1], Math.max(...zs)],
          facing: facingOf(rotationY),
        },
        sides,
        highLoopY: point.highLoopApexIn === null ? null : ft(point.highLoopApexIn),
      });
      continue;
    }

    // Rear means against the wall the run stands on.
    const across =
      point.z === "rear"
        ? host.run.centre - ROOM.counterDepth / 2 + size[2] / 2
        : host.run.centre + ROOM.counterDepth / 2 - size[2] / 2;

    const position = onAxis(host.run.axis, along, across, y);
    const min = onAxis(host.run.axis, host.along[0], host.run.centre - ROOM.counterDepth / 2, host.band[0]);
    const max = onAxis(host.run.axis, host.along[1], host.run.centre + ROOM.counterDepth / 2, host.band[1]);

    resolved.push({
      point,
      position,
      size,
      // A run's cabinetry opens to the room.
      host: { id: host.id, min, max, facing: stripFacing(host.run.axis, 1) },
      sides,
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
 *
 * Left and right are the ones the point was placed by (`sides`), never worked
 * out again here (round 70).
 */
export function roughInSentence(resolved: ResolvedPoint): { where: string; at: string } {
  const { point, sides } = resolved;
  const where =
    point.location === "in-cutout"
      ? point.z === "rear"
        ? "rear wall of the opening"
        : "front of the opening"
      : point.location === "under-sink"
        ? "inside the sink base"
        : point.location === "above-cabinet"
          ? "in the cabinet above"
          : point.location === "beside-tower"
            ? "in the base cabinet beside the tower — open its door to see it"
            : `in the cabinet to the ${sides.cabinet}`;

  const parts: string[] = [];
  if (typeof point.x === "number") parts.push(`${inch(point.x)} from the ${sides.measuredFrom} side`);
  else if (point.x !== "center") parts.push(`at the ${point.x}`);
  if (typeof point.y === "number") parts.push(`${inch(point.y)} up`);
  else parts.push(`at the ${point.y}`);

  return { where, at: parts.join(", ") };
}
