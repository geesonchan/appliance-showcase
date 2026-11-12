/**
 * The back of the U's side legs closed by one board (Leo, 2026-11-12: 「不画墙的那一侧，
 * 柜子背面画成一整块板（柜门颜色，3/4" 厚，从地面到那段最高的柜顶，从后墙到开放端）」;
 * 「背板只在 U 型、墙不画的那一侧出现；L 型和一字型不变」).
 *
 * In a U the side walls are not there to look at from outside: the right wall
 * is a line on the floor (U-2), and the left wall is one-sided, so from the
 * front left — the U's view since 2026-11-12 — it is not drawn, and the backs
 * of the left leg's tall units and the machines in them show. So each side leg
 * gets a board on its back; the back leg, against the back wall, does not; an
 * L and one wall get none.
 *
 * Measured from the cabinet boxes the room is built of, not from the function
 * under test. Reached through the module, so on code without it each case
 * fails on its own.
 */
import { afterAll, describe, expect, it } from "vitest";
import * as boards from "./backBoards";
import { CABINETS, type CabinetBox } from "./cabinets";
import { resetRoom } from "./testRoom";
import { openSharedLink } from "../store/openLink";
import { useAppStore } from "../store/useAppStore";

const OPENED = useAppStore.getState();
const IN = (ft: number) => Math.round(ft * 12 * 1000) / 1000 + 0;
type Board = { run: string; position: [number, number, number]; size: [number, number, number] };
const legBackBoards = (boxes: CabinetBox[], shape: string): Board[] =>
  (boards as unknown as { legBackBoards: (b: CabinetBox[], s: string) => Board[] }).legBackBoards(boxes, shape);

function open(link: string) {
  resetRoom();
  useAppStore.setState(OPENED, true);
  openSharedLink(link);
  return useAppStore.getState().layoutParams.shape;
}

afterAll(() => {
  resetRoom();
  useAppStore.setState(OPENED, true);
});

/** A run's boxes as the board is measured against them: everything but the stone. */
const ownBoxes = (run: string) => CABINETS.filter((box) => box.run === run && box.kind !== "counter");
const extent = (boxes: CabinetBox[], i: 0 | 1 | 2) => [
  Math.min(...boxes.map((b) => b.position[i] - b.size[i] / 2)),
  Math.max(...boxes.map((b) => b.position[i] + b.size[i] / 2)),
];

describe("the backs of the U's side legs (Leo, 2026-11-12)", () => {
  for (const code of ["A", "B", "C", "D", "E"]) {
    it(`${code}: one board on each side leg's back, none on the back leg`, () => {
      const shape = open(`?v=2&pkg=${code}&shape=U&back=132&corner=blind`);
      const made = legBackBoards(CABINETS, shape);
      expect([shape, made.map((b) => b.run).sort()]).toEqual(["U", ["left", "right"]]);
    });
  }

  it("the left leg's: 3/4\" against its outer face, the floor to its tallest box, the back wall to the open end", () => {
    const shape = open("?v=2&pkg=D&shape=U&back=132&left=177&corner=blind");
    const board = legBackBoards(CABINETS, shape).find((b) => b.run === "left")!;
    const own = ownBoxes("left");
    const [outer] = extent(own, 0);
    const [z0, z1] = extent(own, 2);
    const top = Math.max(...own.map((b) => b.position[1] + b.size[1] / 2));
    expect({
      x: [IN(board.position[0] - board.size[0] / 2), IN(board.position[0] + board.size[0] / 2)],
      y: [IN(board.position[1] - board.size[1] / 2), IN(board.position[1] + board.size[1] / 2)],
      z: [IN(board.position[2] - board.size[2] / 2), IN(board.position[2] + board.size[2] / 2)],
    }).toEqual({ x: [IN(outer) - 0.75, IN(outer)], y: [0, IN(top)], z: [IN(z0), IN(z1)] });
  });

  it("the right leg's: the same on its outer face", () => {
    const shape = open("?v=2&pkg=D&shape=U&back=132&left=177&corner=blind");
    const board = legBackBoards(CABINETS, shape).find((b) => b.run === "right")!;
    const own = ownBoxes("right");
    const [, outer] = extent(own, 0);
    expect([IN(board.position[0] - board.size[0] / 2), IN(board.position[0] + board.size[0] / 2)]).toEqual([IN(outer), IN(outer) + 0.75]);
  });

  for (const shape of ["L", "one-wall"]) {
    it(`none in ${shape === "L" ? "an L" : "one wall"}`, () => {
      const opened = open(`?v=2&pkg=D&shape=${shape}`);
      expect([opened, legBackBoards(CABINETS, opened)]).toEqual([shape, []]);
    });
  }
});
