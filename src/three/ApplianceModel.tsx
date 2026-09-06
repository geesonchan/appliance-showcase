import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { applianceBox, flushOffset } from "../data/applianceBox";
import { ROOM, SLOT_BY_ID, ft } from "../data/slots";
import { useAppStore } from "../store/useAppStore";
import type { Appliance, Category, SlotId } from "../types";
import { SCENE_COLORS, finishSurface, surface, type SurfaceProps } from "./materials";

export interface ApplianceModelProps {
  slot: SlotId;
  appliance: Appliance;
}

/**
 * A procedural stand-in for one appliance, at the size the appliance actually
 * is.
 *
 * The body comes from the model's own dimensions and the space left over in the
 * opening is drawn as cabinetry, because that is what is there: a 16-5/8"
 * microwave drawer in a 34" opening has a drawer under it, not eleven more
 * inches of microwave.
 *
 * The contract stays narrow — a slot and the appliance in it — so a later
 * milestone can swap the body of this component for a glTF lookup without
 * touching the layers, pins or interaction code around it.
 */
export function ApplianceModel({ slot, appliance }: ApplianceModelProps) {
  const def = SLOT_BY_ID[slot];
  const renderMode = useAppStore((s) => s.renderMode);
  const selectSlot = useAppStore((s) => s.selectSlot);
  const selected = useAppStore((s) => s.selectedSlot === slot);

  const finish = appliance.finish[0];
  const body = finishSurface(renderMode, finish);
  const trim = surface(renderMode, "#8E938D", { metalness: 0.9, roughness: 0.25 });
  const glass = surface(renderMode, "#2B322D", { metalness: 0.3, roughness: 0.1 });
  const cabinet = surface(renderMode, SCENE_COLORS.cabinet, {
    metalness: 0,
    roughness: 0.85,
  });

  const box = applianceBox(def, appliance);
  const dz = flushOffset(def, box.d);

  const outline = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(box.w, box.h, box.d)),
    [box.w, box.h, box.d],
  );

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectSlot(slot);
  };

  return (
    <group
      name={"appliance-" + slot}
      position={def.position}
      rotation={[0, def.rotationY, 0]}
      onClick={handleClick}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      {/* Named apart from the filler so the appliance's own extents can be
          measured — the bounding-box check depends on it. */}
      <group name={"appliance-body-" + slot} position={[0, box.y, dz]}>
        <Body
          category={appliance.category}
          installType={appliance.installType}
          w={box.w}
          h={box.h}
          d={box.d}
          body={body}
          trim={trim}
          glass={glass}
        />
        {selected && (
          <lineSegments geometry={outline} position={[0, box.h / 2, 0]} scale={1.03}>
            <lineBasicMaterial color={SCENE_COLORS.selection} />
          </lineSegments>
        )}
      </group>

      <Filler slot={slot} box={box} surface={cabinet} trim={trim} />
    </group>
  );
}

/**
 * The cabinetry that fills the rest of the opening.
 *
 * A drawer front under a microwave, a panel over a shorter appliance, filler
 * strips beside a narrow one. Drawn in the cabinet finish rather than the
 * appliance's, because that is what the cabinetmaker builds.
 */
function Filler({
  slot,
  box,
  surface: cabinet,
  trim,
}: {
  slot: SlotId;
  box: ReturnType<typeof applianceBox>;
  surface: SurfaceProps;
  trim: SurfaceProps;
}) {
  const def = SLOT_BY_ID[slot];
  const depth = ROOM.counterDepth;
  const front = depth / 2 + 0.01;
  const openingW = ft(def.cutout.w);
  /** Below half an inch there is nothing to build; that is a scribe, not a panel. */
  const MIN = ft(0.5);
  const pieces: React.ReactNode[] = [];

  if (box.filler.below > MIN) {
    pieces.push(
      <group key="below">
        <mesh position={[0, box.filler.below / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[openingW, box.filler.below, depth]} />
          <Mat s={cabinet} />
        </mesh>
        {/* A drawer pull, so it reads as a drawer rather than a blank panel. */}
        <mesh position={[0, box.filler.below * 0.62, front]}>
          <boxGeometry args={[openingW * 0.5, ft(1), ft(1)]} />
          <Mat s={trim} />
        </mesh>
      </group>,
    );
  }
  if (box.filler.above > MIN) {
    pieces.push(
      <mesh
        key="above"
        position={[0, box.y + box.h + box.filler.above / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[openingW, box.filler.above, depth]} />
        <Mat s={cabinet} />
      </mesh>,
    );
  }
  if (box.filler.eachSide > MIN) {
    for (const side of [-1, 1]) {
      pieces.push(
        <mesh
          key={"side" + side}
          position={[side * (box.w / 2 + box.filler.eachSide / 2), box.y + box.h / 2, 0]}
          castShadow
        >
          <boxGeometry args={[box.filler.eachSide, box.h, depth]} />
          <Mat s={cabinet} />
        </mesh>,
      );
    }
  }

  if (pieces.length === 0) return null;
  return <group name={"appliance-filler-" + slot}>{pieces}</group>;
}

/**
 * Keyed on the transparency flag: three.js needs a fresh material when
 * `transparent` flips, not just a property write.
 */
function Mat({ s }: { s: SurfaceProps }) {
  return (
    <meshStandardMaterial
      key={s.transparent ? "ghost" : "solid"}
      color={s.color}
      metalness={s.metalness}
      roughness={s.roughness}
      transparent={s.transparent}
      opacity={s.opacity}
    />
  );
}

interface BodyProps {
  category: Category;
  installType: string[];
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  trim: SurfaceProps;
  glass: SurfaceProps;
}

/**
 * Category-specific massing. Every shape is a primitive; nothing is loaded.
 *
 * Everything is drawn *inside* the published envelope, handles included. A
 * manufacturer's depth is quoted with the handle on, so the carcass is set back
 * by the handle's projection rather than the handle being hung off the front —
 * otherwise every model in the room is an inch or two bigger than its own spec
 * sheet, which is the number this whole app exists to be trusted about.
 */
function Body({ category, installType, w, h, d, body, trim, glass }: BodyProps) {
  /** How far a handle stands off the door face. */
  const grip = ft(1.5);
  const bar = ft(0.9);
  /** Carcass depth, leaving room for the handle inside the envelope. */
  const cd = Math.max(d - grip, d * 0.5);
  /** Centre of the carcass, so its back stays on the envelope's back face. */
  const cz = -(d - cd) / 2;
  /** The door face, and the plane a handle's outer edge stops at. */
  const face = cz + cd / 2 + 0.004;
  const gripZ = d / 2 - bar / 2;

  switch (category) {
    case "refrigerator":
      return (
        <group>
          <mesh position={[0, h / 2, cz]} castShadow>
            <boxGeometry args={[w, h, cd]} />
            <Mat s={body} />
          </mesh>
          {/* french-door seam plus the freezer drawer split */}
          <mesh position={[0, h * 0.72, face]}>
            <boxGeometry args={[ft(0.6), h * 0.55, 0.01]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[0, h * 0.44, face]}>
            <boxGeometry args={[w * 0.98, ft(0.6), 0.01]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[-w * 0.16, h * 0.66, gripZ]}>
            <boxGeometry args={[bar, h * 0.34, bar]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[w * 0.16, h * 0.66, gripZ]}>
            <boxGeometry args={[bar, h * 0.34, bar]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[0, h * 0.2, gripZ]}>
            <boxGeometry args={[w * 0.5, bar, bar]} />
            <Mat s={trim} />
          </mesh>
        </group>
      );

    case "range": {
      // The published height is to the top of the grates, so the carcass stops
      // short and the grates bring it up to the number on the spec sheet.
      const grate = ft(0.8);
      const ch = h - grate;
      return (
        <group>
          <mesh position={[0, ch / 2, cz]} castShadow>
            <boxGeometry args={[w, ch, cd]} />
            <Mat s={body} />
          </mesh>
          <mesh position={[0, ch * 0.38, face]}>
            <boxGeometry args={[w * 0.8, ch * 0.45, 0.01]} />
            <Mat s={glass} />
          </mesh>
          <mesh position={[0, ch * 0.66, gripZ]}>
            <boxGeometry args={[w * 0.92, bar, bar]} />
            <Mat s={trim} />
          </mesh>
          {[-0.3, -0.1, 0.1, 0.3].map((k) => (
            <mesh key={k} position={[w * k, ch * 0.88, face]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[ft(0.9), ft(0.9), ft(0.6), 16]} />
              <Mat s={trim} />
            </mesh>
          ))}
          {/* cast iron grates over four burners */}
          {[
            [-0.24, -0.22],
            [0.24, -0.22],
            [-0.24, 0.2],
            [0.24, 0.2],
          ].map(([bx, bz], i) => (
            <mesh key={i} position={[w * bx, ch + grate / 2, cd * bz + cz]}>
              <cylinderGeometry args={[ft(3.6), ft(3.6), grate, 6]} />
              <Mat s={glass} />
            </mesh>
          ))}
        </group>
      );
    }

    case "hood":
      return <Hood installType={installType} w={w} h={h} d={d} body={body} glass={glass} />;

    case "dishwasher":
      return (
        <group>
          <mesh position={[0, h / 2, cz]} castShadow>
            <boxGeometry args={[w, h, cd]} />
            <Mat s={body} />
          </mesh>
          <mesh position={[0, h * 0.94, gripZ]}>
            <boxGeometry args={[w * 0.9, bar, bar]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[0, h * 0.5, face]}>
            <boxGeometry args={[w * 0.9, h * 0.7, 0.01]} />
            <Mat s={trim} />
          </mesh>
        </group>
      );

    case "wall-oven":
      return (
        <group>
          <mesh position={[0, h / 2, cz]} castShadow>
            <boxGeometry args={[w, h, cd]} />
            <Mat s={body} />
          </mesh>
          <mesh position={[0, h * 0.44, face]}>
            <boxGeometry args={[w * 0.82, h * 0.6, 0.01]} />
            <Mat s={glass} />
          </mesh>
          <mesh position={[0, h * 0.8, gripZ]}>
            <boxGeometry args={[w * 0.9, bar, bar]} />
            <Mat s={trim} />
          </mesh>
        </group>
      );

    case "wine":
      return (
        <group>
          <mesh position={[0, h / 2, cz]} castShadow>
            <boxGeometry args={[w, h, cd]} />
            <Mat s={body} />
          </mesh>
          {/* glass door with shelf lines behind it */}
          <mesh position={[0, h * 0.55, face]}>
            <boxGeometry args={[w * 0.86, h * 0.72, 0.01]} />
            <Mat s={glass} />
          </mesh>
          {[0.32, 0.48, 0.64, 0.8].map((y) => (
            <mesh key={y} position={[0, h * y, face - ft(1)]}>
              <boxGeometry args={[w * 0.8, ft(0.5), 0.01]} />
              <Mat s={trim} />
            </mesh>
          ))}
          <mesh position={[w * 0.38, h * 0.55, gripZ]}>
            <boxGeometry args={[bar, h * 0.5, bar]} />
            <Mat s={trim} />
          </mesh>
        </group>
      );

    case "microwave":
      return (
        <group>
          <mesh position={[0, h / 2, cz]} castShadow>
            <boxGeometry args={[w, h, cd]} />
            <Mat s={body} />
          </mesh>
          {/* A drawer front: one pull across the top of the face. */}
          <mesh position={[0, h * 0.8, gripZ]}>
            <boxGeometry args={[w * 0.9, bar, bar]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[0, h * 0.42, face]}>
            <boxGeometry args={[w * 0.82, h * 0.48, 0.01]} />
            <Mat s={glass} />
          </mesh>
        </group>
      );

    default:
      return (
        <mesh position={[0, h / 2, 0]} castShadow>
          <boxGeometry args={[w, h, d]} />
          <Mat s={body} />
        </mesh>
      );
  }
}

/**
 * A ventilation hood, which is four different objects depending on how it is
 * mounted.
 *
 * An under-cabinet hood is a flat canopy screwed to the underside of a wall
 * cabinet, and drawing a chimney on one is simply wrong — the cabinet is where
 * the chimney would be. A chimney hood carries its own duct cover up the wall,
 * an island hood hangs from the ceiling on a drop, and an insert is buried in
 * joinery so only its intake shows.
 */
function Hood({
  installType,
  w,
  h,
  d,
  body,
  glass,
}: {
  installType: string[];
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  glass: SurfaceProps;
}) {
  const kind = installType.find((type) =>
    ["under-cabinet", "wall-mount", "chimney", "island", "insert"].includes(type),
  );
  // The intake: baffle filters set into the underside of the canopy.
  const filters = (
    <mesh position={[0, ft(0.7), 0]}>
      <boxGeometry args={[w * 0.88, ft(1), d * 0.8]} />
      <Mat s={glass} />
    </mesh>
  );

  if (kind === "insert") {
    // Buried in custom joinery: only the opening it needs is worth drawing.
    return (
      <group>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w * 0.92, h * 0.9, d * 0.9]} />
          <Mat s={glass} />
        </mesh>
      </group>
    );
  }

  const canopy = (
    <mesh position={[0, h / 2, 0]} castShadow>
      <boxGeometry args={[w, h, d]} />
      <Mat s={body} />
    </mesh>
  );

  if (kind === "island") {
    // Suspended: a drop to the ceiling rather than a duct cover on a wall.
    const drop = ROOM.wallHeight - h;
    return (
      <group>
        {canopy}
        {filters}
        <mesh position={[0, h + drop / 2, 0]}>
          <boxGeometry args={[w * 0.2, drop, d * 0.2]} />
          <Mat s={body} />
        </mesh>
      </group>
    );
  }

  if (kind === "wall-mount" || kind === "chimney") {
    // The duct cover runs from the top of the canopy to the ceiling.
    const riser = ROOM.wallHeight - ROOM.counterHeight - ft(30) - h;
    return (
      <group>
        {canopy}
        {filters}
        <mesh position={[0, h + riser / 2, -d * 0.3]} castShadow>
          <boxGeometry args={[w * 0.36, riser, d * 0.36]} />
          <Mat s={body} />
        </mesh>
      </group>
    );
  }

  // Under-cabinet: the canopy and nothing else. The wall cabinet above it
  // hides the duct, which is the whole point of the type.
  return (
    <group>
      {canopy}
      {filters}
    </group>
  );
}
