import type { CabinetBox } from "./cabinets";
import { axisIndex, onAxis, otherAxis } from "./frame";
import type { LayoutShape, RunId } from "./layoutShape";
import { ft } from "./roomShell";

/**
 * A board closing the back of one of a U's side legs.
 *
 * Leo, 2026-11-12: 「不画墙的那一侧，柜子背面画成一整块板（柜门颜色，3/4" 厚，从地面到那段
 * 最高的柜顶，从后墙到开放端）」; 「背板只在 U 型、墙不画的那一侧出现；L 型和一字型不变」.
 *
 * A U's side walls are not there to look at from outside: the right wall is a
 * line on the floor (U-2), and the left wall is drawn one-sided, so from the
 * front left — the U's view since 2026-11-12 — it is not drawn, and the backs
 * of the left leg's tall units, the machines in them showing, are what is
 * nearest the camera. So each side leg has one, the right's for when the room
 * is turned the other way; the back leg stands against the back wall and has
 * none, and an L and one wall have none.
 *
 * Measured off the leg's own boxes (the stone left out): against the face away
 * from the room, as long as the leg from the back wall to its open end, from
 * the floor to its tallest box. In the leg's door finish, which is the
 * drawing's business (`CabinetLayer`).
 */
export interface BackBoard {
  run: RunId;
  position: [number, number, number];
  size: [number, number, number];
}

export const BACK_BOARD_IN = 0.75;
const SIDE_LEGS: RunId[] = ["left", "right"];

export function legBackBoards(boxes: CabinetBox[], shape: LayoutShape): BackBoard[] {
  if (shape !== "U") return [];
  const thick = ft(BACK_BOARD_IN);
  return SIDE_LEGS.flatMap((run) => {
    const own = boxes.filter((box) => box.run === run && box.kind !== "counter");
    if (own.length === 0) return [];
    // The way the leg faces the room; its back is the other way.
    const { axis, sign } = own[0].facing;
    const out = axisIndex(axis);
    const along = otherAxis(axis);
    const lengthwise = axisIndex(along);
    const near = (box: CabinetBox) => box.position[out] - sign * (box.size[out] / 2);
    // The face away from the room: the furthest back of the leg's boxes.
    const back = sign > 0 ? Math.min(...own.map(near)) : Math.max(...own.map(near));
    const from = Math.min(...own.map((box) => box.position[lengthwise] - box.size[lengthwise] / 2));
    const to = Math.max(...own.map((box) => box.position[lengthwise] + box.size[lengthwise] / 2));
    const top = Math.max(...own.map((box) => box.position[1] + box.size[1] / 2));
    return [
      {
        run,
        position: onAxis(along, (from + to) / 2, back - (sign * thick) / 2, top / 2),
        size: onAxis(along, to - from, thick, top),
      },
    ];
  });
}
