import { useMemo } from "react";
import * as THREE from "three";
import {
  CABINETS,
  CABINET_OUTLINES,
  type CabinetBox,
  diagonalDoor,
  wearsDoorFinish,
} from "../data/cabinets";
import { counterOutline } from "../data/counter";
import { RUNS } from "../data/room";
import { useSelection } from "../store/useSelection";
import { useIsMobile } from "../hooks/useIsMobile";
import { cabinetPaint, useAppStore } from "../store/useAppStore";
import { ft } from "../data/room";
import { SCENE_COLORS, finish, type SurfaceProps } from "./materials";
import { Surface } from "./Surface";
import { HoodCabinet } from "./HoodCabinet";
import { texture } from "./textures";

/**
 * The slab's own map.
 *
 * An extruded shape carries UVs in world units, so the stone tiles itself at
 * the right size with no repeat to set — which is the one place the shared
 * `Surface` component does not fit.
 */
function counterMap(props: SurfaceProps, quality: "high" | "low") {
  if (!props.map) return null;
  // Not marked dirty: the clone shares an already-uploaded source, and saying
  // otherwise costs a texture upload for nothing. See `Surface`.
  const map = texture(props.map, quality === "high" ? 512 : 256).clone();
  map.repeat.set(1 / (props.repeatFt ?? 1), 1 / (props.repeatAcrossFt ?? props.repeatFt ?? 1));
  return map;
}

/**
 * A shaker door, in feet: a frame of stiles and rails with a panel recessed
 * inside it, an eighth of an inch of gap to the next door, and the panel set
 * back a quarter.
 */
const DOOR = {
  thickness: ft(0.75),
  reveal: ft(0.125),
  /** Width of the frame around the panel. */
  rail: ft(2.25),
  /** How far the panel sits behind the face of the frame. */
  recess: ft(0.25),
};

/** Opacity of the ghosted carcass behind the install wireframe. */
const GHOST_OPACITY = 0.06;
/** Wireframe opacity on a phone, where the lines otherwise crowd each other. */
const MOBILE_WIRE_OPACITY = 0.25;

function useBoxGeometry(size: [number, number, number]) {
  return useMemo(() => new THREE.BoxGeometry(size[0], size[1], size[2]), [size]);
}

/**
 * Which way a box's door faces, and how wide that face is.
 *
 * The perimeter runs are against the -X and -Z walls, so a box on the left run
 * is deeper across x than along z and opens toward +x; a box on the back run
 * does the opposite. The island opens toward the room. Working it out from the
 * box's own proportions rather than carrying an axis on every box keeps the
 * generator from having to know which way a door swings.
 */
function facing(box: CabinetBox): { axis: "x" | "z"; sign: 1; width: number; height: number } {
  const alongZ = box.size[0] < box.size[2];
  return {
    axis: alongZ ? "x" : "z",
    sign: 1,
    width: alongZ ? box.size[2] : box.size[0],
    height: box.size[1],
  };
}

/**
 * A shaker door: a frame with a panel recessed inside it.
 *
 * Two layers, because that is what a cabinet door is. The eighth-inch gap
 * between doors is what stops a run reading as one long extrusion — at this
 * scale it is two pixels, and it is the two pixels that say where one door
 * stops and the next starts.
 *
 * The grain matters as much as the shape. On a real door the stiles run with
 * its height and the rails run across, so the frame here takes the map one way
 * and the panel inside it the other. On a painted door none of that shows,
 * which is the point of a token: the same geometry, a different finish.
 */
function Door({ box, s }: { box: CabinetBox; s: SurfaceProps }) {
  const { axis, width, height } = facing(box);
  const depth = axis === "x" ? box.size[0] : box.size[2];
  const w = width - DOOR.reveal;
  const h = height - DOOR.reveal;
  const front = depth / 2 + DOOR.thickness / 2;

  // The panel only exists if there is a door big enough to have one.
  const panel: [number, number] = [
    Math.max(0, w - DOOR.rail * 2),
    Math.max(0, h - DOOR.rail * 2),
  ];

  return (
    <group
      name={"door-" + box.id}
      rotation={axis === "x" ? [0, Math.PI / 2, 0] : [0, 0, 0]}
    >
      {/* The frame: stiles up the sides, rails across. Drawn as one slab, with
          its grain running across, because that is the rails' direction and the
          rails are what meets the eye at the top and bottom of a run. */}
      <mesh position={[0, 0, front]} castShadow receiveShadow userData={{ cabinetRole: true }}>
        <boxGeometry args={[w, h, DOOR.thickness]} />
        <Surface s={s} size={[w, h]} rotate={0} />
      </mesh>

      {/* The panel, set back inside the frame, its grain running up the door. */}
      {panel[0] > 0 && panel[1] > 0 && (
        <mesh
          position={[0, 0, front + DOOR.thickness / 2 - DOOR.recess]}
          receiveShadow
          userData={{ cabinetRole: true }}
        >
          <boxGeometry args={[panel[0], panel[1], DOOR.thickness / 2]} />
          <Surface s={s} size={[panel[0], panel[1]]} rotate={Math.PI / 2} />
        </mesh>
      )}
    </group>
  );
}

/**
 * The door across a corner susan, set diagonally.
 *
 * Same two layers as any other door — a frame and a recessed panel — turned
 * forty-five degrees and cut to the chord. What is behind it is the square
 * carcass, which is what a corner susan actually is: drawing two flat fronts
 * meeting at a right angle draws a box nobody sells.
 */
function CornerDoor({
  box,
  door,
  s,
}: {
  box: CabinetBox;
  door: NonNullable<ReturnType<typeof diagonalDoor>>;
  s: SurfaceProps;
}) {
  const w = door.width - DOOR.reveal;
  const h = box.size[1] - DOOR.reveal;
  const panel: [number, number] = [
    Math.max(0, w - DOOR.rail * 2),
    Math.max(0, h - DOOR.rail * 2),
  ];

  return (
    <group
      name={"corner-door-" + box.id}
      position={[door.x, 0, door.z]}
      rotation={[0, door.rotationY, 0]}
    >
      <mesh
        position={[0, 0, DOOR.thickness / 2]}
        castShadow
        receiveShadow
        userData={{ cabinetRole: true }}
      >
        <boxGeometry args={[w, h, DOOR.thickness]} />
        <Surface s={s} size={[w, h]} rotate={0} />
      </mesh>
      {panel[0] > 0 && panel[1] > 0 && (
        <mesh
          position={[0, 0, DOOR.thickness - DOOR.recess]}
          receiveShadow
          userData={{ cabinetRole: true }}
        >
          <boxGeometry args={[panel[0], panel[1], DOOR.thickness / 2]} />
          <Surface s={s} size={[panel[0], panel[1]]} rotate={Math.PI / 2} />
        </mesh>
      )}
    </group>
  );
}

/** The solid carcass, ghosted rather than hidden in install mode. */
function CabinetSolid({ box }: { box: CabinetBox }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const isMobile = useIsMobile();
  const geometry = useBoxGeometry(box.size);
  const finishes = useAppStore((s) => s.finishes);
  const counter = finishes.counter;

  // A kitchen is finished by the run, not by the shelf: the accent colour goes
  // on one whole leg or on the island — wall cabinets, base cabinets and towers
  // together. See docs/decisions.md D15.
  const door = cabinetPaint(finishes, box.run);
  const token =
    box.kind === "counter" ? counter : box.kind === "toe" ? "painted" : door.token;
  // One colour through the room unless somebody asks for two. A two-tone
  // kitchen — the picked colour below, a lighter finish above — is a decision
  // a designer makes on purpose, not what "the cabinets are green" means.
  const colour =
    box.kind === "toe" ? SCENE_COLORS.toe : box.kind === "counter" ? undefined : door.colour;
  const props = finish(renderMode, token, colour);

  const install = renderMode === "install";
  // On a phone the install view is outline-only; the ghost fill just muddies it.
  const hidden = install && isMobile;
  // A door goes on anything with a front: not the toe kick, which is recessed,
  // and not the countertop, which is a slab.
  const hasDoor =
    !install && box.kind !== "toe" && box.kind !== "counter" && box.size[1] > ft(6);
  // A corner susan wears one door across the corner rather than a flat front
  // on each leg. See docs/reference/lazy-susan-corner.svg.
  const corner = useMemo(() => diagonalDoor(box), [box]);

  // The housing round an insert liner is cabinetry with a shape of its own:
  // three sections rather than a box, and no door on any of them. It is
  // painted with the run like everything else here.
  if (box.module?.kind === "hood-cabinet") {
    return (
      <group
        userData={{ slot: box.slot, boxId: box.id, cabinetRole: true }}
        visible={!hidden}
      >
        <HoodCabinet
          box={box}
          s={{ ...props, transparent: install, opacity: install ? GHOST_OPACITY : 1 }}
        />
      </group>
    );
  }

  return (
    <>
      <mesh
        geometry={geometry}
        visible={!hidden}
        castShadow
        receiveShadow
        userData={{ slot: box.slot, boxId: box.id, cabinetRole: wearsDoorFinish(box.kind) }}
      >
        <Surface
          s={{ ...props, transparent: install, opacity: install ? GHOST_OPACITY : 1 }}
          size={[box.size[0], box.size[1]]}
        />
      </mesh>
      {hasDoor && (corner ? <CornerDoor box={box} door={corner} s={props} /> : <Door box={box} s={props} />)}
    </>
  );
}

/**
 * Carcass edges. Kept mounted and toggled by `visible`, so entering install
 * mode costs no geometry or object construction.
 */
function CabinetWireframe({ box, faint }: { box: CabinetBox; faint: boolean }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const geometry = useBoxGeometry(box.size);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <lineSegments
      geometry={edges}
      position={box.position}
      visible={renderMode === "install"}
      userData={{ slot: box.slot }}
      // Opt out of raycasting entirely. Line raycasts use a threshold measured
      // in world units (a whole foot at this scale), so leaving these in the
      // occlusion test hides pins that nothing actually covers.
      raycast={() => null}
    >
      <lineBasicMaterial
        key={faint ? "faint" : "solid"}
        color={SCENE_COLORS.wireframe}
        transparent={faint}
        opacity={faint ? MOBILE_WIRE_OPACITY : 1}
      />
    </lineSegments>
  );
}

/**
 * The countertop: one slab, turning the corner.
 *
 * Extruded from a single L-shaped polygon with the range and the sink cut
 * through it, rather than a box per run. Two boxes meeting at a corner leave
 * the square between them to nobody, which is exactly what the room used to
 * show; a fabricator makes one piece and so does this.
 */
function CounterSlab() {
  const renderMode = useAppStore((s) => s.renderMode);
  const quality = useAppStore((s) => s.quality);
  // The range is part of the slab's shape, not something laid on top of it: a
  // freestanding machine is a hole right through and a slide-in is a hole with
  // an inch of stone left at the front for its cooktop to lap over.
  const range = useSelection()["slot-range"];
  const geometry = useMemo(() => {
    const { pieces, band } = counterOutline(RUNS, range);
    // One extrusion for all of them: a freestanding range cuts the run into two
    // slabs, and they are still one countertop as far as the scene is concerned
    // — one geometry, one material, one shadow.
    const shapes = pieces.map(({ outline, holes }) => {
      const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
      for (const hole of holes) {
        shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, z))));
      }
      return shape;
    });
    const extruded = new THREE.ExtrudeGeometry(shapes, {
      depth: band[1] - band[0],
      bevelEnabled: false,
    });
    // The shape is drawn on the floor plan; stand it up and lift it to height.
    extruded.rotateX(Math.PI / 2);
    extruded.translate(0, band[1], 0);
    return extruded;
  }, [range]);

  const token = useAppStore((s) => s.finishes.counter);
  const props = finish(renderMode, token);
  const install = renderMode === "install";
  // Memoised: each call clones a texture, and a clone made every render is a
  // clone leaked every render.
  const map = useMemo(
    () => counterMap(props, quality),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.map, props.repeatFt, quality],
  );

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {/* Double-sided: the slab is an extrusion with holes cut through it, and
          the inside of a sink cutout is a face you can see. */}
      <meshStandardMaterial
        key={`${renderMode}-${token}`}
        color={props.color}
        metalness={props.metalness}
        roughness={props.roughness}
        map={map}
        transparent={install}
        opacity={install ? GHOST_OPACITY : 1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * The cabinetry layer. It is always mounted; `showCabinets` only toggles
 * visibility and render mode only changes materials, so neither rebuilds the
 * scene graph.
 *
 * The wireframe has two forms. On a desktop it traces every carcass, which is
 * what you want when reading clearances. On a phone that resolves to a thicket
 * of lines, so it falls back to `CABINET_OUTLINES`: trim omitted and each
 * multi-piece volume collapsed to its outer box.
 */
export function CabinetLayer() {
  const showCabinets = useAppStore((s) => s.showCabinets);
  const isMobile = useIsMobile();
  const wireBoxes = isMobile ? CABINET_OUTLINES : CABINETS;

  return (
    <group name="cabinet-layer" visible={showCabinets}>
      <CounterSlab />
      {CABINETS.map((box) => (
        <group key={box.id} position={box.position} userData={{ slot: box.slot }}>
          <CabinetSolid box={box} />
        </group>
      ))}
      {wireBoxes.map((box) => (
        <CabinetWireframe key={"wire-" + box.id} box={box} faint={isMobile} />
      ))}
    </group>
  );
}
