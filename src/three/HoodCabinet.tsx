import { useMemo } from "react";
import * as THREE from "three";
import {
  HOOD_CABINET,
  HOUSING_STYLES,
  hoodCabinetParts,
  type HoodCabinetParts,
} from "../data/insertHood";
import { ft } from "../data/slots";
import type { CabinetBox } from "../data/cabinets";
import type { SurfaceProps } from "./materials";
import { Surface } from "./Surface";

/**
 * The housing round an insert liner, in the door finish.
 *
 * Two shapes, and the parameter picks which. A box is a straight breast: one
 * plane from the band to the top line, boarded in shiplap, as deep as the base
 * run below it. A sweep is the same box at the bottom under a face that curves
 * up and in to a narrow flue. Both carry a band along the lower edge in a
 * finish of its own — the strap of oak under a painted breast that half of
 * these are built with — and a moulding at the ceiling.
 *
 * The only steel on either is the liner underneath, which is the appliance and
 * is drawn by `ApplianceModel`.
 */
export function HoodCabinet({
  box,
  s,
  band,
}: {
  box: CabinetBox;
  s: SurfaceProps;
  /** The band's own finish, which is usually not the door's. */
  band: SurfaceProps;
}) {
  const [w, h, d] = box.size;
  const style = box.module?.housing ?? "box";
  const parts = useMemo(() => hoodCabinetParts({ w, h, d }, style), [w, h, d, style]);
  const cove = useMemo(() => (parts.cove.h > 0 ? shell(parts.cove.rings) : null), [parts]);

  const moulding = ft(HOOD_CABINET.mouldingIn);
  const proud = ft(HOOD_CABINET.mouldingProudIn);
  // Centred on the box, whose own origin is its middle; every section is
  // placed from the bottom up.
  const y = (at: number) => at - h / 2;

  return (
    <group name="hood-cabinet">
      {/* The bottom box, which the liner hangs in. */}
      <mesh position={[0, y(parts.base.y), 0]} castShadow receiveShadow>
        <boxGeometry args={[parts.base.w, parts.base.h, parts.base.d]} />
        <Surface s={s} size={[parts.base.w, parts.base.h]} />
      </mesh>

      {/* The band along its lower edge: its own finish, standing proud of the
          face and flush with the flanks, where a cabinet is against it. */}
      <mesh position={[0, y(parts.band.y), parts.band.z]} castShadow receiveShadow>
        <boxGeometry args={[parts.band.w, parts.band.h, parts.band.d]} />
        <Surface s={band} size={[parts.band.w, parts.band.h]} />
      </mesh>

      {/* A boarded front, where the shape has one: horizontal lengths with a
          shadow line between them, which is what shiplap is. */}
      <Boards parts={parts} box={[w, h, d]} s={s} />

      {/* The curve, where the shape has one. */}
      {cove && (
        <group position={[0, y(parts.cove.y), 0]}>
          <mesh geometry={cove} castShadow receiveShadow>
            <Surface s={s} size={[parts.base.w, parts.cove.h]} />
          </mesh>
        </group>
      )}

      {/* The top box, and the crown against the ceiling.
          The crown is the same moulding the banks either side carry, at the
          same height: what a customer sees along the top of that wall is one
          line that steps forward where the breast does. */}
      {parts.crown.h > 0 && (
        <>
          <mesh position={[0, y(parts.crown.y), parts.crown.z]} castShadow receiveShadow>
            <boxGeometry args={[parts.crown.w, parts.crown.h, parts.crown.d]} />
            <Surface s={s} size={[parts.crown.w, parts.crown.h]} />
          </mesh>
          <mesh
            position={[0, y(h - moulding / 2), (parts.top.d + proud - d) / 2]}
            castShadow
          >
            <boxGeometry args={[parts.top.w, moulding, parts.top.d + proud]} />
            <Surface s={s} size={[parts.top.w, moulding]} />
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * The shadow lines across a boarded front.
 *
 * Shiplap is boards laid flat with a groove where two of them meet, and what
 * you see of it from across a room is that groove repeating. It is drawn as a
 * thin length standing proud rather than as a rebate cut into the face,
 * because a rebate is two more faces to draw for a line a quarter of an inch
 * wide — and because at this scale the shadow is the whole of the detail.
 *
 * Only the front. The flanks of a housing are against a cabinet or a tower
 * more often than not, and boarding a face nobody sees is meshes for nothing.
 */
function Boards({
  parts,
  box,
  s,
}: {
  parts: HoodCabinetParts;
  box: [number, number, number];
  s: SurfaceProps;
}) {
  const [, h, d] = box;
  const boardIn = HOUSING_STYLES[parts.style].boardIn;
  const seams = useMemo(() => {
    if (boardIn <= 0) return [];
    const board = ft(boardIn);
    const from = parts.band.h;
    const to = parts.base.h + parts.cove.h + parts.crown.h;
    const out: number[] = [];
    for (let at = from + board; at < to - board / 2; at += board) out.push(at);
    return out;
  }, [boardIn, parts]);

  if (seams.length === 0) return null;
  // A fine line, but not so fine it disappears: the groove reads from across
  // the room as the shadow under the board above it.
  const line = ft(0.75);
  const stand = ft(0.25);

  return (
    <>
      {seams.map((at) => (
        <mesh key={at} position={[0, at - h / 2, (d + stand) / 2]} castShadow>
          <boxGeometry args={[parts.base.w, line, stand]} />
          <Surface s={s} size={[parts.base.w, line]} />
        </mesh>
      ))}
    </>
  );
}

/**
 * A stack of rectangular rings as a solid, bottom to top.
 *
 * The same construction the canopy's taper uses, repeated: an extrusion can
 * only draw in on one axis, and a cove draws in on both, along a curve. No cap
 * at either end — the box below and the box above close it, and a face in the
 * same plane as one of theirs is a flicker rather than a surface.
 */
function shell(
  rings: { y: number; w: number; d: number; z: number }[],
): THREE.BufferGeometry {
  const corners = ({ y, w, d, z }: { y: number; w: number; d: number; z: number }) =>
    [
      [-w / 2, y, z - d / 2],
      [w / 2, y, z - d / 2],
      [w / 2, y, z + d / 2],
      [-w / 2, y, z + d / 2],
    ] as [number, number, number][];

  const positions: number[] = [];
  const push = (p: [number, number, number]) => positions.push(p[0], p[1], p[2]);
  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    e: [number, number, number],
  ) => {
    push(a);
    push(b);
    push(c);
    push(a);
    push(c);
    push(e);
  };

  // Wound so the outside of the shell is the front face. The other way round
  // renders the inside of the hood at the viewer: the near faces are culled,
  // and what shows through the gap is the liner that is meant to be up inside
  // it. That is what the housing had been doing since it was a taper.
  for (let level = 1; level < rings.length; level += 1) {
    const low = corners(rings[level - 1]);
    const high = corners(rings[level]);
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      quad(low[j], low[i], high[i], high[j]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
