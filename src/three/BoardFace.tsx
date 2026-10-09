import { ft } from "../data/room";
import { CABINET_DOOR_IN } from "../data/ovenTrim";
import type { SurfaceProps } from "./materials";
import { Surface } from "./Surface";

/**
 * A shaker door, in feet: a frame of stiles and rails with a panel recessed
 * inside it, an eighth of an inch of gap to the next door, and the panel set
 * back a quarter.
 */
export const DOOR = {
  thickness: ft(CABINET_DOOR_IN),
  reveal: ft(0.125),
  /** Width of the frame around the panel. */
  rail: ft(2.25),
  /** How far the panel sits behind the face of the frame. */
  recess: ft(0.25),
};

/**
 * The face of a filler or a finished board: one flush strip of board the
 * height of the doors beside it, with no frame, no panel and no reveal at its
 * sides — it closes a gap and does not open, so it butts the door next to it.
 * Round 50 (Leo): these went through `Door`, which on a face too narrow for a
 * frame drew a strip that only looked like this, with a door's gap each side.
 *
 * Round 85: the one way a board's face is drawn. The run's boards draw it
 * (`Strip` in CabinetLayer), and so do the strips a machine draws beside
 * itself where it is narrower than its opening — beside a wall hood, inside a
 * tall unit's opening (`Filler` in ApplianceModel). Those had no face: their
 * front was the carcass line, 3/4" behind the doors either side of them, and
 * they took no shadow, so they read lighter than the cabinets they belong to.
 *
 * `front` is the front of the carcass the face is hung on, in the frame the
 * caller draws in, facing +z; `at` is the face's centre across and up.
 */
export function BoardFace({
  width,
  height,
  front,
  at = [0, 0],
  s,
}: {
  width: number;
  height: number;
  front: number;
  at?: readonly [number, number];
  s: SurfaceProps;
}) {
  const h = height - DOOR.reveal;
  return (
    <mesh
      position={[at[0], at[1], front + DOOR.thickness / 2]}
      castShadow
      receiveShadow
      userData={{ cabinetRole: true }}
    >
      <boxGeometry args={[width, h, DOOR.thickness]} />
      <Surface s={s} size={[width, h]} rotate={Math.PI / 2} />
    </mesh>
  );
}
