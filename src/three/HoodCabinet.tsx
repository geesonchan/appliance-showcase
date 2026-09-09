import { useMemo } from "react";
import * as THREE from "three";
import { HOOD_CABINET, hoodCabinetParts, type HoodCabinetParts } from "../data/insertHood";
import { ft } from "../data/slots";
import type { CabinetBox } from "../data/cabinets";
import type { SurfaceProps } from "./materials";
import { Surface } from "./Surface";

/**
 * The housing round an insert liner, in the door finish.
 *
 * Three sections, which is how these are actually built: a straight box at the
 * bottom with the liner set into its underside, a four-sided taper gathering in
 * to the flue, and a straight box to the ceiling. A moulding runs along the
 * bottom edge and again at the ceiling, and each sloping face carries a
 * recessed panel — the same detail as a shaker door, because it is the same
 * joiner's answer to the same blank field.
 *
 * Everything is one colour: this is cabinetry, and it is painted with the run
 * it belongs to. The only steel on it is the liner underneath, which is the
 * appliance and is drawn by `ApplianceModel`.
 */
export function HoodCabinet({ box, s }: { box: CabinetBox; s: SurfaceProps }) {
  const [w, h, d] = box.size;
  const parts = useMemo(() => hoodCabinetParts({ w, h, d }), [w, h, d]);
  const taper = useMemo(
    () =>
      frustum(
        parts.taper.bottom.w,
        parts.taper.bottom.d,
        parts.taper.top.w,
        parts.taper.top.d,
        parts.taper.h,
      ),
    [parts],
  );

  const moulding = ft(HOOD_CABINET.mouldingIn);
  const proud = ft(HOOD_CABINET.mouldingProudIn);
  const panelInset = ft(HOOD_CABINET.panelInsetIn);
  const panelDepth = ft(HOOD_CABINET.panelDepthIn);
  // Centred on the box, whose own origin is its middle; every section is
  // placed from the bottom up.
  const y = (at: number) => at - h / 2;

  return (
    <group name="hood-cabinet">
      {/* The bottom box, and the moulding along its lower edge. */}
      <mesh position={[0, y(parts.base.y), 0]} castShadow receiveShadow>
        <boxGeometry args={[parts.base.w, parts.base.h, parts.base.d]} />
        <Surface s={s} size={[parts.base.w, parts.base.h]} />
      </mesh>
      <mesh position={[0, y(moulding / 2), proud / 2]} castShadow>
        <boxGeometry args={[parts.base.w + proud, moulding, parts.base.d + proud]} />
        <Surface s={s} size={[parts.base.w, moulding]} />
      </mesh>

      {/* The taper, with a moulded panel on the front and on each flank: the
          same detail as a shaker door, applied to a face that leans. */}
      {parts.taper.h > 0 && (
        <group position={[0, y(parts.taper.y - parts.taper.h / 2), 0]}>
          <mesh geometry={taper} castShadow receiveShadow>
            <Surface s={s} size={[parts.taper.bottom.w, parts.taper.h]} />
          </mesh>
          {faces(parts.taper).map((face) => (
            <SlopedPanel
              key={face.id}
              face={face}
              inset={panelInset}
              depth={panelDepth}
              s={s}
            />
          ))}
        </group>
      )}

      {/* The top box, and the crown against the ceiling.
          The crown is the same moulding the banks either side carry, in the
          same plane: it runs across the housing and out along the cabinets as
          one line, which is what a crown is for. Its width is the housing's,
          because the housing is what it is standing on. */}
      {parts.crown.h > 0 && (
        <>
          <mesh position={[0, y(parts.crown.y), 0]} castShadow receiveShadow>
            <boxGeometry args={[parts.crown.w, parts.crown.h, parts.crown.d]} />
            <Surface s={s} size={[parts.crown.w, parts.crown.h]} />
          </mesh>
          <mesh
            position={[0, y(h - moulding / 2), (d - parts.crown.d - proud) / 2]}
            castShadow
          >
            <boxGeometry args={[w, moulding, parts.crown.d + proud]} />
            <Surface s={s} size={[w, moulding]} />
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * The three faces that lean: the front and the two flanks.
 *
 * The back is against the wall and has nothing on it. Each face is given as
 * the rectangle a panel can sit in — the trapezoid's narrow end and its slant
 * height — plus where its middle is and which way it leans.
 */
function faces(taper: HoodCabinetParts["taper"]) {
  const rise = taper.h;
  const front = {
    id: "front",
    run: (taper.bottom.d - taper.top.d) / 2,
    width: taper.top.w,
    at: [0, rise / 2, (taper.bottom.d + taper.top.d) / 4] as [number, number, number],
    yaw: 0,
  };
  const flanks = [-1, 1].map((side) => ({
    id: side < 0 ? "left" : "right",
    run: (taper.bottom.w - taper.top.w) / 2,
    width: taper.top.d,
    at: [(side * (taper.bottom.w + taper.top.w)) / 4, rise / 2, 0] as [number, number, number],
    yaw: (side * Math.PI) / 2,
  }));
  return [front, ...flanks].map((face) => ({
    ...face,
    /** The slant height of the face, which is what a panel is fitted into. */
    slant: Math.hypot(rise, face.run),
    /** How far it leans back from vertical. */
    lean: Math.atan2(face.run, rise),
  }));
}

/**
 * A panel on a leaning face: four thin bars standing proud of it.
 *
 * Built as a frame rather than as a recess because that is how it is made —
 * the field is the carcass and the moulding is applied to it — and because a
 * box pushed into a sloping face pokes out of the two beside it.
 */
function SlopedPanel({
  face,
  inset,
  depth,
  s,
}: {
  face: ReturnType<typeof faces>[number];
  inset: number;
  depth: number;
  s: SurfaceProps;
}) {
  const w = Math.max(0, face.width - inset);
  const h = Math.max(0, face.slant - inset);
  if (w <= 0 || h <= 0) return null;
  const bar = Math.min(inset / 3, ft(1));

  return (
    <group position={face.at} rotation={[-face.lean, face.yaw, 0, "YXZ"]}>
      {[
        { p: [0, h / 2 - bar / 2, 0], size: [w, bar, depth] },
        { p: [0, -h / 2 + bar / 2, 0], size: [w, bar, depth] },
        { p: [-w / 2 + bar / 2, 0, 0], size: [bar, h, depth] },
        { p: [w / 2 - bar / 2, 0, 0], size: [bar, h, depth] },
      ].map((rail, i) => (
        <mesh key={i} position={rail.p as [number, number, number]} castShadow>
          <boxGeometry args={rail.size as [number, number, number]} />
          <Surface s={s} size={[rail.size[0], rail.size[1]]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A four-sided taper as a solid, bottom ring to top ring.
 *
 * The same construction as the canopy's: an extrusion can only draw in on one
 * axis, and this draws in on both.
 */
function frustum(
  bottomW: number,
  bottomD: number,
  topW: number,
  topD: number,
  h: number,
): THREE.BufferGeometry {
  const ring = (y: number, w: number, d: number) =>
    [
      [-w / 2, y, -d / 2],
      [w / 2, y, -d / 2],
      [w / 2, y, d / 2],
      [-w / 2, y, d / 2],
    ] as [number, number, number][];

  const low = ring(0, bottomW, bottomD);
  const high = ring(h, topW, topD);
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

  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    quad(low[i], low[j], high[j], high[i]);
  }
  // No cap at either end: the box below and the box above close it, and a face
  // in the same plane as one of theirs is a flicker rather than a surface.

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
