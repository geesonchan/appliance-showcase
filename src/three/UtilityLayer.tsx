import { useMemo } from "react";
import * as THREE from "three";
import { CABINET_STANDARDS, ROOM, SLOTS, ft } from "../data/slots";
import { FIXTURES } from "../data/fixtures";
import { ductRoute, hoodCabinetFloor, hoodOutlet, outletSize } from "../data/hood";
import { deriveUtilities } from "../data/utilities";
import { useAppStore } from "../store/useAppStore";
import { useSelection, useSelectedBlower } from "../store/useSelection";
import { effectiveCfm } from "../data/ventilation";
import { resolveRoughIn } from "../data/roughIn";
import { serviceRoute } from "../data/serviceRoute";
import { alongOf, facingOf, onAxis, otherAxis, sizeOnPlan, stripFacing } from "../data/frame";
import { wallBehind } from "../data/roomWalls";
import { RUN_BY_ID } from "../data/room";
import { wallAnchor } from "../data/wallAnchor";
import type { Appliance, ServicePoint, SlotId, UtilityType, Utilities } from "../types";
import { UNREVIEWED, UTILITY_COLORS, UTILITY_RADIUS_IN } from "./materials";

const UP = new THREE.Vector3(0, 1, 0);
const DUCT = CABINET_STANDARDS.hood;

/**
 * Heights each service runs at, measured off the finished floor. These are the
 * bands a trade would actually rough in at, which is what makes the install
 * view readable: the runs stack instead of overlapping.
 */
const HEIGHT = {
  /** 240V feeders drop to the toe kick and run under the cabinet boxes. */
  power240Trunk: ft(2.5),
  gas: ft(6),
  water: ft(12),
  /** Backsplash receptacle height. */
  power120: ft(42),
};

/**
 * How far each run stands off its wall. Supply and drain share a height, so
 * they are separated horizontally instead of being stacked.
 */
const STANDOFF = {
  default: ft(2),
  waterDrain: ft(5.5),
};

/**
 * Every run this layer draws is generic — room-wide heights and routes, not a
 * model's figures — so every one of them is drawn as not yet reviewed (D21): a
 * faint thin grey line, whatever the service. The service colour is still passed
 * in by each run, for the day a run is reviewed and earns it back.
 */
const unreviewedMaterial = () => (
  <meshBasicMaterial color={UNREVIEWED.color} transparent opacity={UNREVIEWED.opacity} depthWrite={false} />
);
const thin = (radius: number) => Math.min(radius, ft(UNREVIEWED.radiusIn));

/** A straight run of pipe between two points. */
function Pipe({
  from,
  to,
  radius,
}: {
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
  color: string;
  hollow?: boolean;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    return { position: a.clone().add(b).multiplyScalar(0.5), quaternion: q, length: len };
  }, [from, to]);

  if (length < 1e-4) return null;

  return (
    <mesh position={position} quaternion={quaternion} userData={{ tier: "unreviewed" }}>
      <cylinderGeometry args={[thin(radius), thin(radius), length, 8, 1]} />
      {unreviewedMaterial()}
    </mesh>
  );
}

/** A small fitting: shutoff valve, outlet box, panel, drain stub. */
function Fitting({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} userData={{ tier: "unreviewed" }}>
      <boxGeometry args={size} />
      {unreviewedMaterial()}
    </mesh>
  );
}


/**
 * A service that comes up through the floor, for a machine in the island.
 *
 * The riser from the slab to where the machine takes it, and the fitting on the
 * end of it. The route under the slab is not modelled, because nothing in this
 * scene knows where it goes. Round 52 (D22 step 3): gas and water use it too,
 * so an island slot with either is drawn rather than left out.
 */
function FloorService({
  at,
  to,
  radius,
  color,
  fitting = true,
}: {
  at: { x: number; z: number; box: [number, number, number] };
  to: number;
  radius: number;
  color: string;
  fitting?: boolean;
}) {
  return (
    <group>
      <Pipe from={[at.x, 0, at.z]} to={[at.x, to, at.z]} radius={radius} color={color} />
      {fitting && <Fitting position={[at.x, to, at.z]} size={at.box} color={color} />}
    </group>
  );
}

/** The wall a run's machines back onto. */
const wallOf = (run: typeof RUN_BY_ID.back) => wallBehind(stripFacing(run.axis, 1));

/**
 * Every service enters on the back run's wall, at its open end.
 *
 * Which wall the meter is on is a fact about the house, so it is named — the
 * back run's. Where along it is the room's own far end, four feet back from the
 * corner, and that is the one figure here that is still the room's rather than
 * a run's. Round 52 (D22 step 3).
 */
const entry = (standoff: number) => {
  const wall = wallOf(RUN_BY_ID.back);
  const [x, , z] = onAxis(otherAxis(wall.axis), ROOM.halfX - ft(4), wall.at + standoff);
  return { x, z };
};

/** Inside corner, where the two runs' walls meet. */
const corner = (standoff: number) => {
  const back = wallOf(RUN_BY_ID.back);
  const left = wallOf(RUN_BY_ID.left);
  const [x, , z] = onAxis(otherAxis(back.axis), left.at + standoff, back.at + standoff);
  return { x, z };
};

/**
 * A trunk route from the service entry to a slot, at a fixed height. Runs stay
 * on the walls: back wall first, then around the corner onto the left wall,
 * never diagonally across the floor.
 */
function trunkPoints(
  slot: ServicePoint,
  y: number,
  standoff = STANDOFF.default,
): [number, number, number][] {
  const anchor = wallAnchor(slot, standoff);
  // A trunk runs along the walls, and an island slot is on none of them: its
  // services come up through the floor (`islandRiser`). Asking for a trunk to
  // one is a bug in the caller, not a route to draw. D22.
  if (!anchor) throw new Error(`UtilityLayer: no wall trunk to ${slot.id}, which is in the island`);
  const start = entry(standoff);
  const points: [number, number, number][] = [[start.x, y, start.z]];
  if (anchor.onLeftWall) {
    const bend = corner(standoff);
    points.push([bend.x, y, bend.z]);
  }
  points.push([anchor.x, y, anchor.z]);
  return points;
}

/** Draws a polyline of pipe, with an elbow at each interior corner. */
function Trunk({
  points,
  radius,
  color,
}: {
  points: [number, number, number][];
  radius: number;
  color: string;
}) {
  return (
    <group>
      {points.slice(0, -1).map((from, i) => (
        <Pipe key={i} from={from} to={points[i + 1]} radius={radius} color={color} />
      ))}
      {points.slice(1, -1).map((elbow, i) => (
        <mesh key={"elbow-" + i} position={elbow} userData={{ tier: "unreviewed" }}>
          <sphereGeometry args={[thin(radius), 8, 6]} />
          {unreviewedMaterial()}
        </mesh>
      ))}
    </group>
  );
}

/** The height an appliance actually lands its connection at. */
const connectionHeight = (slot: ServicePoint) => slot.position[1] + ft(slot.cutout.h) * 0.45;

function GasRuns({ effective }: { effective: Record<string, Utilities> }) {
  const r = ft(UTILITY_RADIUS_IN.gas);
  return (
    <group name="utility-gas">
      {SLOTS.map((slot) => {
        const gas = effective[slot.id].gas;
        if (!gas) return null;
        const route = serviceRoute(slot, STANDOFF.default);
        const riserTop = ft(26);
        // An island slot is on no wall: the gas comes up through the slab
        // inside the cabinet, the same way its power does. Round 52, D22 step 3.
        if (route.kind === "floor") {
          return (
            <FloorService
              key={slot.id}
              at={route}
              to={riserTop}
              radius={r}
              color={UTILITY_COLORS.gas}
              fitting={gas.shutoff}
            />
          );
        }
        const a = route;
        return (
          <group key={slot.id}>
            <Trunk
              points={trunkPoints(slot, HEIGHT.gas)}
              radius={r}
              color={UTILITY_COLORS.gas}
            />
            {/* riser from the trunk up to the appliance connection */}
            <Pipe
              from={[a.x, HEIGHT.gas, a.z]}
              to={[a.x, riserTop, a.z]}
              radius={r}
              color={UTILITY_COLORS.gas}
            />
            {gas.shutoff && (
              <Fitting
                position={[a.x, riserTop, a.z]}
                size={[ft(4), ft(3), ft(3)]}
                color={UTILITY_COLORS.gas}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * 120V branch circuits run at receptacle height along the backsplash. 240V
 * feeders are heavier, drop to the toe kick, run under the cabinets, then rise
 * to the appliance.
 */
function PowerRuns({
  effective,
  selection,
}: {
  effective: Record<string, Utilities>;
  /** What is in each slot: a hard-wired oven's box is where its own sheet puts it. */
  selection: Record<SlotId, Appliance>;
}) {
  const panelAt = entry(STANDOFF.default);
  return (
    <group name="utility-power">
      {/* service panel the branch circuits home-run back to */}
      <Fitting
        position={[panelAt.x, ft(54), panelAt.z]}
        size={[ft(14), ft(20), ft(4)]}
        color={UTILITY_COLORS.power240}
      />
      {SLOTS.map((slot) => {
        const is240 = effective[slot.id].power.voltage === 240;
        const color = is240 ? UTILITY_COLORS.power240 : UTILITY_COLORS.power120;
        const radius = ft(is240 ? UTILITY_RADIUS_IN.power240 : UTILITY_RADIUS_IN.power120);
        const trunkY = is240 ? HEIGHT.power240Trunk : HEIGHT.power120;
        const outletY = is240 ? connectionHeight(slot) : HEIGHT.power120;

        const route = serviceRoute(slot, STANDOFF.default);
        if (route.kind === "floor") {
          // Behind the appliance, whichever way its door faces.
          const riser = route;
          return (
            <group key={slot.id}>
              <Pipe
                from={[riser.x, 0, riser.z]}
                to={[riser.x, outletY, riser.z]}
                radius={radius}
                color={color}
              />
              <Fitting
                position={[riser.x, outletY, riser.z]}
                size={riser.box}
                color={color}
              />
            </group>
          );
        }

        const a = route;
        // A receptacle box lies flat on its wall: 3" across the machine's face
        // and 2" out of it, turned with the machine rather than guessed from
        // which wall it is. Round 52.
        const [boxX, boxZ] = sizeOnPlan(slot.rotationY, ft(3), ft(2));
        const box: [number, number, number] = [boxX, ft(4.5), boxZ];

        // A hard-wired oven's junction box is where its own sheet puts it, in
        // the cabinet beside the tower, not behind the machine (round 39): the
        // feeder runs along the wall to under that cabinet and rises there, and
        // the rough-in layer draws the box itself.
        const wired = is240
          ? resolveRoughIn(slot.id as SlotId, selection[slot.id]).find(
              (p) => p.point.type === "power" && p.point.location === "beside-tower",
            )
          : undefined;
        if (wired) {
          const [px, py, pz] = wired.position;
          // Along the wall to under that cabinet, then up: the wall's own
          // along-coordinate comes from the box, its across from the trunk.
          const wall = wallBehind(facingOf(slot.rotationY));
          const strip = otherAxis(wall.axis);
          const [fx, , fz] = onAxis(strip, alongOf(strip, px, pz), alongOf(wall.axis, a.x, a.z));
          const foot: [number, number, number] = [fx, trunkY, fz];
          return (
            <group key={slot.id}>
              <Trunk points={trunkPoints(slot, trunkY)} radius={radius} color={color} />
              <Pipe from={[a.x, trunkY, a.z]} to={foot} radius={radius} color={color} />
              <Pipe from={foot} to={[foot[0], py, foot[2]]} radius={radius} color={color} />
            </group>
          );
        }

        return (
          <group key={slot.id}>
            <Trunk points={trunkPoints(slot, trunkY)} radius={radius} color={color} />
            {is240 && (
              <Pipe
                from={[a.x, trunkY, a.z]}
                to={[a.x, outletY, a.z]}
                radius={radius}
                color={color}
              />
            )}
            <Fitting position={[a.x, outletY, a.z]} size={box} color={color} />
          </group>
        );
      })}
    </group>
  );
}

/**
 * Supply and drain, for everything in the room that needs them.
 *
 * The sink is a fixture rather than a slot, and it is the reason the drain is
 * there at all — a water layer drawn from the appliances alone would show the
 * dishwasher tapping into nothing.
 */
function WaterRuns({ effective }: { effective: Record<string, Utilities> }) {
  const r = ft(UTILITY_RADIUS_IN.water);
  const points: ServicePoint[] = [...SLOTS, ...FIXTURES];
  return (
    <group name="utility-water">
      {points.map((slot) => {
        const w = effective[slot.id]?.water;
        if (!w) return null;
        const route = serviceRoute(slot, STANDOFF.default);
        // As with gas: an island slot's supply and drain come up through the
        // floor rather than along a wall it is not on. Round 52, D22 step 3.
        if (route.kind === "floor") {
          return (
            <FloorService
              key={slot.id}
              at={route}
              to={HEIGHT.water}
              radius={w.drain ? r * 1.5 : r}
              color={UTILITY_COLORS.water}
              fitting={Boolean(w.supply)}
            />
          );
        }
        const supply = route;
        return (
          <group key={slot.id}>
            {w.supply && (
              <>
                <Trunk
                  points={trunkPoints(slot, HEIGHT.water)}
                  radius={r}
                  color={UTILITY_COLORS.water}
                />
                <Fitting
                  position={[supply.x, HEIGHT.water, supply.z]}
                  size={[ft(3), ft(3), ft(3)]}
                  color={UTILITY_COLORS.water}
                />
              </>
            )}
            {/* The drain shares the water band, so it is offset off the wall
                rather than stacked at a different height. */}
            {w.drain && (
              <Trunk
                points={trunkPoints(slot, HEIGHT.water, STANDOFF.waterDrain)}
                radius={r * 1.5}
                color={UTILITY_COLORS.water}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * The exhaust: the duct, the damper, and the blower wherever it lives.
 *
 * Five things a hood installation can be, per Thermador's ducting sheet
 * (docs/reference/thermador-ducting.png), and they are not variations on a
 * drawing — they are five different jobs for whoever runs the duct:
 *
 *   1. up through the roof, or horizontally through an outside wall
 *   2. integral  — the blower sits in the canopy
 *   3. remote    — the blower is at the far end, on the roof or the wall
 *   4. inline    — the blower is in the duct run, in the ceiling or the attic
 *   5. a back-draft damper at the transition, whichever of these it is
 *
 * The blower's own install type decides which, so specifying an inline blower
 * moves the box up into the ceiling in front of the customer.
 */
function DuctRuns({
  effective,
  blower,
  selection,
  showToast,
}: {
  effective: Record<string, Utilities>;
  blower: Appliance | null;
  selection: Record<string, Appliance>;
  showToast: (key: string, vars?: Record<string, string | number>) => void;
}) {
  return (
    <group name="utility-duct">
      {SLOTS.map((slot) => {
        const duct = effective[slot.id].duct;
        if (!duct || duct.route === "recirc") return null;

        const radius = ft(duct.diameterIn) / 2;
        // Off the opening in the canopy's top, which is well behind the front
        // edge — and is why the cabinet above needs a hole in its floor.
        const outlet = hoodOutlet(slot, selection[slot.id]);
        const collarY = outlet.position[1] + ft(DUCT.outletAboveBodyIn);
        const x = outlet.position[0];
        const z = outlet.position[2];

        // Where the blower ends up: in the canopy, part-way along the run, or
        // out at the termination.
        const type = blower?.installType ?? [];
        const place = type.includes("inline")
          ? "inline"
          : type.includes("external") || type.includes("remote")
            ? "remote"
            : "integral";

        // Up through the ceiling, or out through the wall this hood is
        // actually against — which used to be the back wall whatever it hung
        // on. Round 52, D22 step 3.
        const { runsUp, end, inlineAt } = ductRoute(slot, outlet, collarY, duct.route);
        const cutout = { w: outlet.widthFt, d: outlet.depthFt };
        const cabinetFloor = hoodCabinetFloor();

        return (
          <group
            key={slot.id}
            onClick={(event) => {
              event.stopPropagation();
              showToast("duct.callout", { size: outletSize() });
            }}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "auto")}
          >
            {/* The hole this duct needs in the floor of the cabinet above. */}
            {runsUp && cabinetFloor !== null && (
              <mesh position={[x, cabinetFloor, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[cutout.w, cutout.d]} />
                <meshBasicMaterial color={UTILITY_COLORS.duct} side={THREE.DoubleSide} />
              </mesh>
            )}
            {/* The transition off the canopy, with its back-draft damper. */}
            <Pipe
              from={[x, outlet.position[1], z]}
              to={[x, collarY, z]}
              radius={radius}
              color={UTILITY_COLORS.duct}
              hollow
            />
            <Fitting
              position={[x, collarY, z]}
              size={[radius * 2.4, ft(1.5), radius * 2.4]}
              color={UTILITY_COLORS.duct}
            />
            <Pipe
              from={[x, collarY, z]}
              to={end}
              radius={radius}
              color={UTILITY_COLORS.duct}
              hollow
            />
            {place === "inline" && (
              <Fitting
                position={inlineAt}
                size={[radius * 3.4, ft(14), radius * 3.4]}
                color={UTILITY_COLORS.duct}
              />
            )}
            {place === "remote" && (
              <Fitting
                position={end}
                size={[ft(20), ft(14), ft(20)]}
                color={UTILITY_COLORS.duct}
              />
            )}
            {place === "integral" && blower && (
              <Fitting
                position={[x, slot.position[1] + ft(slot.cutout.h) / 2, z]}
                size={[ft(12), ft(8), ft(10)]}
                color={UTILITY_COLORS.duct}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * One utility discipline, drawn from the slots' `utilities` records.
 *
 * Each type is its own mounted layer; install mode and the right-hand toggles
 * only flip `visible`, so switching views never rebuilds this geometry.
 */
export function UtilityLayer({ type }: { type: UtilityType }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const enabled = useAppStore((s) => s.visibleUtilities[type]);
  const showToast = useAppStore((s) => s.showToast);
  const selection = useSelection();
  const blower = useSelectedBlower();
  const visible = renderMode === "install" && enabled;

  // What each slot needs given what is actually in it, so swapping a gas range
  // for induction drops the gas line and thickens the circuit.
  const effective = useMemo(
    () =>
      Object.fromEntries(
        SLOTS.map((slot) => [
          slot.id,
          deriveUtilities(
            slot,
            selection[slot.id],
            slot.id === "slot-hood"
              ? effectiveCfm(selection["slot-hood"], blower)
              : null,
          ),
        ]),
      ) as Record<string, Utilities>,
    [selection, blower],
  );

  // A fixture's services are its own: there is no model to swap in that could
  // change them.
  const withFixtures = useMemo(
    () => ({
      ...effective,
      ...Object.fromEntries(FIXTURES.map((f) => [f.id, f.utilities])),
    }),
    [effective],
  );

  return (
    <group name={"utility-layer-" + type} visible={visible}>
      {type === "gas" && <GasRuns effective={effective} />}
      {type === "power" && <PowerRuns effective={effective} selection={selection} />}
      {type === "water" && <WaterRuns effective={withFixtures} />}
      {type === "duct" && (
        <DuctRuns
          effective={effective}
          blower={blower}
          selection={selection}
          showToast={showToast}
        />
      )}
    </group>
  );
}
