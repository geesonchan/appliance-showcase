import { afterAll, describe, expect, it } from "vitest";
import * as testRoom from "./testRoom";
import * as packages from "./packages";
import * as layoutState from "./layoutState";
import * as room from "./room";
import * as candidates from "./candidates";
import * as catalogue from "./catalogue";
import * as layoutTemplate from "./layoutTemplate";
import { CABINETS } from "./cabinets";
import { uRooms } from "./roomSets";
import BEFORE from "./uTowerAt12.376ce18.json";

/**
 * Package D as a U, at the default oven height, has the oven tower it had
 * before 12b (Leo, 2026-11-17: 「加一条小的单元测试：U 型的 D 在默认 12″ 时，烤箱塔的柜体和
 * 376ce18 的底稿一样。先在"故意改成 13″"的代码上看它红。」).
 *
 * The L is held to its old room by round 97's and 98b-1's link fingerprints
 * (`shareLinkV2.test.ts`, `shareLinkRound98b1.test.ts`); the U had no such test,
 * only 12b's dumps. The room is the dump's own "D U {}", stood up the way
 * `scripts/uDump.ts` stands it (`roomSets.uRooms`), and the boxes it is held to
 * are copied from 376ce18's dump, not read back from this code:
 * `uTowerAt12.376ce18.json`, which says where from.
 */

const m = { testRoom, packages, layoutState, room, candidates, catalogue, layoutTemplate };
afterAll(() => testRoom.resetRoom());

describe("D as a U at the default oven height", () => {
  it("opens at 12\" with the oven tower 376ce18 built, box for box", () => {
    const opened = uRooms(m).find((c) => c.label === "D U {}")!;
    expect(opened.build().ok).toBe(true);
    const tower = CABINETS.filter((box) => box.outline === "right-oven" || box.slot === "slot-oven");
    // One comparison, so a red one shows both the height and the boxes.
    expect({ steamSillIn: room.LAYOUT_PARAMS.steamSillIn, tower: JSON.parse(JSON.stringify(tower)) }).toEqual({
      steamSillIn: 12,
      tower: BEFORE.boxes,
    });
  });
});
