import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { applianceBox, doorOverhang, flushOffset, isRangetop } from "../data/applianceBox";
import {
  coffeeParts,
  comboOvenParts,
  doubleOvenParts,
  isCombo,
  isColumn,
  isDouble,
  wineColumnParts,
} from "../data/columnModel";
import {
  CHIMNEY,
  HOOD_PROFILE,
  canopySolid,
  chimneyParts,
  hoodProfile,
  hoodTopDepthIn,
} from "../data/hood";
import { fridgeParts, fridgeSeams, fridgeStance } from "../data/fridgeModel";
import {
  FREESTANDING_PROPORTIONS,
  RANGE_PROPORTIONS,
  rangeParts,
} from "../data/rangeModel";
import { Surface } from "./Surface";
import { CABINET_STANDARDS, ROOM, SLOT_BY_ID, ft } from "../data/slots";
import { hingeAwayFrom, trimKitBeside, trimKitsBeside } from "../data/room";
import { runForSlot } from "../data/room";
import { cabinetPaint, useAppStore } from "../store/useAppStore";
import { useSelection } from "../store/useSelection";
import type { Appliance, Category, SlotId } from "../types";
import {
  SCENE_COLORS,
  finish,
  finishSurface,
  isPanelReady,
  surface,
  tint,
  type SurfaceProps,
} from "./materials";

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

  // The joinery around this appliance, in the finish of the run it stands in —
  // which is what the panels filling its opening are made of, and what a
  // panel-ready machine's own front is.
  const finishes = useAppStore((s) => s.finishes);
  const door = cabinetPaint(finishes, runForSlot(slot));
  const cabinetSurface = finish(renderMode, door.token, door.colour);

  // A panel-ready machine wears the cabinet's door, because that is what it is
  // sold as: no front of its own, and the joiner hangs the same one on it as on
  // the cabinet beside it. Change the kitchen's colour and it changes with it.
  const panelReady = isPanelReady(appliance.finish);
  const body = panelReady ? cabinetSurface : finishSurface(renderMode, appliance.finish[0]);
  // Handles, knobs, rails and glass. Marked as hardware so that a panel-ready
  // machine — whose whole front is cabinetry — does not count its own handle
  // as a cabinet finish.
  const trim = { ...surface(renderMode, "#8E938D", { metalness: 0.9, roughness: 0.25 }), hardware: true };
  const glass = { ...surface(renderMode, "#2B322D", { metalness: 0.3, roughness: 0.1 }), hardware: true };

  const box = applianceBox(def, appliance);
  const dz = flushOffset(def, box.d, box.rearSpacerIn);

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
      {/* A panel-ready machine's own fronts are cabinetry: they are the same
          door the joiner hangs on the box beside it, so they answer to the
          same rule about which colour a run is in. */}
      <group
        name={"appliance-body-" + slot}
        position={[0, box.y, dz]}
        userData={{ cabinetRole: panelReady }}
      >
        <Body
          slot={slot}
          category={appliance.category}
          appliance={appliance}
          installType={appliance.installType}
          topDepthIn={hoodTopDepthIn(appliance, box.d * 12)}
          baseY={def.position[1] + box.y}
          faceZ={ROOM.counterDepth / 2 - dz}
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

      <Filler slot={slot} box={box} surface={cabinetSurface} trim={trim} />
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
        <mesh
          position={[0, box.filler.below / 2, 0]}
          castShadow
          receiveShadow
          userData={{ cabinetRole: true }}
        >
          <boxGeometry args={[openingW, box.filler.below, depth]} />
          <Mat s={cabinet} size={[openingW, box.filler.below]} />
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
        userData={{ cabinetRole: true }}
      >
        <boxGeometry args={[openingW, box.filler.above, depth]} />
        <Mat s={cabinet} size={[openingW, box.filler.above]} />
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
          userData={{ cabinetRole: true }}
        >
          <boxGeometry args={[box.filler.eachSide, box.h, depth]} />
          <Mat s={cabinet} size={[box.filler.eachSide, box.h]} />
        </mesh>,
      );
    }
  }

  if (pieces.length === 0) return null;
  return <group name={"appliance-filler-" + slot}>{pieces}</group>;
}

/**
 * An appliance's material.
 *
 * Delegates to the shared `Surface`, so a panel-ready machine wearing an oak
 * cabinet door gets the same grain the cabinet does. `size` is the face the
 * material lands on, in feet, which is what keeps that grain the same size on a
 * dishwasher front as on the door beside it.
 */
function Mat({ s, size }: { s: SurfaceProps; size?: [number, number] }) {
  return <Surface s={s} size={size} />;
}

interface BodyProps {
  /** Which opening it stands in: a column needs to know what stands beside it. */
  slot: SlotId;
  category: Category;
  /** The record itself: a range reads its own burner count off it. */
  appliance: Appliance;
  installType: string[];
  /** Hoods only: the depth of the flat top of the wedge. */
  topDepthIn: number;
  /** Where the appliance's own bottom sits above the floor, in feet. */
  baseY: number;
  /**
   * The cabinet face, in the body's own coordinates.
   *
   * Only a rangetop needs it: its control panel is dimensioned from the front
   * of the cabinetry under it rather than from anything on the machine.
   */
  faceZ: number;
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
function Body({
  slot,
  category,
  appliance,
  installType,
  topDepthIn,
  baseY,
  faceZ,
  w,
  h,
  d,
  body,
  trim,
  glass,
}: BodyProps) {
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
    // A freezer column is a refrigerator column with a colder inside: the same
    // steel door on the same grille, which is what a customer sees of either.
    case "refrigerator":
    case "freezer":
      return (
        <Fridge slot={slot} appliance={appliance} w={w} h={h} d={d} body={body} trim={trim} />
      );

    case "coffee":
      return <CoffeeMachine w={w} h={h} d={d} body={body} trim={trim} glass={glass} />;

    case "range":
      // Three machines wear this category. A rangetop is a cooking surface
      // dropped into the stone with a cabinet under it; a range is a machine
      // with a front, and a customer reads that front.
      return isRangetop(appliance) ? (
        <Rangetop
          appliance={appliance}
          faceZ={faceZ}
          w={w}
          h={h}
          d={d}
          body={body}
          trim={trim}
          glass={glass}
        />
      ) : (
        <Range appliance={appliance} w={w} h={h} d={d} body={body} trim={trim} glass={glass} />
      );

    case "hood":
      return (
        <Hood
          installType={installType}
          frontLipIn={appliance.frontLipIn}
          baseY={baseY}
          topDepthIn={topDepthIn}
          w={w}
          h={h}
          d={d}
          body={body}
          glass={glass}
        />
      );

    case "dishwasher":
      // A panel-ready dishwasher is a door with a machine behind it, so the
      // front is drawn as a door — the cabinet's own finish, at the cabinet's
      // own grain — and only the handle stays steel.
      return (
        <group>
          <mesh position={[0, h / 2, cz]} castShadow>
            <boxGeometry args={[w, h, cd]} />
            <Mat s={body} size={[w, h]} />
          </mesh>
          <mesh position={[0, h * 0.5, face]} castShadow>
            <boxGeometry args={[w * 0.96, h * 0.96, ft(0.25)]} />
            <Mat s={body} size={[w * 0.96, h * 0.96]} />
          </mesh>
          <mesh position={[0, h * 0.94, gripZ]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[bar / 2, bar / 2, w * 0.9, 12]} />
            <Mat s={trim} />
          </mesh>
        </group>
      );

    case "wall-oven":
      // A combination oven is two machines in one carcass, and that is what is
      // on its face: a microwave door over an oven door, each with its own
      // handle. A single oven keeps the one door it always had.
      // A double oven is two doors too — steam over convection — with a control
      // strip across the top, so it is drawn by the same component.
      return isCombo(appliance) || isDouble(appliance) ? (
        <ComboOven
          double={!isCombo(appliance)}
          w={w}
          h={h}
          d={d}
          body={body}
          trim={trim}
          glass={glass}
        />
      ) : (
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
      // A column is a door, not a box: 84" of cabinet-finish panel with a
      // glass field in the middle of it and a fixed panel top and bottom.
      if (isColumn(appliance)) {
        return (
          <WineColumn
            w={w}
            h={h}
            d={d}
            body={body}
            trim={trim}
            glass={glass}
          />
        );
      }
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
 * A refrigerator, drawn from its front elevation.
 *
 * Two doors over two drawers, each panel standing three quarters of an inch
 * proud of the carcass — it is a built-in, and what you see of a built-in is
 * four slabs with shadow between them. Handles are tubes on brackets: vertical
 * beside the centre seam on the doors, horizontal across the drawers. Under
 * everything is the toe grille, which is the one part that does not open.
 *
 * Which fronts there are comes from `fridgeParts`, which reads the machine's
 * own record. All of it stays inside the published envelope: the carcass is set
 * back by the door thickness and the handle's reach, so a 36 x 84 x 25 opening
 * gets a 36 x 84 x 25 machine.
 */
/**
 * Widen the panels that meet a trim kit, so the doors close over it.
 *
 * Only the ones whose edge is the machine's edge on that side: a french door's
 * far leaf, the drawers under it and the grille below them all reach the kit;
 * its near leaf does not, and neither does anything on the other machine's
 * side. Everything else is left exactly as the drawing has it.
 */
function reachOverTheKit(
  panels: ReturnType<typeof fridgeParts>,
  w: number,
  over: { side: -1 | 1; overIn: number } | null,
): ReturnType<typeof fridgeParts> {
  if (!over || over.overIn <= 0) return panels;
  const reach = ft(over.overIn);
  const edge = (over.side * w) / 2;
  return panels.map((panel) => {
    const meets = Math.abs(panel.x + (over.side * panel.w) / 2 - edge) < 1e-6;
    if (!meets) return panel;
    // The handle stays where it is: it is fixed to the edge the door opens
    // from, and that is the other one.
    return { ...panel, w: panel.w + reach, x: panel.x + (over.side * reach) / 2 };
  });
}

/**
 * Which side a column's single door is hinged on.
 *
 * Away from the machine beside it, so two doors open back to back: the freezer
 * away from the refrigerator, and the refrigerator away from the freezer. Only
 * where there is a freezer column — every other refrigerator keeps the hinge it
 * has always been drawn with.
 */
function columnHinge(slot: SlotId): -1 | 1 {
  if (!SLOT_BY_ID["slot-freezer"]) return -1;
  return slot === "slot-freezer"
    ? hingeAwayFrom("slot-freezer", "slot-fridge")
    : hingeAwayFrom("slot-fridge", "slot-freezer");
}

function Fridge({
  slot: slotId,
  appliance,
  w,
  h,
  d,
  body,
  trim,
}: {
  slot: SlotId;
  appliance: Appliance;
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  trim: SurfaceProps;
}) {
  // The doors, and how far they reach past the case. A built-in beside a
  // column is joined to it by a 5/8" kit, and its door closes over that kit —
  // so the panel on that side is wider than the machine by what it covers. A
  // column in the middle of a group has a kit each side and covers both.
  const panels = useMemo(
    () =>
      trimKitsBeside(slotId).reduce(
        (fronts, kit) => reachOverTheKit(fronts, w, doorOverhang(SLOT_BY_ID[slotId], w, kit)),
        fridgeParts(appliance, { w, h }, columnHinge(slotId)),
      ),
    [slotId, appliance, w, h],
  );

  // Where the fronts stand relative to the carcass — which is the difference
  // between a built-in and a freestanding machine, and the one you can see
  // from across the room. See `fridgeStance`.
  const { solid, carcassD, carcassZ, doorThickness, doorZ, handleR, handleZ } = useMemo(
    () => fridgeStance(appliance, d),
    [appliance, d],
  );
  const seams = useMemo(() => fridgeSeams(panels, { w, h }), [panels, w, h]);
  // The grille is the band the split gives it, scaled to this machine.
  // The slots in the grille are a shade of the panel they are cut into, not a
  // colour of their own: what you see through a vent is the dark inside it.
  // Hardware, not a finish: it is the shadow inside a vent, so it does not
  // count as a colour the cabinetmaker chose even on a panel-ready machine.
  const slot = { ...tint(body, "#2A2E2C", { metalness: 0.3, roughness: 0.85 }), hardware: true };

  // A freestanding machine is one box. Its doors are part of the body, hung to
  // finish flush with the sides, so what is between them is a reveal drawn on
  // the face rather than a gap between slabs — and only the handles stand
  // outside the envelope. See docs/decisions.md D11 rule 11.
  if (solid) {
    const face = d / 2 + ft(0.02);
    return (
      <group name="fridge">
        <mesh name="fridge-body" position={[0, h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <Mat s={body} size={[w, h]} />
        </mesh>

        {/* The reveals between the fronts: a knife's width of shadow. */}
        <group name="fridge-seams">
          {seams.map((seam, i) => (
            <mesh key={i} position={[seam.x, seam.y, face]}>
              <boxGeometry args={[seam.w, seam.h, ft(0.05)]} />
              <Mat s={slot} />
            </mesh>
          ))}
        </group>

        {/* And the air through the grille at the bottom, on the same face. */}
        <group name="fridge-vents">
          {panels
            .filter((panel) => panel.vents)
            .flatMap((panel) =>
              Array.from({ length: panel.vents!.count }, (_, i) => {
                const over = panel.vents!.overFt ?? panel.h;
                const step = over / (panel.vents!.count + 1);
                return (
                  <mesh
                    key={`${panel.id}-${i}`}
                    position={[panel.x, panel.y - panel.h / 2 + step * (i + 1), face]}
                  >
                    <boxGeometry args={[panel.w * 0.9, panel.vents!.heightFt, ft(0.05)]} />
                    <Mat s={slot} />
                  </mesh>
                );
              }),
            )}
        </group>

        {panels
          .filter((panel) => panel.handle)
          .map((panel) => (
            <group key={panel.id} name={`fridge-handle-${panel.id}`}>
              <mesh
                position={[panel.handle!.x, panel.handle!.y, handleZ]}
                rotation={panel.handle!.along === "x" ? [0, 0, Math.PI / 2] : [0, 0, 0]}
              >
                <cylinderGeometry args={[handleR, handleR, panel.handle!.length, 14]} />
                <Mat s={trim} />
              </mesh>
              {[-1, 1].map((end) => {
                const along = (end * panel.handle!.length) / 2;
                return (
                  <mesh
                    key={end}
                    position={[
                      panel.handle!.x + (panel.handle!.along === "x" ? along : 0),
                      panel.handle!.y + (panel.handle!.along === "y" ? along : 0),
                      (d / 2 + handleZ) / 2,
                    ]}
                  >
                    <boxGeometry args={[handleR * 1.6, handleR * 1.6, handleZ - d / 2 + handleR]} />
                    <Mat s={trim} />
                  </mesh>
                );
              })}
            </group>
          ))}
      </group>
    );
  }

  // The grille is a taller part than it shows, and the drawer above laps over
  // its top: set back a quarter inch, so the two are not two faces fighting
  // for the same plane. A grille sits back from the fronts anyway.
  const zOf = (panel: (typeof panels)[number]) =>
    panel.id === "grille" ? doorZ - ft(0.25) : doorZ;

  return (
    <group name="fridge">
      <mesh position={[0, h / 2, carcassZ]} castShadow receiveShadow>
        <boxGeometry args={[w, h, carcassD]} />
        <Mat s={body} size={[w, h]} />
      </mesh>

      {panels.map((panel) => (
        <group key={panel.id} name={`fridge-panel-${panel.id}`}>
          <mesh position={[panel.x, panel.y, zOf(panel)]} castShadow receiveShadow>
            <boxGeometry args={[panel.w, panel.h, doorThickness]} />
            <Mat s={body} size={[panel.w, panel.h]} />
          </mesh>

          {/* Vent slots: the panel is one piece of steel, and these are the
              lines of air through it. Nothing here is a different material. */}
          {panel.vents &&
            Array.from({ length: panel.vents.count }, (_, i) => {
              const over = panel.vents!.overFt ?? panel.h;
              const step = over / (panel.vents!.count + 1);
              return (
                <mesh
                  key={i}
                  position={[
                    panel.x,
                    panel.y - panel.h / 2 + step * (i + 1),
                    zOf(panel) + doorThickness / 2,
                  ]}
                >
                  <boxGeometry args={[panel.w * 0.9, panel.vents!.heightFt, ft(0.05)]} />
                  <Mat s={slot} />
                </mesh>
              );
            })}

          {/* A tube on two brackets, the way one is actually mounted. */}
          {panel.handle && (
          <group name={`fridge-handle-${panel.id}`}>
            <mesh
              position={[panel.handle!.x, panel.handle!.y, handleZ]}
              rotation={panel.handle!.along === "x" ? [0, 0, Math.PI / 2] : [0, 0, 0]}
            >
              <cylinderGeometry args={[handleR, handleR, panel.handle!.length, 14]} />
              <Mat s={trim} />
            </mesh>
            {[-1, 1].map((end) => {
              const along = (end * panel.handle!.length) / 2;
              const bracketZ = (doorZ + doorThickness / 2 + handleZ) / 2;
              return (
                <mesh
                  key={end}
                  position={[
                    panel.handle!.x + (panel.handle!.along === "x" ? along : 0),
                    panel.handle!.y + (panel.handle!.along === "y" ? along : 0),
                    bracketZ,
                  ]}
                >
                  <boxGeometry
                    args={[
                      handleR * 1.6,
                      handleR * 1.6,
                      handleZ - doorZ - doorThickness / 2 + handleR,
                    ]}
                  />
                  <Mat s={trim} />
                </mesh>
              );
            })}
          </group>
          )}
        </group>
      ))}
    </group>
  );
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
/**
 * A combination oven: a microwave door over an oven door.
 *
 * Grey glass in a stainless frame, which is what the Masterpiece collection
 * is, and a full-width bar handle across the top of each door. The two doors
 * divide the front between them — there is no plinth and no toe kick, because
 * the machine is built into a tower and the cabinet is what reaches the floor.
 */
function ComboOven({
  double = false,
  w,
  h,
  d,
  body,
  trim,
  glass,
}: {
  /** Steam over convection rather than microwave over oven. */
  double?: boolean;
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  trim: SurfaceProps;
  glass: SurfaceProps;
}) {
  const parts = useMemo(
    () => (double ? doubleOvenParts({ w, h }) : comboOvenParts({ w, h })),
    [double, w, h],
  );
  // The carcass is set back by what the handle reaches, so the machine stays
  // inside the depth it is sold at.
  const cd = Math.max(d - parts.handle.proud, d * 0.5);
  const cz = -(d - cd) / 2;
  const face = cz + cd / 2;

  return (
    <group name="combo-oven">
      <mesh position={[0, h / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w, h, cd]} />
        <Mat s={body} />
      </mesh>
      {parts.doors.map((door) => {
        const height = door.band[1] - door.band[0];
        const middle = (door.band[0] + door.band[1]) / 2;
        return (
          <group key={door.kind} name={`combo-${door.kind}`}>
            {/* The door: a stainless frame with a glass field in it. The
                control panel across the top is the same frame with no glass —
                it is where the display and the touch keys are. */}
            <mesh position={[0, middle, face + ft(0.25)]} castShadow>
              <boxGeometry args={[w, height, ft(0.5)]} />
              <Mat s={body} size={[w, height]} />
            </mesh>
            {door.kind !== "control" && (
              <mesh position={[0, middle - ft(0.5), face + ft(0.55)]}>
                <boxGeometry args={[
                  w - parts.glassInset * 2,
                  Math.max(0, height - parts.glassInset * 2),
                  ft(0.1),
                ]} />
                <Mat s={glass} />
              </mesh>
            )}
            {door.kind === "control" && (
              <mesh position={[0, middle, face + ft(0.6)]}>
                <boxGeometry args={[w * 0.42, height * 0.4, ft(0.1)]} />
                <Mat s={glass} />
              </mesh>
            )}
            {/* The bar, where the elevation puts it: the microwave's is the
                one the tower's sill is set from, so it is drawn at the height
                that figure names rather than at a guess off the door's top. */}
            {door.handleAt !== null && (
              <mesh
                position={[0, door.handleAt, d / 2 - parts.handle.r]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[parts.handle.r, parts.handle.r, parts.handle.width, 12]} />
                <Mat s={trim} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * A built-in coffee machine: a steel face with a display across the top and a
 * dark niche in the middle of it, where the cup stands under the spout.
 *
 * Everything stays inside the published envelope: the face is set back by what
 * the spout and the grate stand out, so the machine is no deeper than its
 * opening says.
 */
function CoffeeMachine({
  w,
  h,
  d,
  body,
  trim,
  glass,
}: {
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  trim: SurfaceProps;
  glass: SurfaceProps;
}) {
  const parts = useMemo(() => coffeeParts({ w, h }), [w, h]);
  const proud = ft(0.8);
  const face = d / 2 - proud;
  return (
    <group name="coffee-machine">
      <mesh position={[0, h / 2, -proud / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d - proud]} />
        <Mat s={body} size={[w, h]} />
      </mesh>
      <mesh name="coffee-display" position={[0, parts.display.y, face + ft(0.02)]}>
        <boxGeometry args={[parts.display.w, parts.display.h, ft(0.05)]} />
        <Mat s={glass} />
      </mesh>
      <mesh name="coffee-niche" position={[0, parts.niche.y, face + ft(0.02)]}>
        <boxGeometry args={[parts.niche.w, parts.niche.h, ft(0.05)]} />
        <Mat s={glass} />
      </mesh>
      <mesh name="coffee-spout" position={[0, parts.spout.y, face + ft(0.4)]} castShadow>
        <boxGeometry args={[parts.spout.w, parts.spout.h, ft(0.75)]} />
        <Mat s={trim} />
      </mesh>
      <mesh name="coffee-grate" position={[0, parts.grate.y, face + ft(0.35)]}>
        <boxGeometry args={[parts.grate.w, parts.grate.h, ft(0.7)]} />
        <Mat s={trim} />
      </mesh>
    </group>
  );
}

/**
 * A wine column: a door panel with a glass field in it.
 *
 * Panel-ready, so the frame is the kitchen's own door finish and changes with
 * it — what is bought is the machine behind it, and what is seen is joinery
 * with a window. The fixed panels top and bottom are the drawing's, the
 * shelves show through the glass, and the handle is the refrigerator's, hung
 * on the side away from it so the two doors open back to back.
 */
function WineColumn({
  w,
  h,
  d,
  body,
  trim,
  glass,
}: {
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  trim: SurfaceProps;
  glass: SurfaceProps;
}) {
  const hinge = hingeAwayFrom("slot-wine", "slot-fridge");
  // The door reaches over the kit between this machine and the one beside it,
  // so what shows between the two fronts is the reveal rather than the kit.
  // The handle goes with it: it is on the edge the door opens from, which is
  // the edge that moved.
  const over = doorOverhang(SLOT_BY_ID["slot-wine"], w, trimKitBeside("slot-wine"));
  const reach = over ? ft(over.overIn) : 0;
  const shift = over ? (over.side * reach) / 2 : 0;
  const parts = useMemo(() => wineColumnParts({ w, h, d }, hinge), [w, h, d, hinge]);
  /** The door as it is actually hung: the drawing's, plus what it covers. */
  const doorW = parts.door.w + reach;
  const cd = Math.max(d - parts.handle.proud, d * 0.5);
  const cz = -(d - cd) / 2;
  const face = cz + cd / 2;
  // The dark inside a vent, which is a shade of the steel it is cut into
  // rather than a colour of its own — the same slot the refrigerator's grille
  // is drawn with. Hardware, so it is not counted as a finish somebody chose.
  const slot = { ...tint(body, "#2A2E2C", { metalness: 0.3, roughness: 0.85 }), hardware: true };

  return (
    <group name="wine-column">
      <mesh position={[0, h / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w, h, cd]} />
        <Mat s={glass} />
      </mesh>
      {parts.parts.map((part) => {
        const height = part.band[1] - part.band[0];
        const middle = (part.band[0] + part.band[1]) / 2;
        // The door is one panel with a window cut in it: solid across the top
        // and the bottom, solid down each side of the glass, and the glass
        // itself set back in the middle of it.
        const stile = (doorW - parts.glass.w) / 2;

        // The grille the machine stands on: the door's own steel, full width,
        // with the lines of air across it.
        if (part.kind === "grille") {
          return (
            <group key={part.band[0]} name="wine-grille">
              <mesh position={[shift, middle, face + ft(0.4)]} castShadow>
                <boxGeometry args={[doorW, height, ft(0.75)]} />
                <Mat s={body} size={[doorW, height]} />
              </mesh>
              {part.vents &&
                Array.from({ length: part.vents.count }, (_, i) => {
                  const step = height / (part.vents!.count + 1);
                  return (
                    <mesh
                      key={i}
                      position={[shift, part.band[0] + step * (i + 1), face + ft(0.8)]}
                    >
                      <boxGeometry args={[doorW * 0.9, part.vents!.heightFt, ft(0.05)]} />
                      <Mat s={slot} />
                    </mesh>
                  );
                })}
            </group>
          );
        }

        return part.kind === "panel" ? (
          <mesh key={part.band[0]} position={[shift, middle, face + ft(0.4)]} castShadow>
            <boxGeometry args={[doorW, height, ft(0.75)]} />
            <Mat s={body} size={[doorW, height]} />
          </mesh>
        ) : (
          <group key={part.band[0]}>
            <mesh position={[shift, middle, face + ft(0.3)]}>
              <boxGeometry args={[parts.glass.w, height, ft(0.1)]} />
              <Mat s={glass} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[shift + (side * (doorW - stile)) / 2, middle, face + ft(0.4)]}
                castShadow
              >
                <boxGeometry args={[stile, height, ft(0.75)]} />
                <Mat s={body} size={[stile, height]} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* The bottles, as shelves showing through the glass. */}
      {parts.shelves.map((y) => (
        <mesh key={y} position={[shift, y, face - ft(1.5)]}>
          <boxGeometry args={[doorW - ft(4), ft(0.4), ft(0.1)]} />
          <Mat s={trim} />
        </mesh>
      ))}
      {/* The handle, on the side away from the refrigerator. */}
      <mesh
        position={[
          shift - hinge * (doorW / 2 - ft(1.6)),
          parts.door.y + parts.door.h / 2,
          d / 2 - parts.handle.r,
        ]}
      >
        <cylinderGeometry args={[parts.handle.r, parts.handle.r, parts.handle.h, 12]} />
        <Mat s={trim} />
      </mesh>
    </group>
  );
}

/**
 * A rangetop: a cooking surface in the stone, and its controls under it.
 *
 * There is no oven and no front — the front of this machine is the cabinet
 * below it, which is why the drawer base under a rangetop has a false top
 * drawer. What shows above the counter is 7/16" of steel deck and the cast
 * iron on it; what shows below is the control panel, 7-5/8" deep down from the
 * counter and standing 1-1/2" proud of the cabinet face, with one knob per
 * burner across it.
 *
 * The chassis under the deck is drawn because it is really there, inside the
 * cabinet: the machine is 8-1/8" tall and drops 7-11/16" through the top.
 */
function Rangetop({
  appliance,
  faceZ,
  w,
  h,
  d,
  body,
  trim,
  glass,
}: {
  appliance: Appliance;
  faceZ: number;
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  trim: SurfaceProps;
  glass: SurfaceProps;
}) {
  const parts = useMemo(() => rangeParts(appliance, { w, h, d }), [appliance, w, h, d]);
  const { bands, fascia } = parts;
  const iron = tint(glass, "#1C1E1C", { metalness: 0.2, roughness: 0.7 });
  const gap = ft(RANGE_PROPORTIONS.grateGapIn);
  const panelD = ft(0.75);

  return (
    <group name="rangetop">
      {/* The chassis, most of which is inside the counter. */}
      <mesh position={[0, (bands.deck[0] + bands.deck[1]) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, bands.deck[1] - bands.deck[0], d]} />
        <Mat s={trim} />
      </mesh>

      {/* Cast iron over the burners, laid two deep, continuous so a pan slides
          from one to the next. */}
      <group name="rangetop-grates">
        {parts.grates.map((grate, i) => (
          <group
            key={i}
            name={`rangetop-grate-${i}`}
            position={[grate.x, (bands.grate[0] + bands.grate[1]) / 2, grate.z]}
          >
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
        ))}
      </group>

      {/* The control panel: the machine's front, from the deck down past the
          counter, standing proud of the cabinet below it. */}
      {fascia && (
        <group name="rangetop-controls">
          <mesh
            position={[0, h - fascia.h / 2, faceZ + fascia.proud - panelD / 2]}
            castShadow
          >
            <boxGeometry args={[w, fascia.h, panelD]} />
            <Mat s={body} size={[w, fascia.h]} />
          </mesh>
          {parts.knobs.map((knob, i) => (
            <mesh
              key={i}
              position={[knob.x, knob.y, faceZ + fascia.proud + knob.r * 0.4]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[knob.r, knob.r * 0.86, knob.r * 0.9, 16]} />
              <Mat s={trim} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

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
  const iron = tint(glass, "#1C1E1C", { metalness: 0.2, roughness: 0.7 });
  const dark = tint(glass, "#151715", { metalness: 0.1, roughness: 0.8 });
  // The painted flanks of an ordinary freestanding range: dark grey, and matte
  // rather than the near-mirror of the steel front.
  const painted = tint(glass, FREESTANDING_PROPORTIONS.sideColor, {
    metalness: 0.05,
    roughness: 0.75,
  });

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

      {/* Toe kick, set back so the machine reads as standing on legs. A
          freestanding range has none: its storage drawer goes to the floor. */}
      {bands.toe[1] > bands.toe[0] && (
        <mesh position={[0, (bands.toe[0] + bands.toe[1]) / 2, carcassZ - ft(0.5)]}>
          <boxGeometry args={[w - ft(0.5), bands.toe[1] - bands.toe[0], carcassD - ft(1)]} />
          <Mat s={dark} />
        </mesh>
      )}

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
            door.width * (parts.style === "backguard" ? 0.86 : 0.78),
            door.height *
              (parts.style === "backguard"
                ? FREESTANDING_PROPORTIONS.windowFraction
                : RANGE_PROPORTIONS.windowFraction),
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
          front of a pro range reading as one flat sheet. A freestanding range
          has no such band: the control strip meets the door directly. */}
      {parts.style === "pro" && (
        <mesh position={[0, bands.door[1] + ft(RANGE_PROPORTIONS.bandIn) / 2, face + ft(0.15)]}>
          <boxGeometry args={[w, ft(RANGE_PROPORTIONS.bandIn), ft(0.3)]} />
          <Mat s={trim} />
        </mesh>
      )}

      {/* The control strip. On a pro range it is a fascia under the deck with
          two banks of knobs and the display between them; on a freestanding
          one it is the band above the oven door, with the exhaust grille along
          the bottom of it and the display up on the backguard instead. */}
      <mesh position={[0, control.y, face]}>
        <boxGeometry args={[control.width, control.height - reveal, ft(0.25)]} />
        <Mat s={body} />
      </mesh>
      {parts.vent && (
        <group name="range-vent">
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={i}
              position={[
                0,
                parts.vent![0] + ((i + 1) * (parts.vent![1] - parts.vent![0])) / 5,
                face + ft(0.12),
              ]}
            >
              <boxGeometry args={[control.width * 0.82, ft(0.22), ft(0.12)]} />
              <Mat s={dark} />
            </mesh>
          ))}
        </group>
      )}
      {parts.style === "pro" && (
        <mesh position={[parts.display.x, parts.display.y, face + ft(0.3)]}>
          <boxGeometry args={[parts.display.w, parts.display.h, ft(0.1)]} />
          <Mat s={dark} />
        </mesh>
      )}

      {/* The backguard: a raised panel at the back, standing above the cooking
          surface, with the digital display across the front of it and no knobs
          on it at all. Inside the envelope, because the height this machine is
          sold at is the height with the backguard on. */}
      {parts.backguard && (
        <group name="range-backguard" position={[0, parts.cooktop, -(d - parts.backguard.d) / 2]}>
          <mesh position={[0, parts.backguard.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, parts.backguard.h, parts.backguard.d]} />
            <Mat s={body} />
          </mesh>
          <mesh
            position={[
              parts.display.x,
              parts.display.y - parts.cooktop,
              parts.backguard.d / 2 + ft(0.06),
            ]}
          >
            <boxGeometry args={[parts.display.w, parts.display.h, ft(0.12)]} />
            <Mat s={dark} />
          </mesh>
        </group>
      )}
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
          sold at is the width with its sides on.

          On a pro range they are steel. On an ordinary freestanding one they
          are painted — only the front and the top of that machine are
          stainless, and drawing the flanks in steel is drawing a more expensive
          appliance than the one on the quote. */}
      {parts.sides === "finished" &&
        [-1, 1].map((side) => (
          <mesh
            key={side}
            position={[(side * (w - reveal)) / 2, bands.deck[0] / 2, carcassZ]}
            castShadow
          >
            <boxGeometry args={[reveal, bands.deck[0], carcassD - ft(0.5)]} />
            <Mat s={parts.style === "backguard" ? painted : trim} />
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
  frontLipIn,
  baseY,
  w,
  h,
  d,
  body,
  glass,
}: {
  installType: string[];
  topDepthIn: number;
  frontLipIn: number | null;
  baseY: number;
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  glass: SurfaceProps;
}) {
  const kind = installType.find((type) =>
    ["under-cabinet", "wall-mount", "chimney", "island", "insert"].includes(type),
  );

  /**
   * An insert liner: a stainless tray of filters, lights and a control strip
   * that goes up inside a housing somebody else builds.
   *
   * There is no canopy to draw and no flue to draw it into — the housing is
   * cabinetry and `HoodCabinet` draws it. What is drawn here is what is
   * actually visible from the room: the band of steel under the housing, the
   * baffles set into it, the four lights and the strip of controls at the
   * front edge.
   */
  if (kind === "insert") {
    const lip = Math.min(ft(frontLipIn ?? 7.6875), h);
    const face = d / 2;
    return (
      <group name="hood-liner">
        {/* The liner itself. Most of it is up inside the housing; the last
            couple of inches of it are the band you see. */}
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <Mat s={body} />
        </mesh>
        {/* Baffle filters across the underside, pressed from the same sheet as
            the liner: they are part of it rather than a black panel under it. */}
        <mesh position={[0, ft(0.6), -ft(1)]}>
          <boxGeometry args={[w * 0.9, ft(1.2), d * 0.62]} />
          <Mat s={body} />
        </mesh>
        {/* Four lights along the front edge, and the control strip beside them,
            which is what tells you which way round the liner is. */}
        {[-0.34, -0.12, 0.12, 0.34].map((t) => (
          <mesh key={t} position={[w * t, ft(0.35), face - ft(2.5)]}>
            <boxGeometry args={[ft(2.2), ft(0.3), ft(1.6)]} />
            <Mat s={glass} />
          </mesh>
        ))}
        <mesh position={[-w * 0.36, ft(0.4), face - ft(0.9)]}>
          <boxGeometry args={[w * 0.2, ft(0.5), ft(1.4)]} />
          <Mat s={glass} />
        </mesh>
        {/* The front edge of the tray, which is the 7-11/16" face on the
            drawing: it is what the housing's opening is scribed to. */}
        <mesh position={[0, lip / 2, face - ft(0.35)]}>
          <boxGeometry args={[w, lip, ft(0.7)]} />
          <Mat s={body} size={[w, lip]} />
        </mesh>
      </group>
    );
  }

  // A chimney hood draws in on all three open sides, to the section of the flue
  // it feeds. An under-cabinet hood has no flue of its own and keeps the wedge
  // it always had — the cabinet above it is where the duct goes.
  const chimneyed = kind === "wall-mount" || kind === "chimney";
  const canopy = useMemo(
    () =>
      chimneyed
        ? canopyGeometry(
            w,
            h,
            d,
            CHIMNEY.widthIn,
            topDepthIn,
            frontLipIn ?? HOOD_PROFILE.frontLipIn,
          )
        : wedgeGeometry(w, h, d, topDepthIn, frontLipIn ?? undefined),
    [chimneyed, w, h, d, topDepthIn, frontLipIn],
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
      {/* The intake: baffle filters set into the underside.
          They are the hood's own steel, not a black panel screwed under it —
          a baffle filter is pressed from the same sheet as the canopy and
          reads as part of it. Drawing them in a separate dark material made
          every hood look like it had a hole in the bottom. */}
      <mesh position={[0, ft(0.7), 0]}>
        <boxGeometry args={[w * 0.88, ft(1), d * 0.6]} />
        <Mat s={body} />
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
    // The duct cover runs from the top of the canopy to the ceiling — measured
    // from where the canopy actually is, which moves with the range under it.
    // Assuming a 30" clearance over a 36" counter put it three quarters of an
    // inch through the ceiling on a range whose cooking surface is higher.
    //
    // Two telescoping sections with a half-inch step where they meet, the
    // lower sliding over the upper, and a grille across the top of each side:
    // that is the part, and drawing it as one tapered box was drawing a
    // chimney nobody sells.
    const chimney = chimneyParts(baseY + h);
    // Against the wall, like the canopy under it: a duct cover centred on the
    // canopy's flat top stands half a foot out into the room for no reason.
    const backOf = (depth: number) => -d / 2 + depth / 2;
    const section = (
      name: string,
      size: { from: number; h: number; w: number; d: number },
      vents: boolean,
    ) => (
      <group key={name} name={name} position={[0, h + size.from + size.h / 2, backOf(size.d)]}>
        <mesh castShadow>
          <boxGeometry args={[size.w, size.h, size.d]} />
          <Mat s={body} />
        </mesh>
        {vents &&
          [-1, 1].map((side) => (
            <mesh
              key={side}
              position={[
                (side * size.w) / 2,
                size.h / 2 - ft(CHIMNEY.vent.fromTopIn + CHIMNEY.vent.heightIn / 2),
                0,
              ]}
            >
              <boxGeometry args={[ft(0.2), ft(CHIMNEY.vent.heightIn), size.d * 0.7]} />
              <Mat s={glass} />
            </mesh>
          ))}
      </group>
    );
    return (
      <group>
        {body_}
        {chimney.rise > 0 && (
          <group name="hood-chimney">
            {/* The inner section first, so the outer one sliding over it hides
                the overlap the way the part does. */}
            {section("chimney-upper", chimney.upper, true)}
            {section("chimney-lower", chimney.lower, false)}
          </group>
        )}
      </group>
    );
  }

  // Under-cabinet: the wedge and nothing else. The wall cabinet above it hides
  // the duct, which is the whole point of the type.
  return <group>{body_}</group>;
}


/**
 * The canopy as a solid: the section extruded across the width.
 *
 * The profile is described from the wall outward and from the underside up, so
 * the extrusion comes out lying on its side and has to be turned a quarter turn
 * to face the room.
 */
/**
 * A wall canopy as a solid: the rim, the vertical front face, and the four
 * faces drawing in to the collar the chimney lands on.
 *
 * Three rings of four corners, quads between them. Built by hand rather than
 * extruded because an extrusion can only taper in one direction, which is the
 * whole of what was wrong with drawing this as a wedge.
 */
function canopyGeometry(
  w: number,
  h: number,
  d: number,
  topWidthIn: number,
  topDepthIn: number,
  frontLipIn: number,
): THREE.BufferGeometry {
  const c = canopySolid({
    widthIn: w * 12,
    depthIn: d * 12,
    heightIn: h * 12,
    frontLipIn,
    topWidthIn,
    topDepthIn,
  });

  const halfW = ft(c.bottom.w) / 2;
  const halfTop = ft(c.top.w) / 2;
  const backZ = -ft(c.bottom.d) / 2;
  const frontZ = backZ + ft(c.bottom.d);
  const topFrontZ = backZ + ft(c.top.d);
  const ring = (y: number, hw: number, front: number) =>
    [
      [-hw, y, backZ],
      [hw, y, backZ],
      [hw, y, front],
      [-hw, y, front],
    ] as [number, number, number][];

  const rings = [
    ring(0, halfW, frontZ),
    ring(ft(c.lip), halfW, frontZ),
    ring(ft(c.height), halfTop, topFrontZ),
  ];

  const positions: number[] = [];
  const push = (p: [number, number, number]) => positions.push(p[0], p[1], p[2]);
  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c2: [number, number, number],
    d2: [number, number, number],
  ) => {
    push(a);
    push(b);
    push(c2);
    push(a);
    push(c2);
    push(d2);
  };

  // Wound so the outside of the canopy is the front face. The other way round
  // culls the faces nearest the viewer and leaves the inside of the hood
  // showing through them, which is what this was doing.
  for (let level = 0; level < rings.length - 1; level += 1) {
    const low = rings[level];
    const high = rings[level + 1];
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      quad(low[j], low[i], high[i], high[j]);
    }
  }
  // The rim underneath and the collar on top.
  quad(rings[0][3], rings[0][2], rings[0][1], rings[0][0]);
  const top = rings[rings.length - 1];
  quad(top[0], top[1], top[2], top[3]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function wedgeGeometry(
  w: number,
  h: number,
  d: number,
  topDepthIn: number,
  frontLipIn?: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const profile = hoodProfile(d * 12, topDepthIn, h * 12, frontLipIn);
  shape.moveTo(ft(profile[0][0]), ft(profile[0][1]));
  for (const [x, y] of profile.slice(1)) shape.lineTo(ft(x), ft(y));
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  // Profile x runs from the wall toward the room; the extrusion runs across it.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(w / 2, 0, -d / 2);
  return geometry;
}
