import { useMemo } from "react";
import * as THREE from "three";
import { ROOM, SLOTS, ft } from "../data/slots";
import { deriveUtilities } from "../data/utilities";
import { useAppStore } from "../store/useAppStore";
import { useSelection, useSelectedBlower } from "../store/useSelection";
import { effectiveCfm } from "../data/ventilation";
import type { Slot, UtilityType, Utilities } from "../types";
import { UTILITY_COLORS, UTILITY_RADIUS_IN } from "./materials";

const UP = new THREE.Vector3(0, 1, 0);

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

/** A straight run of pipe between two points. */
function Pipe({
  from,
  to,
  radius,
  color,
  hollow = false,
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
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, hollow ? 16 : 10, 1, hollow]} />
      <meshStandardMaterial
        color={color}
        metalness={hollow ? 0.35 : 0.2}
        roughness={0.55}
        side={hollow ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}

/** A small fitting: shutoff valve, outlet box, panel, drain stub. */
function Fitting({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.2} roughness={0.5} />
    </mesh>
  );
}

/** Where a slot meets its wall, at a given standoff from the wall plane. */
function wallAnchor(slot: Slot, standoff: number) {
  const onLeftWall = Math.abs(slot.rotationY - Math.PI / 2) < 0.01;
  return {
    onLeftWall,
    x: onLeftWall ? -ROOM.halfX + standoff : slot.position[0],
    z: onLeftWall ? slot.position[2] : -ROOM.halfZ + standoff,
  };
}

/**
 * Island slots have no wall to run along. Their services come up through the
 * floor inside the cabinet, which is what the install view draws: a riser from
 * the slab, no trunk. The route under the slab is not modelled, because
 * nothing in this scene knows where it goes.
 */
const isIsland = (slot: Slot) => slot.mount === "island";

/** Every service enters at the back wall, far right. */
const entry = (standoff: number) => ({
  x: ROOM.halfX - ft(4),
  z: -ROOM.halfZ + standoff,
});

/** Inside corner where the back wall meets the left wall. */
const corner = (standoff: number) => ({
  x: -ROOM.halfX + standoff,
  z: -ROOM.halfZ + standoff,
});

/**
 * A trunk route from the service entry to a slot, at a fixed height. Runs stay
 * on the walls: back wall first, then around the corner onto the left wall,
 * never diagonally across the floor.
 */
function trunkPoints(
  slot: Slot,
  y: number,
  standoff = STANDOFF.default,
): [number, number, number][] {
  const anchor = wallAnchor(slot, standoff);
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
        <mesh key={"elbow-" + i} position={elbow}>
          <sphereGeometry args={[radius, 10, 8]} />
          <meshStandardMaterial color={color} metalness={0.2} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

/** The height an appliance actually lands its connection at. */
const connectionHeight = (slot: Slot) => slot.position[1] + ft(slot.cutout.h) * 0.45;

function GasRuns({ effective }: { effective: Record<string, Utilities> }) {
  const r = ft(UTILITY_RADIUS_IN.gas);
  return (
    <group name="utility-gas">
      {SLOTS.map((slot) => {
        const gas = effective[slot.id].gas;
        if (!gas) return null;
        const a = wallAnchor(slot, STANDOFF.default);
        const riserTop = ft(26);
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
function PowerRuns({ effective }: { effective: Record<string, Utilities> }) {
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
        const a = wallAnchor(slot, STANDOFF.default);
        const is240 = effective[slot.id].power.voltage === 240;
        const color = is240 ? UTILITY_COLORS.power240 : UTILITY_COLORS.power120;
        const radius = ft(is240 ? UTILITY_RADIUS_IN.power240 : UTILITY_RADIUS_IN.power120);
        const trunkY = is240 ? HEIGHT.power240Trunk : HEIGHT.power120;
        const outletY = is240 ? connectionHeight(slot) : HEIGHT.power120;
        const box: [number, number, number] = a.onLeftWall
          ? [ft(2), ft(4.5), ft(3)]
          : [ft(3), ft(4.5), ft(2)];

        if (isIsland(slot)) {
          const [x, , z] = slot.position;
          // Behind the appliance, whichever way its door faces.
          const back = z - Math.cos(slot.rotationY) * ft(6);
          return (
            <group key={slot.id}>
              <Pipe
                from={[x, 0, back]}
                to={[x, outletY, back]}
                radius={radius}
                color={color}
              />
              <Fitting
                position={[x, outletY, back]}
                size={[ft(3), ft(4.5), ft(2)]}
                color={color}
              />
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

function WaterRuns({ effective }: { effective: Record<string, Utilities> }) {
  const r = ft(UTILITY_RADIUS_IN.water);
  return (
    <group name="utility-water">
      {SLOTS.map((slot) => {
        const w = effective[slot.id].water;
        if (!w) return null;
        const supply = wallAnchor(slot, STANDOFF.default);
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

function DuctRuns({ effective }: { effective: Record<string, Utilities> }) {
  return (
    <group name="utility-duct">
      {SLOTS.map((slot) => {
        const duct = effective[slot.id].duct;
        if (!duct || duct.route === "recirc") return null;
        const radius = ft(duct.diameterIn) / 2;
        const top = slot.position[1] + ft(slot.cutout.h) * 0.55;
        const a = wallAnchor(slot, STANDOFF.default);
        if (duct.route === "back-wall") {
          return (
            <Pipe
              key={slot.id}
              from={[slot.position[0], top, slot.position[2]]}
              to={[slot.position[0], top, -ROOM.halfZ]}
              radius={radius}
              color={UTILITY_COLORS.duct}
              hollow
            />
          );
        }
        // up-through-cabinet: rises from the hood collar out through the ceiling
        return (
          <Pipe
            key={slot.id}
            from={[slot.position[0], top, a.z + ft(8)]}
            to={[slot.position[0], ROOM.wallHeight, a.z + ft(8)]}
            radius={radius}
            color={UTILITY_COLORS.duct}
            hollow
          />
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

  return (
    <group name={"utility-layer-" + type} visible={visible}>
      {type === "gas" && <GasRuns effective={effective} />}
      {type === "power" && <PowerRuns effective={effective} />}
      {type === "water" && <WaterRuns effective={effective} />}
      {type === "duct" && <DuctRuns effective={effective} />}
    </group>
  );
}
