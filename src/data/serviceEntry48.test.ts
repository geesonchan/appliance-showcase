/**
 * Item 12, 6 (Leo, 2026-11-14: 「L 型、一字型改到 48″，照做」「写法用乙，三种房型共用 serviceEntry() 一条规则」
 * 「加一条测试：L 型 538 间、一字型 108 间，新规则算出的点都是后墙、离远端 48″」).
 *
 * Every L and one-wall room the dumps build (`roomSets`): where the services come in, as the
 * utility layer draws it (`serviceEntryPoint`), is on the back wall, 48" back from its far end
 * — the U's rule (`serviceEntry`, the cooking surface's run, the back run where it cooks in the
 * island), which in all of these rooms is the back run reaching the back wall's far end. Until
 * item 12 the L and one wall drew it 4" from that end (`ROOM.halfX - ft(4)`, `ft` taking inches).
 */
import { afterAll, describe, expect, it } from "vitest";
import * as testRoom from "./testRoom";
import * as packages from "./packages";
import * as layoutState from "./layoutState";
import * as roomState from "./room";
import * as candidates from "./candidates";
import * as catalogue from "./catalogue";
import * as layoutTemplate from "./layoutTemplate";
import { lRooms, oneWallRooms, type RoomCase } from "./roomSets";
import { serviceEntryPoint } from "./serviceRoute";
import { wallBehind } from "./roomWalls";
import { onAxis, otherAxis } from "./frame";
import { ROOM, ft } from "./roomShell";

const modules = { packages, layoutState, room: roomState, candidates, catalogue, testRoom, layoutTemplate };
afterAll(() => testRoom.resetRoom());

const STANDOFF = 0.25;

/** Each built room's entry against the back wall 48" from its far end; what is wrong, by room. */
function check(cases: RoomCase[]) {
  let built = 0;
  const wrong: string[] = [];
  for (const c of cases) {
    if (!c.build().ok) continue;
    built += 1;
    const back = roomState.RUN_BY_ID.back;
    const wall = wallBehind(back.facing);
    const [x, , z] = onAxis(otherAxis(wall.axis), ROOM.halfX - ft(48), wall.at + back.facing.sign * STANDOFF);
    const at = serviceEntryPoint(STANDOFF);
    const end = back.segments[back.segments.length - 1].to;
    if (Math.abs(at.x - x) > 1e-9 || Math.abs(at.z - z) > 1e-9 || Math.abs(end - ROOM.halfX) > 1e-9) {
      wrong.push(`${c.label}: at ${at.x.toFixed(4)},${at.z.toFixed(4)}, wants ${x.toFixed(4)},${z.toFixed(4)}; back run ends ${end}, wall ${ROOM.halfX}`);
    }
  }
  return { built, wrong };
}

describe("the services come in on the back wall, 48\" from its far end (item 12)", () => {
  it("in all 538 L rooms built", () => {
    const { built, wrong } = check(lRooms(modules));
    expect(wrong.slice(0, 5)).toEqual([]);
    expect(wrong.length).toBe(0);
    expect(built).toBe(538);
  });

  it("in all 108 one-wall rooms built", () => {
    const { built, wrong } = check(oneWallRooms(modules));
    expect(wrong.slice(0, 5)).toEqual([]);
    expect(wrong.length).toBe(0);
    expect(built).toBe(108);
  });
});
