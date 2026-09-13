import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCES } from "./catalogue";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { resolveRoughIn, type ResolvedPoint } from "./roughIn";
import { RUNS } from "./room";
import type { RoughInPoint } from "./schema";
import type { SlotId } from "../types";

/**
 * Where a hard-wired oven's junction box goes. Round 39, Leo: not behind the
 * machine. MEM301WS's manual says above, left or right of the unit; PODS302B's
 * sheet says above, beneath, right or left. It is drawn in the base cabinet
 * beside the tower — the landing side where there is one each side — so opening
 * that cabinet's door shows it.
 */
afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

function activate(id: string) {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  const result = setActivePackage(id);
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
}

const TOWERS = [
  ["package-b", "slot-microwave", "MEM301WS"],
  ["package-d", "slot-oven", "PODS302B"],
] as const;

/** What is wrong with where a tower oven's power lands. */
function junctionProblems(slotId: SlotId, power: ResolvedPoint | undefined): string[] {
  if (!power) return ["no power point"];
  const run = RUNS.find((r) => r.segments.some((s) => s.slot === slotId))!;
  const towerAt = run.segments.findIndex((s) => s.slot === slotId);
  const hostAt = run.segments.findIndex((s) => s.id === power.host.id);
  const problems: string[] = [];
  if (hostAt < 0) return [`drawn in ${power.host.id}, which is not a cabinet on the tower's run`];
  if (run.segments[hostAt].kind !== "counter") problems.push(`drawn in ${power.host.id}, not a base cabinet`);
  // Nothing but the tower's own boards between it and the tower.
  const between = run.segments.slice(Math.min(hostAt, towerAt) + 1, Math.max(hostAt, towerAt));
  if (!between.every((s) => s.kind === "tall" && s.modules.every((m) => m.kind === "panel"))) {
    problems.push(`${power.host.id} is not next to the tower`);
  }
  // Where there is a cabinet both sides, the landing side: toward the cooking surface.
  const rangeAt = run.segments.findIndex((s) => s.slot === "slot-range");
  if (rangeAt >= 0 && Math.sign(hostAt - towerAt) !== Math.sign(rangeAt - towerAt)) {
    problems.push(`${power.host.id} is on the side away from the landing`);
  }
  // And inside that cabinet, not inside the tower's own span.
  const axis = run.axis === "x" ? 0 : 2;
  const tower = run.segments[towerAt];
  const at = power.position[axis];
  if (at > tower.from && at < tower.to) problems.push("the box is inside the tower's own width");
  if (at < power.host.min[axis] - 1e-6 || at > power.host.max[axis] + 1e-6) {
    problems.push("the box is outside the cabinet it is said to be in");
  }
  return problems;
}

describe("a tower oven's junction box", () => {
  it.each(TOWERS)("in %s, puts it in the base cabinet beside the tower, on the landing side", (id, slotId, model) => {
    activate(id);
    const oven = APPLIANCES.find((a) => a.model === model)!;
    expect(PACKAGE_BY_ID[id].defaultSelection[slotId]).toBe(oven.id);
    const power = resolveRoughIn(slotId, oven).find((p) => p.point.type === "power");
    expect(power?.point.location, id).toBe("beside-tower");
    expect(junctionProblems(slotId, power), id).toEqual([]);
  });

  it("fails the old place, behind the machine at the top of its opening", () => {
    activate("package-d");
    const oven = APPLIANCES.find((a) => a.model === "PODS302B")!;
    const power = resolveRoughIn("slot-oven", oven).find((p) => p.point.type === "power")!;
    const behind: RoughInPoint = { ...power.point, location: "in-cutout", x: "center", y: "top" };
    // Resolve the old entry through the same code by handing it a copy of the model.
    const moved = resolveRoughIn("slot-oven", { ...oven, id: "no-such-model" });
    expect(moved).toEqual([]);
    const opening = { ...power, point: behind, host: { ...power.host, id: "slot-oven-opening" } };
    expect(junctionProblems("slot-oven", opening)).not.toEqual([]);
  });
});
