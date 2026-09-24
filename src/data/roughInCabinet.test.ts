import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import type { LayoutParams } from "./layoutTemplate";
import { PACKAGES, PACKAGE_BY_ID } from "./packages";
import { CABINETS } from "./cabinets";
import { axisIndex } from "./frame";
import { ISLAND, REQUESTED_PARAMS, RUNS } from "./room";
import { listRoughIn, type RoughInItem } from "./roughInList";
import { resetRoom } from "./testRoom";
import { translate } from "../i18n";
import { roughInWords } from "./roughIn";
import type { Appliance, SlotId } from "../types";

/**
 * A connection in a neighbour's cabinet is in a cabinet (round 71).
 *
 * Leo, from site: *"如果条件允许，插座和进水口都是安装在靠近机器的、有橱柜的一侧。"*
 * — where there is a cabinet, the socket and the water go on the side of the
 * machine that has one, near the machine. Two layers, and this file holds both:
 *
 * - the box picked is a **real cabinet** — something with a door or a drawer
 *   somebody can open. A 5/8" column spacer, a 3" tall board and a filler are
 *   not, and round 70 found B's refrigerator socket drawn 6" past a board;
 * - **where neither side has one**, the point goes where the model's data says
 *   it goes instead, and is marked as the way out rather than the rule.
 *
 * What counts as a cabinet is worked out here from the modules a segment is
 * made of, not by asking the code that places the points.
 */
afterAll(() => {
  resetRoom();
});

const DOORED = new Set(["base", "drawer-base", "sink-base", "corner", "tall"]);
/** A segment that houses a machine is that machine, not somewhere to put a socket. */
const machine = (segment: { kind: string; slot?: string; modules: { kind: string; slot?: string }[] }) =>
  segment.kind === "appliance" || Boolean(segment.slot) || segment.modules.some((m) => m.slot);
const realCabinet = (segment: Parameters<typeof machine>[0]) =>
  !machine(segment) && segment.modules.some((m) => DOORED.has(m.kind));

type Arrangement = Partial<Pick<LayoutParams, "sinkLeg" | "fridgeEnd" | "coffeeLeg" | "islandOrientation">>;
const ARRANGEMENTS: [string, Arrangement][] = [["as-it-opens", {}]];
for (const sinkLeg of ["back", "left"] as const)
  for (const fridgeEnd of ["left", "back"] as const)
    for (const coffeeLeg of ["left", "back"] as const)
      for (const islandOrientation of ["parallel", "perpendicular"] as const)
        ARRANGEMENTS.push([
          `sink ${sinkLeg}, refrigerator ${fridgeEnd}, coffee ${coffeeLeg}, island ${islandOrientation}`,
          { sinkLeg, fridgeEnd, coffeeLeg, islandOrientation },
        ]);

function build(id: string, arrangement: Arrangement): boolean {
  resetRoom();
  if (!setActivePackage(id).ok) return false;
  if (Object.keys(arrangement).length === 0) return true;
  return setLayoutParamsGrowing({ ...REQUESTED_PARAMS, ...arrangement }).ok;
}

const selectionOf = (id: string) =>
  Object.fromEntries(
    Object.entries(PACKAGE_BY_ID[id].defaultSelection).map(([slot, model]) => [slot, APPLIANCE_BY_ID[model as string]]),
  ) as Record<SlotId, Appliance>;

/** The points that are supposed to land in a neighbour's cabinet. */
const inANeighbour = (id: string) =>
  listRoughIn(selectionOf(id)).filter(
    ({ resolved }) =>
      resolved.point.location.startsWith("adjacent-cabinet") || resolved.point.location === "beside-tower",
  );

const segmentOf = (hostId: string) => RUNS.flatMap((run) => run.segments).find((s) => s.id === hostId);

/**
 * On the island there are no run segments: a neighbour is one of the island's
 * own cabinets (round 73). Worked out from the cabinet boxes the room draws —
 * an island base box that belongs to no machine, at least 12" along the island
 * (D13's narrowest base cabinet), with the point's host inside it.
 */
const islandCabinetOf = (item: RoughInItem) => {
  const { min, max } = item.resolved.host;
  const along = axisIndex(ISLAND.axis);
  return CABINETS.find((box) => {
    if (box.outline !== "island" || box.slot || box.kind !== "base") return false;
    if (box.size[along] < 1 - 1e-6) return false;
    return [0, 2].every(
      (axis) =>
        min[axis] >= box.position[axis] - box.size[axis] / 2 - 1e-6 &&
        max[axis] <= box.position[axis] + box.size[axis] / 2 + 1e-6,
    );
  });
};
const label = (item: RoughInItem) => `${item.slotId} ${item.resolved.point.type}`;
const en = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
const says = (item: RoughInItem) => en(roughInWords(item.resolved).whereKey);

describe.each(PACKAGES.map((pkg) => pkg.id))("%s", (id) => {
  it.each(ARRANGEMENTS)("puts a neighbour's connection in a real cabinet, or says it could not (%s)", (_name, arrangement) => {
    if (!build(id, arrangement)) return;
    const wrong: string[] = [];
    for (const item of inANeighbour(id)) {
      if (item.resolved.noCabinet) continue; // the recorded way out, checked below
      const segment = segmentOf(item.resolved.host.id);
      if (!segment && islandCabinetOf(item)) continue;
      if (!segment) wrong.push(`${label(item)}: its box ${item.resolved.host.id} is neither a run segment nor an island cabinet`);
      else if (!realCabinet(segment))
        wrong.push(
          `${label(item)}: ${segment.id} is [${segment.modules.map((m) => `${m.kind} ${m.widthIn}"`).join(", ")}]`,
        );
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });
});

describe("package B's refrigerator, which has a cabinet on neither side", () => {
  // A 5/8" column spacer and the wine column one way, a 3" board and the end of
  // the run the other, in every arrangement B builds. T36BT120NS's sheet, p. 4,
  // allows the socket behind the appliance instead; the water goes behind it
  // too (Leo, from site).
  it("puts the socket behind the appliance, as it opens", () => {
    build("package-b", {});
    const power = inANeighbour("package-b").find((i) => i.slotId === "slot-fridge" && i.resolved.point.type === "power");
    expect([power?.resolved.noCabinet, power && says(power)]).toEqual([true, "behind the appliance"]);
  });

  it("puts the water behind the appliance, as it opens", () => {
    build("package-b", {});
    const water = inANeighbour("package-b").find((i) => i.slotId === "slot-fridge" && i.resolved.point.type === "water");
    expect([water?.resolved.noCabinet, water && says(water)]).toEqual([true, "behind the appliance"]);
  });

  it("draws both of them inside the refrigerator's own opening", () => {
    build("package-b", {});
    const outside = inANeighbour("package-b")
      .filter((i) => i.slotId === "slot-fridge")
      .filter(({ resolved }) =>
        [0, 1, 2].some((axis) => resolved.position[axis] < resolved.host.min[axis] - 1e-6 || resolved.position[axis] > resolved.host.max[axis] + 1e-6),
      )
      .map((i) => `${label(i)} at ${i.resolved.position.map((n) => (n * 12).toFixed(1)).join(",")}`);
    expect(outside, outside.join("\n")).toEqual([]);
  });

  const noteLines = (type: string) =>
    inANeighbour("package-b")
      .filter((i) => i.slotId === "slot-fridge" && i.resolved.point.type === type)
      .flatMap((i) => i.resolved.noCabinetNotes.map((key) => en(key)));

  it("says on the checklist why the socket is behind it, and that it needs a breaker", () => {
    build("package-b", {});
    expect(noteLines("power")).toEqual([
      "No cabinet on either side, so this connection goes behind the appliance.",
      "Permissible only where the outlet can be switched off at a circuit breaker.",
    ]);
  });

  it("says why the water is behind it, and asks for no breaker", () => {
    build("package-b", {});
    expect(noteLines("water")).toEqual([
      "No cabinet on either side, so this connection goes behind the appliance.",
    ]);
  });
});

describe("package D's oven, with its coffee cabinet on the back leg", () => {
  // Then the only thing beside the tower is a 6" filler. PODS302B's sheet, p. 2,
  // allows the junction box beneath the unit; above is the gap the steam goes
  // up (Leo).
  const backLeg: Arrangement = { sinkLeg: "back", fridgeEnd: "left", coffeeLeg: "back", islandOrientation: "parallel" };

  it("puts the junction box in the drawer under the opening", () => {
    expect(build("package-d", backLeg)).toBe(true);
    const oven = inANeighbour("package-d").find((i) => i.slotId === "slot-oven");
    expect([oven?.resolved.noCabinet, oven && says(oven)]).toEqual([
      true,
      "at the back of the drawer under the opening",
    ]);
  });

  it("draws it inside that drawer", () => {
    build("package-d", backLeg);
    const oven = inANeighbour("package-d").find((i) => i.slotId === "slot-oven")!;
    const inside = [0, 1, 2].every(
      (axis) =>
        oven.resolved.position[axis] >= oven.resolved.host.min[axis] - 1e-6 &&
        oven.resolved.position[axis] <= oven.resolved.host.max[axis] + 1e-6,
    );
    expect(inside).toBe(true);
  });

  it("keeps it in the cabinet beside the tower where there is one", () => {
    expect(build("package-d", {})).toBe(true);
    const oven = inANeighbour("package-d").find((i) => i.slotId === "slot-oven");
    expect([oven?.resolved.noCabinet, oven && says(oven)]).toEqual([
      false,
      "in the base cabinet beside the tower — open its door to see it",
    ]);
  });
});

describe("a machine with a cabinet beside it takes the cabinet", () => {
  it("leaves package A's refrigerator in the landing cabinet, as it opens", () => {
    build("package-a", {});
    const power = inANeighbour("package-a").find((i) => i.slotId === "slot-fridge" && i.resolved.point.type === "power")!;
    expect([power.resolved.noCabinet, power.resolved.host.id]).toEqual([false, "left-corner-landing-1"]);
  });

  it("leaves package B's rangetop socket in the drawer base beside the tower", () => {
    build("package-b", {});
    const power = inANeighbour("package-b").find((i) => i.slotId === "slot-range")!;
    expect([power.resolved.noCabinet, power.resolved.host.id]).toEqual([false, "back-tower-clearance-0"]);
  });
});
