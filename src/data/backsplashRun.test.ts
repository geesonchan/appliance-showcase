/**
 * Where the tile behind the cooking surface goes (12a; Leo, 2026-11-15: 「瓷砖挪到炉头所在的
 * 那一段、炉头后面，从台面到上柜底，和 L 型炉头后面的画法一样；后墙上那块不再画」; the width
 * 「按整格，和 L 型现在一样」).
 *
 * In a U it is on the right leg, where every U cooks (112 of 112 rooms in the
 * dumps), behind the range or cooktop's segment, facing into the room — and
 * nowhere on the back wall. In an L and on one wall it is where it has always
 * been: the expected figures there are the drawing's own before 12a
 * (`HOOD_OPENING` on the back run's wall, half an inch off it, not turned).
 *
 * Reached through the module, so on code without `BACKSPLASH` each case fails
 * on its own — the L's and one wall's included, though their figures are the
 * old ones.
 */
import { afterAll, describe, expect, it } from "vitest";
import * as room from "./room";
import { resetRoom } from "./testRoom";
import { openSharedLink } from "../store/openLink";
import { useAppStore } from "../store/useAppStore";

const OPENED = useAppStore.getState();
const IN = (ft: number) => Math.round(ft * 12 * 1000) / 1000 + 0;
type Panel = { run: string; from: number; to: number; position: [number, number, number]; rotationY: number; size: [number, number] };
const panel = () => (room as unknown as { BACKSPLASH: Panel | null | undefined }).BACKSPLASH;

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

/** In inches; which way it faces as [x, z]; its width and height. */
const read = (p: Panel | null | undefined) =>
  p
    ? {
        run: p.run,
        centre: p.position.map(IN),
        facing: [Math.round(Math.sin(p.rotationY)) + 0, Math.round(Math.cos(p.rotationY)) + 0],
        size: p.size.map(IN),
      }
    : p;

const HEIGHT = () => room.ROOM.upperBottom - room.ROOM.counterHeight;

describe("a U's tile: on the right leg behind the cooking surface, none on the back wall (12a)", () => {
  for (const code of ["A", "B", "C", "D", "E"]) {
    for (const back of [132, 156]) {
      it(`${code}, back wall ${back}": on the right leg's wall, the cooking segment's width, facing -x`, () => {
        expect(open(`?v=2&pkg=${code}&shape=U&back=${back}&corner=blind`)).toBe("U");
        const right = room.RUN_BY_ID.right;
        const cooking = right.segments.find((s) => s.slot === "slot-range" || s.slot === "slot-cooktop")!;
        const across = right.centre - right.facing.sign * (room.ROOM.counterDepth / 2) + right.facing.sign * room.ft(0.5);
        expect(read(panel())).toEqual({
          run: "right",
          centre: [IN(across), IN(room.ROOM.counterHeight + HEIGHT() / 2), IN((cooking.from + cooking.to) / 2)],
          facing: [-1, 0],
          size: [IN(cooking.to - cooking.from), 18],
        });
      });
    }
  }
});

describe("an L's and one wall's tile: where it was before 12a", () => {
  const links: string[] = [];
  for (const code of ["A", "B", "C", "D", "E"]) {
    links.push(
      `?v=2&pkg=${code}&shape=L`,
      `?v=2&pkg=${code}&shape=L&back=168`,
      `?v=2&pkg=${code}&shape=one-wall`,
      `?v=2&pkg=${code}&shape=one-wall&back=192`,
    );
  }
  for (const link of links) {
    it(link, () => {
      const shape = open(link);
      expect(shape).toBe(link.includes("one-wall") ? "one-wall" : "L");
      const [from, to] = room.HOOD_OPENING;
      const back = room.RUN_BY_ID.back;
      // The drawing before 12a; nothing where the opening is empty (E's L cooks on the island).
      const before =
        to <= from
          ? null
          : {
              run: "back",
              centre: [
                IN((from + to) / 2),
                IN(room.ROOM.counterHeight + HEIGHT() / 2),
                IN(back.centre - back.facing.sign * (room.ROOM.counterDepth / 2) + back.facing.sign * room.ft(0.5)),
              ],
              facing: [0, 1],
              size: [IN(to - from), 18],
            };
      expect(read(panel())).toEqual(before);
    });
  }
});
