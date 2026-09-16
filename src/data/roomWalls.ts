import { ROOM } from "./roomShell";
import { alongOf, onAxis, otherAxis, type Axis, type Facing } from "./frame";

/**
 * Where the room's walls are, in a facing's terms. `frame.ts`'s other half.
 *
 * Round 52, D22 step 3. This is the second half of the round-49 sweep: not the
 * places that wrote a turn out by hand, but the places that wrote `-ROOM.halfZ`
 * where "the wall behind this machine" was meant. The two are spelled the same,
 * and they agree for every machine on the back run — which is every machine the
 * app can build today — so nothing showed. `orientationGuard.test.ts` holds the
 * rest of `src` to asking here instead.
 *
 * A module of its own rather than the bottom of `frame.ts` for one reason:
 * `frame.ts` cannot import the room. `roomShell` pulls in `layoutPolicy`, which
 * parses the rules file, which reaches `frame` again, and the cycle leaves the
 * parser undefined at load. Everything about *which way* a thing faces stays in
 * `frame.ts`; this is the one module that also knows how big the room is.
 */

/**
 * A wall as a plane: which axis it is perpendicular to, and where it stands.
 *
 * `axis` is the axis a machine facing away from it faces along, and `at` is that
 * coordinate. The back wall is `{ axis: "z", at: -halfZ }`; the left wall is
 * `{ axis: "x", at: -halfX }`.
 */
export interface Wall {
  axis: Axis;
  at: number;
}

/**
 * The wall behind something that faces a given way.
 *
 * Round 52, D22 step 3. This is the second half of the round-49 sweep: not the
 * places that wrote a turn out by hand, but the places that wrote `-ROOM.halfZ`
 * as if "behind" and "the back wall" were the same thing. They are the same
 * thing for a machine on the back run and for nothing else, and the guard
 * cannot see the difference — a room coordinate is spelled the same whether it
 * is the wall a machine backs onto or the far end of the floor. So the rule is
 * that this module is the only one that turns a facing into a wall, and the
 * guard holds every other file to reading the room's size for something else.
 *
 * It is written in the facing's terms rather than the room's, so it holds for a
 * run that is not one of today's two: a machine facing -z backs onto +halfZ.
 */
export function wallBehind(facing: Facing): Wall {
  const half = facing.axis === "x" ? ROOM.halfX : ROOM.halfZ;
  return { axis: facing.axis, at: -facing.sign * half };
}

/**
 * The point on the wall behind a thing, `standoff` out from the wall's face.
 *
 * Level with the thing along the wall and against the wall across it, which is
 * where a trunk runs and where a duct through the wall goes. The standoff is
 * measured into the room, so it is the same figure whichever wall it is.
 */
export function againstWall(
  facing: Facing,
  x: number,
  z: number,
  standoff = 0,
): { wall: Wall; x: number; z: number } {
  const wall = wallBehind(facing);
  // The wall runs along the other axis: a point on it is how far along it the
  // thing stands, and the wall's own coordinate across.
  const strip = otherAxis(wall.axis);
  const [wx, , wz] = onAxis(strip, alongOf(strip, x, z), wall.at + facing.sign * standoff);
  return { wall, x: wx, z: wz };
}
