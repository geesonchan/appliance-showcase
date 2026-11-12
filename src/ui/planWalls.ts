import { floorLineWalls } from "../data/room";
import { onAxis, otherAxis } from "../data/frame";

/**
 * The walls the plan thumbnail draws solid beyond the left and back walls the
 * L's runs stand against: in a U the right wall, along its line on the floor
 * (U-2; Leo, 2026-11-11: 「右边面板平面小图里 U 的右墙画成实线：这一轮一起改」).
 * Each a line through two world x/z points; none in an L or on one wall.
 */
export function planWalls(): [number, number][][] {
  return floorLineWalls().map((wall) =>
    [wall.from, wall.to].map((along): [number, number] => {
      const [x, , z] = onAxis(otherAxis(wall.axis), along, wall.at);
      return [x, z];
    }),
  );
}
