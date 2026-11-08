import { afterAll, describe, expect, it } from "vitest";
import { CABINETS, type CabinetBox } from "./cabinets";
import { APPLIANCE_BY_ID } from "./catalogue";
import { COOKTOP_BODY, COOKTOP_CABINET } from "./cooktop";
import { setActivePackage, setLayoutParamsGrowing, setRangeModel } from "./layoutState";
import { oneWallWantedIn, type LayoutParams } from "./layoutTemplate";
import { PACKAGE_BY_ID } from "./packages";
import { REQUESTED_PARAMS, RUNS } from "./room";
import { resolveRoughIn } from "./roughIn";
import { resetRoom } from "./testRoom";
import type { Appliance, Package, SlotId } from "../types";

/**
 * The room under a cooking surface, inside the cabinet that stands under it.
 *
 * Leo, 2026-11-08: round 49's test held a drawer top 3-3/4" under the counter,
 * and what that guarded is the space under the cooktop's body (CIT367YG p. 9:
 * at most 2-3/4" of body, a 1" fitting, 1" clear under that; on site E has
 * 4-3/4", D20). There is no drawer any more, and the space is still owed:
 * 「灶下柜里台面下 4-3/4" 以内不能有隔板或别的东西」, for B, D, A and E on one wall.
 * E's island is the test that started it, so it is here too.
 *
 * Read from what is built: every other box the room has, the modules of the
 * cabinet, and every rough-in point that is inside it. The false shelf at the
 * end is the proof the check can fail: without it this file could pass by
 * looking at nothing.
 */

afterAll(() => resetRoom());

const CIT367YG = APPLIANCE_BY_ID["thermador-cit367yg"];
const PCG366W = APPLIANCE_BY_ID["thermador-pcg366w"];
const inches = (feet: number) => feet * 12;
const COUNTER_TOP_IN = 36;
/** Guide p. 9: 2-3/4" + 1" + 1"; written out, and held to the constant below. */
const CLEAR_IN = 2.75 + 1 + 1;

function theL(entry: Package) {
  resetRoom();
  expect(setActivePackage(entry.id).ok).toBe(true);
}
function oneWall(entry: Package) {
  theL(entry);
  const asked: LayoutParams = { ...REQUESTED_PARAMS, shape: "one-wall" };
  asked.backWallIn = Math.max(asked.backWallIn, oneWallWantedIn(asked, entry));
  expect(setLayoutParamsGrowing(asked).ok).toBe(true);
}

interface Extent {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}
function extent(box: Pick<CabinetBox, "position" | "size">): Extent {
  const along = (axis: 0 | 1 | 2): [number, number] => [
    inches(box.position[axis] - box.size[axis] / 2),
    inches(box.position[axis] + box.size[axis] / 2),
  ];
  return { x: along(0), y: along(1), z: along(2) };
}
const overlaps = (a: [number, number], b: [number, number]) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 1e-6;

/** What is inside the cabinet, in the band under the stone it must keep clear. */
function inTheWay(target: CabinetBox, boxes: readonly CabinetBox[], slotId: SlotId, machine: Appliance): string[] {
  const cabinet = extent(target);
  const band: [number, number] = [COUNTER_TOP_IN - CLEAR_IN, COUNTER_TOP_IN];
  const found: string[] = [];
  if (target.module?.kind === "drawer-base") found.push(`${target.id} is a drawer base`);
  for (const box of boxes) {
    if (box.id === target.id) continue;
    const other = extent(box);
    if (overlaps(other.x, cabinet.x) && overlaps(other.z, cabinet.z) && overlaps(other.y, band)) found.push(box.id);
  }
  for (const resolved of resolveRoughIn(slotId, machine)) {
    const [x, y, z] = resolved.position.map(inches);
    const inside = x > cabinet.x[0] && x < cabinet.x[1] && z > cabinet.z[0] && z < cabinet.z[1];
    if (inside && y + inches(resolved.size[1]) / 2 > band[0] + 1e-6) found.push(`${resolved.point.type} at ${y}"`);
  }
  return found;
}

function runCabinet(slotId: SlotId): CabinetBox {
  const run = RUNS.find((r) => r.segments.some((s) => s.slot === slotId))!;
  const segment = run.segments.find((s) => s.slot === slotId)!;
  const id = `${segment.id}-${segment.modules[0].code}-0`;
  const box = CABINETS.find((b) => b.id === id);
  if (!box) throw new Error(`no cabinet ${id} under ${slotId}`);
  return box;
}

const CASES: [string, () => { target: CabinetBox; slotId: SlotId; machine: Appliance }][] = [
  ...(["package-b", "package-d"] as const).flatMap((id): typeof CASES =>
    ([["L", theL], ["one wall", oneWall]] as const).map(([name, shape]) => [
      `${id}, ${name}, with the cooktop`,
      () => {
        shape(PACKAGE_BY_ID[id]);
        setRangeModel(CIT367YG, id);
        return { target: runCabinet("slot-range"), slotId: "slot-range", machine: CIT367YG };
      },
    ]),
  ),
  ...(["package-b", "package-d"] as const).flatMap((id): typeof CASES =>
    ([["L", theL], ["one wall", oneWall]] as const).map(([name, shape]) => [
      `${id}, ${name}, with its rangetop`,
      () => {
        shape(PACKAGE_BY_ID[id]);
        return { target: runCabinet("slot-range"), slotId: "slot-range", machine: PCG366W };
      },
    ]),
  ),
  ...([["L", theL], ["one wall", oneWall]] as const).map(([name, shape]): (typeof CASES)[number] => [
    `package-a, ${name}, changed to a rangetop`,
    () => {
      shape(PACKAGE_BY_ID["package-a"]);
      setRangeModel(PCG366W, "package-a");
      return { target: runCabinet("slot-range"), slotId: "slot-range", machine: PCG366W };
    },
  ]),
  [
    "package-e on one wall",
    () => {
      oneWall(PACKAGE_BY_ID["package-e"]);
      return { target: runCabinet("slot-cooktop"), slotId: "slot-cooktop", machine: CIT367YG };
    },
  ],
  [
    "package-e's island",
    () => {
      theL(PACKAGE_BY_ID["package-e"]);
      const target = CABINETS.find((b) => b.id === "island-cooktop-B36");
      if (!target) throw new Error("no door base under the island's cooktop");
      return { target, slotId: "slot-cooktop", machine: CIT367YG };
    },
  ],
];

describe("nothing within 4-3/4 inches under the counter, inside the cabinet under a cooking surface", () => {
  it("is the guide's three figures added up, in the one constant", () => {
    expect(CLEAR_IN).toBe(4.75);
    expect(COOKTOP_CABINET.clearBelowCounterIn).toBe(CLEAR_IN);
    expect(COOKTOP_BODY.belowCounterIn + COOKTOP_BODY.fittingIn + 1).toBe(CLEAR_IN);
  });

  it.each(CASES)("%s", (_name, build) => {
    const { target, slotId, machine } = build();
    expect(target.module === undefined || target.module.code === "B36").toBe(true);
    expect(inTheWay(target, CABINETS, slotId, machine)).toEqual([]);
  });

  it("finds a shelf 4 inches down, and lets one past at 5", () => {
    const { target, slotId, machine } = CASES[0][1]();
    const shelfAt = (belowIn: number): CabinetBox => ({
      ...target,
      id: "a-false-shelf",
      position: [target.position[0], (COUNTER_TOP_IN - belowIn) / 12, target.position[2]],
      size: [target.size[0], 0.75 / 12, target.size[2]],
    });
    expect(inTheWay(target, [...CABINETS, shelfAt(4)], slotId, machine)).toEqual(["a-false-shelf"]);
    expect(inTheWay(target, [...CABINETS, shelfAt(5.5)], slotId, machine)).toEqual([]);
  });

  it("finds a drawer base under it", () => {
    const { target, slotId, machine } = CASES[0][1]();
    const drawers: CabinetBox = { ...target, module: { ...target.module!, kind: "drawer-base" } };
    expect(inTheWay(drawers, CABINETS, slotId, machine)).toEqual([`${target.id} is a drawer base`]);
  });
});
