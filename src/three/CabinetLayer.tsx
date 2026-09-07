import { useMemo } from "react";
import * as THREE from "three";
import { CABINETS, CABINET_OUTLINES, type CabinetBox } from "../data/cabinets";
import { counterOutline } from "../data/counter";
import { useIsMobile } from "../hooks/useIsMobile";
import { useAppStore } from "../store/useAppStore";
import { ft } from "../data/room";
import { SCENE_COLORS, finish, type FinishToken, type SurfaceProps } from "./materials";
import { Surface } from "./Surface";
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
  const map = texture(props.map, quality === "high" ? 512 : 256).clone();
  map.needsUpdate = true;
  map.repeat.set(1 / (props.repeatFt ?? 1), 1 / (props.repeatFt ?? 1));
  return map;
}

/**
 * Which finish each kind of carcass is made in.
 *
 * Every box that carries a door is painted, and the paint colour is whatever
 * the finish picker says. The toe kick is not: it is a recessed board nobody
 * chooses a colour for, and painting it the door colour makes the run look
 * like it is standing on a plinth of itself.
 */
const KIND_FINISH: Record<CabinetBox["kind"], FinishToken> = {
  base: "painted",
  tall: "painted",
  surround: "painted",
  upper: "painted",
  counter: "quartz-white",
  toe: "painted",
};

/** How thick a door is, and the gap between one door and the next, in feet. */
const DOOR = { thickness: ft(0.75), reveal: ft(0.125), bevel: ft(0.125) };

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
 * A door on the front of a carcass: a panel, a reveal round it, and a chamfer
 * on its edge.
 *
 * Two layers, because that is what a cabinet is — a box with a slab hung on the
 * front of it. The eighth-inch gap between doors and the eighth-inch chamfer on
 * each edge are what stop a run of cabinets reading as one long extrusion: at
 * this scale they are two pixels each, and they are the two pixels that say
 * where one door stops and the next starts.
 */
function Door({ box, s }: { box: CabinetBox; s: SurfaceProps }) {
  const { axis, width, height } = facing(box);
  const depth = axis === "x" ? box.size[0] : box.size[2];
  const w = width - DOOR.reveal;
  const h = height - DOOR.reveal;
  const front = depth / 2 + DOOR.thickness / 2;

  // A chamfered slab: the panel, and a slightly smaller one proud of it, which
  // reads as a bevelled edge from every angle the room is looked at.
  const panels = [
    { w, h, z: front - DOOR.thickness / 4, depth: DOOR.thickness / 2 },
    {
      w: w - DOOR.bevel * 2,
      h: h - DOOR.bevel * 2,
      z: front + DOOR.thickness / 4,
      depth: DOOR.thickness / 2,
    },
  ];

  return (
    <group
      name={"door-" + box.id}
      rotation={axis === "x" ? [0, Math.PI / 2, 0] : [0, 0, 0]}
    >
      {panels.map((panel, i) => (
        <mesh key={i} position={[0, 0, panel.z]} castShadow receiveShadow>
          <boxGeometry args={[panel.w, panel.h, panel.depth]} />
          <Surface s={s} size={[panel.w, panel.h]} />
        </mesh>
      ))}
    </group>
  );
}

/** The solid carcass, ghosted rather than hidden in install mode. */
function CabinetSolid({ box }: { box: CabinetBox }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const isMobile = useIsMobile();
  const geometry = useBoxGeometry(box.size);
  const paint = useAppStore((s) => s.finishes.cabinet);
  const counter = useAppStore((s) => s.finishes.counter);

  const twoTone = useAppStore((s) => s.finishes.twoToneUppers);
  const token = box.kind === "counter" ? counter : KIND_FINISH[box.kind];
  // One colour through the room unless somebody asks for two. A two-tone
  // kitchen — the picked colour below, a lighter finish above — is a decision
  // a designer makes on purpose, not what "the cabinets are green" means.
  const colour =
    box.kind === "toe"
      ? SCENE_COLORS.toe
      : box.kind === "upper" && twoTone
        ? SCENE_COLORS.cabinetUpper
        : box.kind === "counter"
          ? undefined
          : paint;
  const props = finish(renderMode, token, colour);

  const install = renderMode === "install";
  // On a phone the install view is outline-only; the ghost fill just muddies it.
  const hidden = install && isMobile;
  // A door goes on anything with a front: not the toe kick, which is recessed,
  // and not the countertop, which is a slab.
  const hasDoor =
    !install && box.kind !== "toe" && box.kind !== "counter" && box.size[1] > ft(6);

  return (
    <>
      <mesh
        geometry={geometry}
        visible={!hidden}
        castShadow
        receiveShadow
        userData={{ slot: box.slot, boxId: box.id }}
      >
        <Surface
          s={{ ...props, transparent: install, opacity: install ? GHOST_OPACITY : 1 }}
          size={[box.size[0], box.size[1]]}
        />
      </mesh>
      {hasDoor && <Door box={box} s={props} />}
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
  const geometry = useMemo(() => {
    const { outline, holes, band } = counterOutline();
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
    for (const hole of holes) {
      shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, z))));
    }
    const extruded = new THREE.ExtrudeGeometry(shape, {
      depth: band[1] - band[0],
      bevelEnabled: false,
    });
    // The shape is drawn on the floor plan; stand it up and lift it to height.
    extruded.rotateX(Math.PI / 2);
    extruded.translate(0, band[1], 0);
    return extruded;
  }, []);

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
