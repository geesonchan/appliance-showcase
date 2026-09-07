import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { applianceBox, flushOffset } from "../data/applianceBox";
import { hoodProfile, hoodTopDepthIn } from "../data/hood";
import { RANGE_PROPORTIONS, rangeParts } from "../data/rangeModel";
import { CABINET_STANDARDS, ROOM, SLOT_BY_ID, ft } from "../data/slots";
import { useAppStore } from "../store/useAppStore";
import { useSelection } from "../store/useSelection";
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
          appliance={appliance}
          installType={appliance.installType}
          topDepthIn={hoodTopDepthIn(appliance, box.d * 12)}
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

      {/* Outside the body group on purpose: the height a range is sold at is
          the height of its cooking surface, and the low back rail stands above
          that line, exactly as it does on the drawing. Keeping it out here
          leaves the body's bounding box equal to the published dimensions. */}
      {appliance.category === "range" && (
        <IslandTrim slot={slot} box={box} dz={dz} body={body} />
      )}

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
  /** The record itself: a range reads its own burner count off it. */
  appliance: Appliance;
  installType: string[];
  /** Hoods only: the depth of the flat top of the wedge. */
  topDepthIn: number;
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
function Body({ category, appliance, installType, topDepthIn, w, h, d, body, trim, glass }: BodyProps) {
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

    case "range":
      // A cooktop is a plate in a counter and stays one; a range is a machine
      // with a front, and a customer reads that front.
      return (
        <Range appliance={appliance} w={w} h={h} d={d} body={body} trim={trim} glass={glass} />
      );

    case "hood":
      return (
        <Hood
          installType={installType}
          topDepthIn={topDepthIn}
          w={w}
          h={h}
          d={d}
          body={body}
          glass={glass}
        />
      );

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
 * A pro-style range, drawn the way somebody standing in front of one sees it.
 *
 * Bottom to top: a black toe kick, a drawer front, the oven door with its
 * window and tubular handle, the control fascia with its two banks of knobs
 * either side of a display, then the deck and the cast-iron grates that bring
 * the machine up to its published height. The arrangement comes from
 * `rangeParts`, which is where it can be checked; this only draws it.
 *
 * A freestanding range has finished sides and stands on its own. A slide-in has
 * neither: its sides are unfinished because cabinets close them in, and its
 * cooktop laps an inch over the counter each side of the front.
 */
function Range({
  appliance,
  w,
  h,
  d,
  body,
  trim,
  glass,
}: {
  appliance: Appliance;
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  trim: SurfaceProps;
  glass: SurfaceProps;
}) {
  const parts = useMemo(() => rangeParts(appliance, { w, h, d }), [appliance, w, h, d]);
  const { bands } = parts;
  // Cast iron is nearly matte and nearly black; the oven window is glass over
  // a dark cavity. The rest of the machine is the steel it is sold as.
  const iron = { ...glass, color: "#1C1E1C", metalness: 0.2, roughness: 0.7 };
  const dark = { ...glass, color: "#151715", metalness: 0.1, roughness: 0.8 };

  /** A panel on the front face, given a band and an inset from the sides. */
  const front = (band: readonly [number, number], inset: number) => ({
    y: (band[0] + band[1]) / 2,
    height: band[1] - band[0],
    width: w - inset * 2,
  });

  const carcassTop = bands.deck[1];
  /**
   * A manufacturer's depth is quoted with the handle on, so the carcass is set
   * back by the handle's projection rather than the handle hung off the front.
   * The cooktop keeps the full depth and overhangs the door, which is what a
   * range does.
   */
  const grip = ft(1.5);
  const carcassD = d - grip;
  const carcassZ = -(d - carcassD) / 2;
  const face = carcassZ + carcassD / 2 + 0.002;
  const reveal = ft(0.125);
  const door = front(bands.door, reveal);
  const control = front(bands.control, reveal);
  const plinth = front(bands.plinth, reveal);

  return (
    <group name="range">
      {/* The carcass, up to the deck the grates sit on. */}
      <mesh position={[0, bands.deck[0] / 2, carcassZ]} castShadow receiveShadow>
        <boxGeometry args={[w, bands.deck[0], carcassD]} />
        <Mat s={body} />
      </mesh>
      {/* The deck the grates stand on, at the full published depth: a range's
          cooktop overhangs its door. Steel, not black — the black on a pro
          range is the cast iron sitting on it. */}
      <mesh position={[0, (bands.deck[0] + bands.deck[1]) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, bands.deck[1] - bands.deck[0], d]} />
        <Mat s={trim} />
      </mesh>

      {/* Toe kick, set back so the machine reads as standing on legs. */}
      <mesh position={[0, (bands.toe[0] + bands.toe[1]) / 2, carcassZ - ft(0.5)]}>
        <boxGeometry args={[w - ft(0.5), bands.toe[1] - bands.toe[0], carcassD - ft(1)]} />
        <Mat s={dark} />
      </mesh>

      {/* The drawer front between the toe kick and the oven door. */}
      {plinth.height > ft(1) && (
        <mesh position={[0, plinth.y, face]}>
          <boxGeometry args={[plinth.width, plinth.height - reveal, ft(0.25)]} />
          <Mat s={body} />
        </mesh>
      )}

      {/* Oven door: a panel, a window, and a tubular handle across the top. */}
      <mesh position={[0, door.y, face]}>
        <boxGeometry args={[door.width, door.height - reveal, ft(0.25)]} />
        <Mat s={body} />
      </mesh>
      <mesh position={[0, door.y - door.height * 0.04, face + ft(0.2)]}>
        <boxGeometry
          args={[
            door.width * 0.78,
            door.height * RANGE_PROPORTIONS.windowFraction,
            ft(0.1),
          ]}
        />
        <Mat s={glass} />
      </mesh>

      {/* The handle: a tube on two brackets, the way one is actually mounted.
          Hanging a bar straight off the door face is what makes an appliance
          look like a fridge magnet of itself. */}
      {(() => {
        const handleR = ft(RANGE_PROPORTIONS.handleDiameterIn / 2);
        const handleY = bands.door[1] - ft(2);
        const length = door.width * RANGE_PROPORTIONS.handleFractionOfDoor;
        const bracketZ = (face + (d / 2 - handleR)) / 2;
        return (
          <group name="range-handle">
            <mesh position={[0, handleY, d / 2 - handleR]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[handleR, handleR, length, 14]} />
              <Mat s={trim} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[(side * length) / 2, handleY, bracketZ]}>
                <boxGeometry args={[handleR * 1.4, handleR * 1.4, d / 2 - handleR - face]} />
                <Mat s={trim} />
              </mesh>
            ))}
          </group>
        );
      })()}

      {/* The band between the fascia and the door, which is what stops the
          front of a pro range reading as one flat sheet. */}
      <mesh position={[0, bands.door[1] + ft(RANGE_PROPORTIONS.bandIn) / 2, face + ft(0.15)]}>
        <boxGeometry args={[w, ft(RANGE_PROPORTIONS.bandIn), ft(0.3)]} />
        <Mat s={trim} />
      </mesh>

      {/* Control fascia: two banks of knobs with the display between them. */}
      <mesh position={[0, control.y, face]}>
        <boxGeometry args={[control.width, control.height - reveal, ft(0.25)]} />
        <Mat s={body} />
      </mesh>
      <mesh position={[parts.display.x, parts.display.y, face + ft(0.3)]}>
        <boxGeometry args={[parts.display.w, parts.display.h, ft(0.1)]} />
        <Mat s={dark} />
      </mesh>
      <group name="range-knobs">
        {parts.knobs.map((knob, i) => (
          <mesh
            key={i}
            name={`range-knob-${i}`}
            position={[knob.x, knob.y, face + ft(0.5)]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[knob.r, knob.r * 0.88, ft(1.1), 18]} />
            <Mat s={trim} />
          </mesh>
        ))}
      </group>

      {/* Cast iron over the burners, laid two deep with nothing between them
          but a shadow line. Each grate carries its own bars, because a flat
          black rectangle reads as a hole in the cooktop rather than a trivet. */}
      <group name="range-grates">
        {parts.grates.map((grate, i) => {
          const gap = ft(RANGE_PROPORTIONS.grateGapIn);
          const y = (bands.grate[0] + bands.grate[1]) / 2;
          return (
            <group key={i} name={`range-grate-${i}`} position={[grate.x, y, grate.z]}>
              <mesh castShadow>
                <boxGeometry args={[grate.w - gap, grate.h * 0.45, grate.d - gap]} />
                <Mat s={iron} />
              </mesh>
              {[-0.28, 0, 0.28].map((t) => (
                <mesh key={t} position={[0, grate.h * 0.225, grate.d * t]}>
                  <boxGeometry args={[grate.w - gap, grate.h * 0.55, ft(0.6)]} />
                  <Mat s={iron} />
                </mesh>
              ))}
            </group>
          );
        })}
      </group>

      {/* Finished sides on a freestanding machine; a counter lap on a slide-in.
          The side panels sit inside the envelope, because the width a range is
          sold at is the width with its sides on. */}
      {parts.sides === "finished" &&
        [-1, 1].map((side) => (
          <mesh
            key={side}
            position={[(side * (w - reveal)) / 2, bands.deck[0] / 2, carcassZ]}
            castShadow
          >
            <boxGeometry args={[reveal, bands.deck[0], carcassD - ft(0.5)]} />
            <Mat s={trim} />
          </mesh>
        ))}
      {/* A slide-in laps its cooktop over the counter beside it. That lap is
          outside the published depth on purpose: a slide-in's quoted depth is
          the body, and the overhang is what makes it a slide-in. */}
      {parts.counterLip && (
        <mesh
          position={[0, carcassTop - parts.counterLip.h / 2, d / 2 + parts.counterLip.d / 2]}
        >
          <boxGeometry args={[w, parts.counterLip.h, parts.counterLip.d]} />
          <Mat s={body} />
        </mesh>
      )}
    </group>
  );
}

/**
 * The low back rail behind the cooking surface.
 *
 * Three inches of finished steel, and the one part of a range that stands above
 * the height it is sold at — which is why it is drawn outside the body group
 * rather than inside the published envelope.
 */
function IslandTrim({
  slot,
  box,
  dz,
  body,
}: {
  slot: SlotId;
  box: ReturnType<typeof applianceBox>;
  dz: number;
  body: SurfaceProps;
}) {
  const appliance = useSelection()[slot];
  if (!appliance) return null;
  const parts = rangeParts(appliance, box);
  const depth = parts.islandTrim.d;

  return (
    <mesh
      name={"appliance-trim-" + slot}
      position={[0, box.y + box.h + parts.islandTrim.h / 2, dz - box.d / 2 + depth / 2]}
      castShadow
    >
      <boxGeometry args={[box.w, parts.islandTrim.h, depth]} />
      <Mat s={body} />
    </mesh>
  );
}

/**
 * A ventilation hood, which is four different objects depending on how it is
 * mounted.
 *
 * An under-cabinet hood is a wedge screwed to the underside of a wall cabinet,
 * and drawing a chimney on one is simply wrong — the cabinet is where the
 * chimney would be. A chimney hood carries the same wedge plus a duct cover up
 * the wall, an island hood hangs from the ceiling on a drop, and an insert is
 * buried in joinery so only its intake shows.
 */
function Hood({
  installType,
  topDepthIn,
  w,
  h,
  d,
  body,
  glass,
}: {
  installType: string[];
  topDepthIn: number;
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  glass: SurfaceProps;
}) {
  const kind = installType.find((type) =>
    ["under-cabinet", "wall-mount", "chimney", "island", "insert"].includes(type),
  );

  const canopy = useMemo(
    () => wedgeGeometry(w, h, d, topDepthIn),
    [w, h, d, topDepthIn],
  );

  if (kind === "insert") {
    // Buried in custom joinery: only the opening it needs is worth drawing.
    return (
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w * 0.92, h * 0.9, d * 0.9]} />
        <Mat s={glass} />
      </mesh>
    );
  }

  const outlet = CABINET_STANDARDS.hood.outlet;
  const body_ = (
    <>
      <mesh geometry={canopy} castShadow>
        <Mat s={body} />
      </mesh>
      {/* The intake: baffle filters set into the underside. */}
      <mesh position={[0, ft(0.7), 0]}>
        <boxGeometry args={[w * 0.88, ft(1), d * 0.6]} />
        <Mat s={glass} />
      </mesh>
      {/* The duct opening, set into the flat top rather than standing proud
          of it: it is a hole, and the canopy is 18" to the top of that top. */}
      <mesh position={[0, h - ft(0.4), -d / 2 + ft(outlet.fromWallIn)]}>
        <boxGeometry args={[ft(outlet.widthIn), ft(0.8), ft(outlet.depthIn)]} />
        <Mat s={glass} />
      </mesh>
    </>
  );

  if (kind === "island") {
    // Suspended: a drop to the ceiling rather than a duct cover on a wall.
    const drop = ROOM.wallHeight - h;
    return (
      <group>
        {body_}
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
        {body_}
        <mesh position={[0, h + riser / 2, -d / 2 + topDepthFt(topDepthIn, d) / 2]} castShadow>
          <boxGeometry args={[w * 0.36, riser, topDepthFt(topDepthIn, d) * 0.8]} />
          <Mat s={body} />
        </mesh>
      </group>
    );
  }

  // Under-cabinet: the wedge and nothing else. The wall cabinet above it hides
  // the duct, which is the whole point of the type.
  return <group>{body_}</group>;
}

const topDepthFt = (topDepthIn: number, d: number) => Math.min(ft(topDepthIn), d);

/**
 * The canopy as a solid: the section extruded across the width.
 *
 * The profile is described from the wall outward and from the underside up, so
 * the extrusion comes out lying on its side and has to be turned a quarter turn
 * to face the room.
 */
function wedgeGeometry(w: number, h: number, d: number, topDepthIn: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const profile = hoodProfile(d * 12, topDepthIn, h * 12);
  shape.moveTo(ft(profile[0][0]), ft(profile[0][1]));
  for (const [x, y] of profile.slice(1)) shape.lineTo(ft(x), ft(y));
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  // Profile x runs from the wall toward the room; the extrusion runs across it.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(w / 2, 0, -d / 2);
  return geometry;
}
