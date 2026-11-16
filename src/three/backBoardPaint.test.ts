/**
 * What a U side leg's back board is painted (12a; Leo, 2026-11-15: 「改法用甲：背板朝里那一面
 * 用墙色，朝外不变」, 「墙色跟"外观"面板里选的墙色走，日间夜晚的明暗和后墙一样」).
 *
 * The face toward the room wears the colour the walls are drawn in —
 * `wallColor` for the render mode, the lighting and the wall paint chosen in the
 * Finishes panel, the walls' own function (KitchenShell) — with the walls'
 * roughness. The outside, the board itself, keeps the leg's door finish, as
 * before 12a. In install mode both are ghosted as the carcasses are.
 *
 * Reached through the module, so on code without `backBoardPaint` each case
 * fails on its own.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import * as layer from "./CabinetLayer";
import { finish, wallColor, type SurfaceProps, type WallFinish } from "./materials";
import { CABINET_COLORS, cabinetPaint } from "../store/useAppStore";
import { ACCENT_COLORS, WALL_FINISHES } from "../store/finishes";
import type { Lighting, RenderMode } from "../types";

type Finishes = { cabinet: string; accent: string; accentRun: string; wall: WallFinish };
type Paint = (mode: RenderMode, lighting: Lighting, finishes: Finishes, run: string) => { outside: SurfaceProps; room: SurfaceProps };
const backBoardPaint: Paint = (...args) => (layer as unknown as { backBoardPaint: Paint }).backBoardPaint(...args);

const MODES: RenderMode[] = ["realistic", "white", "install"];
const LIGHTS: Lighting[] = ["day", "night"];
const NAVY = CABINET_COLORS[1].value;
const finishesWith = (wall: WallFinish, accentRun = "none"): Finishes => ({ cabinet: NAVY, accent: ACCENT_COLORS[0].value, accentRun, wall });

describe("a U side leg's back board: the wall's paint toward the room, the door's outside (12a)", () => {
  for (const mode of MODES) {
    for (const lighting of LIGHTS) {
      it(`${mode}, ${lighting}: the room face in each of the four wall paints, as the walls are`, () => {
        const got = WALL_FINISHES.map((wall) => {
          const room = backBoardPaint(mode, lighting, finishesWith(wall), "right").room;
          return { wall, color: room.color, roughness: room.roughness, metalness: room.metalness, map: room.map ?? null };
        });
        expect(got).toEqual(
          WALL_FINISHES.map((wall) => ({ wall, color: wallColor(mode, lighting, wall), roughness: 0.95, metalness: 0, map: null })),
        );
      });
    }
  }

  for (const run of ["left", "right"] as const) {
    it(`the ${run} leg's outside: its door finish, as before 12a, in every mode`, () => {
      const finishes = finishesWith("taupe");
      const got = MODES.map((mode) => backBoardPaint(mode, "day", finishes, run).outside);
      const door = cabinetPaint({ ...finishes, accentRun: "none" }, run);
      expect(got).toEqual(
        MODES.map((mode) => ({
          ...finish(mode, door.token, door.colour),
          transparent: mode === "install",
          opacity: mode === "install" ? 0.06 : 1,
        })),
      );
    });
  }

  it("the accent on the right leg: its outside in the accent, its room face still the wall", () => {
    const finishes = finishesWith("mid-grey", "right");
    const paint = backBoardPaint("realistic", "day", finishes, "right");
    const accent = cabinetPaint({ ...finishes, accentRun: "right" }, "right");
    expect([paint.outside.color, paint.room.color]).toEqual([
      finish("realistic", accent.token, accent.colour).color,
      wallColor("realistic", "day", "mid-grey"),
    ]);
  });

  it("install mode: the room face ghosted as the board is", () => {
    const paint = backBoardPaint("install", "day", finishesWith("warm-grey"), "left");
    expect([paint.room.transparent, paint.room.opacity, paint.outside.transparent, paint.outside.opacity]).toEqual([true, 0.06, true, 0.06]);
  });
});

/**
 * The board itself is drawn without its face toward the room, which the
 * wall-coloured plane takes the place of: no door-coloured face behind the wall's
 * to show past its edge (a plane a sixteenth of an inch in front of the board
 * showed one, a saw-tooth along the top), and the board's ends and top in the door
 * finish all the way (a skin of its own thickness put the wall's colour on them).
 */
describe("the board drawn without its face toward the room (12a)", () => {
  type Open = (size: [number, number, number], rotationY: number) => THREE.BufferGeometry;
  const open: Open = (...args) => (layer as unknown as { boardWithoutRoomFace: Open }).boardWithoutRoomFace(...args);
  /** Each remaining triangle's outward direction, rounded, once. */
  const facesOf = (geometry: THREE.BufferGeometry) => {
    const normal = geometry.getAttribute("normal");
    const index = geometry.index!.array;
    const seen = new Set<string>();
    for (let i = 0; i < index.length; i += 3) {
      const v = index[i];
      seen.add([normal.getX(v), normal.getY(v), normal.getZ(v)].map((n) => Math.round(n) + 0).join(","));
    }
    return [...seen].sort();
  };
  const ALL = ["-1,0,0", "0,-1,0", "0,0,-1", "0,0,1", "0,1,0", "1,0,0"];
  for (const [leg, rotationY, room] of [
    ["the left leg's, facing +x", Math.PI / 2, "1,0,0"],
    ["the right leg's, facing -x", Math.PI * 1.5, "-1,0,0"],
    ["a board facing +z", 0, "0,0,1"],
    ["a board facing -z", Math.PI, "0,0,-1"],
  ] as const) {
    it(`${leg}: five faces, none toward the room`, () => {
      const geometry = open([0.0625, 8, 10], rotationY);
      expect([geometry.index!.count, facesOf(geometry)]).toEqual([30, ALL.filter((face) => face !== room)]);
    });
  }
});
