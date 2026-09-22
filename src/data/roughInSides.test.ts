import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import type { LayoutParams } from "./layoutTemplate";
import { PACKAGES, PACKAGE_BY_ID } from "./packages";
import { ISLAND, REQUESTED_PARAMS, RUNS, runForSlot } from "./room";
import { listRoughIn, type RoughInItem } from "./roughInList";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { translate } from "../i18n";
import type { Appliance, SlotId } from "../types";

/**
 * What the install list says about a rough-in point is what the room draws
 * (round 70).
 *
 * Every package, in every arrangement it will build — sink leg, refrigerator
 * end, coffee leg, island orientation — and every point in it, three ways:
 *
 * - the side the sentence measures from is the side the drawn point is that far
 *   from;
 * - the neighbouring cabinet the sentence names, left or right, is on that side
 *   of the machine;
 * - the point is drawn inside the box it is said to be in.
 *
 * Left and right are an installer's, standing in the room facing the cabinet —
 * what they would say on site (round 57). Nothing here asks the code which way
 * that is: a run's cabinetry faces away from its wall, +z on the back wall and
 * +x on the left one; an island machine faces out of the half of the island it
 * stands in. The installer faces the cabinet, so its front (fx, fz) points at
 * them, and their right hand is (fz, -fx): +x on the back run, -z on the left
 * run — toward the corner.
 *
 * The sentences are read off the checklist, which is what the quote prints.
 *
 * Round 70 found both ways this breaks: on the left run the code measured from
 * the corner end and called it the left, and beside a tower the sentence said
 * "from the left side" wherever the cabinet was.
 */
afterAll(() => {
  resetRoom();
});

const EPS_IN = 1e-3;

type Arrangement = Partial<Pick<LayoutParams, "sinkLeg" | "fridgeEnd" | "coffeeLeg" | "islandOrientation">>;

const ARRANGEMENTS: Arrangement[] = [{}];
for (const sinkLeg of ["back", "left"] as const)
  for (const fridgeEnd of ["left", "back"] as const)
    for (const coffeeLeg of ["left", "back"] as const)
      for (const islandOrientation of ["parallel", "perpendicular"] as const)
        ARRANGEMENTS.push({ sinkLeg, fridgeEnd, coffeeLeg, islandOrientation });

const describeArrangement = (a: Arrangement) =>
  Object.keys(a).length === 0
    ? "as it opens"
    : `sink ${a.sinkLeg}, refrigerator ${a.fridgeEnd}, coffee ${a.coffeeLeg}, island ${a.islandOrientation}`;

function build(id: string, arrangement: Arrangement): boolean {
  resetRoom();
  if (!setActivePackage(id).ok) return false;
  if (Object.keys(arrangement).length === 0) return true;
  return setLayoutParamsGrowing({ ...REQUESTED_PARAMS, ...arrangement }).ok;
}

// Which arrangements each package builds, found once while the file is
// collected. One the generator refuses has nothing to check.
const CASES = PACKAGES.flatMap((pkg) =>
  ARRANGEMENTS.filter((arrangement) => build(pkg.id, arrangement)).map(
    (arrangement) => [pkg.id, describeArrangement(arrangement), arrangement] as const,
  ),
);
resetRoom();

/** Inches as the sentence writes them: `6"`, `14-5/8"`. */
function readInches(text: string): number {
  const match = /^(\d+)(?:-(\d+)\/(\d+))?"$/.exec(text);
  if (!match) throw new Error(`not an inch figure: ${text}`);
  return Number(match[1]) + (match[2] ? Number(match[2]) / Number(match[3]) : 0);
}

/** The front of the box a point is in, as a plan vector toward the installer. */
function frontOf(item: RoughInItem): [number, number] {
  const { host } = item.resolved;
  const run = RUNS.find(
    (r) => r.segments.some((s) => s.id === host.id) || r.uppers.some((b) => b.id === host.id),
  );
  const where = run ? run.id : runForSlot(item.slotId);
  if (where === "back") return [0, 1];
  if (where === "left") return [1, 0];
  // An island machine opens to the half of the island it stands in.
  const slot = SLOT_BY_ID[item.slotId];
  const alongIsX = ISLAND.x[1] - ISLAND.x[0] > ISLAND.z[1] - ISLAND.z[0];
  const across = alongIsX ? ISLAND.z : ISLAND.x;
  const at = alongIsX ? slot.position[2] : slot.position[0];
  const sign = at < (across[0] + across[1]) / 2 ? -1 : 1;
  return alongIsX ? [0, sign] : [sign, 0];
}

/** Where things are across the installer's view: a coordinate that grows to their right, in inches. */
function view(item: RoughInItem) {
  const [fx, fz] = frontOf(item);
  const right = (x: number, z: number) => (x * fz + z * -fx) * 12;
  const { position, host } = item.resolved;
  const corners = [
    right(host.min[0], host.min[2]),
    right(host.min[0], host.max[2]),
    right(host.max[0], host.min[2]),
    right(host.max[0], host.max[2]),
  ];
  const slot = SLOT_BY_ID[item.slotId];
  return {
    point: right(position[0], position[2]),
    left: Math.min(...corners),
    rightEdge: Math.max(...corners),
    machine: right(slot.position[0], slot.position[2]),
  };
}

const outside = (v: ReturnType<typeof view>) => v.point < v.left - EPS_IN || v.point > v.rightEdge + EPS_IN;

/**
 * Package B's neighbouring-cabinet points, drawn outside the box they are in.
 *
 * Found by this file in round 70 and not the left-and-right fault it was
 * written for: they stay outside with that fixed, on the back run as well as
 * the left. `pickNeighbour` takes any segment that is not an appliance, so
 * beside B's refrigerator and wine column it takes a 3" tall board or a 5/8"
 * spacer, and a figure of 6" or 12" lands past it. Recorded in decisions.md's
 * Open items; not fixed this round (Leo). The last test in this file fails once
 * they are inside, so this list goes when they are fixed.
 */
const KNOWN_OUTSIDE = [
  { packageId: "package-b", slotId: "slot-fridge", type: "power" },
  { packageId: "package-b", slotId: "slot-fridge", type: "water" },
  { packageId: "package-b", slotId: "slot-wine", type: "power" },
] as const;

const knownOutside = (id: string, item: RoughInItem) =>
  KNOWN_OUTSIDE.some(
    (k) => k.packageId === id && k.slotId === item.slotId && k.type === item.resolved.point.type,
  );

/** The room's rough-in points, each with the sentence the checklist prints for it. */
function pointsWithSentences(id: string) {
  const pkg = PACKAGE_BY_ID[id];
  const selection = Object.fromEntries(
    Object.entries(pkg.defaultSelection).map(([slot, model]) => [slot, APPLIANCE_BY_ID[model as string]]),
  ) as Record<SlotId, Appliance>;
  const findings = checklistFor(selection, null).findings;
  return listRoughIn(selection).map((item) => {
    const index = Number(item.key.split(":").pop());
    const finding = findings.find(
      (f) => f.ruleId === `rough-in:${item.slotId}:${item.resolved.point.type}:${index}`,
    );
    if (!finding?.params) throw new Error(`no checklist line for ${item.key}`);
    // The English the page prints for each part (`sayWith` fills `{where}`
    // from `whereKey` with the same figures).
    const where = translate("en", String(finding.params.whereKey), finding.params);
    const at = translate("en", String(finding.params.atKey), finding.params);
    return { item, where, at, label: `${item.slotId} ${item.resolved.point.type} ("${where}; ${at}")` };
  });
}

describe.each(CASES)("%s, %s", (id, _name, arrangement) => {
  it("measures each point from the side its sentence names", () => {
    build(id, arrangement);
    const wrong: string[] = [];
    for (const { item, at, label } of pointsWithSentences(id)) {
      const v = view(item);
      const measured = /(\S+) from the (left|right) side/.exec(at);
      if (measured) {
        const said = readInches(measured[1]);
        const drawn = measured[2] === "left" ? v.point - v.left : v.rightEdge - v.point;
        if (Math.abs(drawn - said) > EPS_IN) {
          wrong.push(
            `${label}: drawn ${(v.point - v.left).toFixed(2)}" from the left side, ` +
              `${(v.rightEdge - v.point).toFixed(2)}" from the right`,
          );
        }
      }
      const edge = /at the (left|right)\b/.exec(at);
      if (edge) {
        const nearer = v.point - v.left < v.rightEdge - v.point ? "left" : "right";
        if (nearer !== edge[1]) wrong.push(`${label}: drawn nearer the ${nearer}`);
      }
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("puts each neighbouring cabinet on the side its sentence names", () => {
    build(id, arrangement);
    const wrong: string[] = [];
    for (const { item, where, label } of pointsWithSentences(id)) {
      const said = /cabinet to the (left|right)/.exec(where);
      if (!said) continue;
      const v = view(item);
      const actual = (v.left + v.rightEdge) / 2 > v.machine ? "right" : "left";
      if (actual !== said[1]) wrong.push(`${label}: the cabinet is on the ${actual}`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("measures a point in a neighbour's cabinet from the side that meets the machine", () => {
    build(id, arrangement);
    const wrong: string[] = [];
    for (const { item, at, label } of pointsWithSentences(id)) {
      const { location } = item.resolved.point;
      if (!location.startsWith("adjacent-cabinet") && location !== "beside-tower") continue;
      const measured = /from the (left|right) side/.exec(at);
      if (!measured) continue;
      const v = view(item);
      const meets = v.machine < v.left ? "left" : "right";
      if (measured[1] !== meets) wrong.push(`${label}: the side that meets the machine is its ${meets}`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("draws each point inside the box it is in", () => {
    build(id, arrangement);
    const wrong: string[] = [];
    for (const { item, label } of pointsWithSentences(id)) {
      if (knownOutside(id, item)) continue;
      const v = view(item);
      if (outside(v)) {
        wrong.push(
          `${label}: at ${v.point.toFixed(2)}, its box ${item.resolved.host.id} runs ` +
            `${v.left.toFixed(2)} to ${v.rightEdge.toFixed(2)}`,
        );
      }
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });
});

describe("the cabinet beside a tower, on the tower's left", () => {
  // Package D as it opens: the base cabinet stands left of the oven tower, so
  // the side that meets the tower is the cabinet's right. Until round 70 the
  // sentence said "from the left side" whichever side of the tower it stood,
  // on the quote, while the point was drawn from the right.
  it("says the junction box is 3 inches from the right side", () => {
    build("package-d", {});
    const oven = pointsWithSentences("package-d").find(
      ({ item }) => item.slotId === "slot-oven" && item.resolved.point.location === "beside-tower",
    );
    expect(oven?.at).toBe('3" from the right side, at the top');
  });
});

describe("the points known to be drawn outside their box", () => {
  it("are still outside it, so the exception above is not left behind once they are fixed", () => {
    const fixed: string[] = [];
    for (const [id, , arrangement] of CASES) {
      if (!KNOWN_OUTSIDE.some((k) => k.packageId === id)) continue;
      build(id, arrangement);
      for (const { item, label } of pointsWithSentences(id)) {
        if (knownOutside(id, item) && !outside(view(item))) fixed.push(`${id}, ${describeArrangement(arrangement)}: ${label}`);
      }
    }
    expect(fixed, fixed.join("\n")).toEqual([]);
  });
});

describe("the arrangements checked", () => {
  it("include more than the one each package opens in, for every package", () => {
    const counts = PACKAGES.map((pkg) => [pkg.id, CASES.filter(([id]) => id === pkg.id).length] as const);
    expect(counts.filter(([, n]) => n < 2)).toEqual([]);
  });
});
