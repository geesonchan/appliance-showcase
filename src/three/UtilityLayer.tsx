import { useMemo } from "react";
import * as THREE from "three";
import { ROOM, SLOTS, ft } from "../data/slots";
import { useAppStore } from "../store/useAppStore";
import type { Slot, UtilityType } from "../types";
import { UTILITY_COLORS } from "./materials";

const UP = new THREE.Vector3(0, 1, 0);

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

/** Where a slot meets its wall, and which way "along the wall" points. */
function wallAnchor(slot: Slot) {
  const onLeftWall = Math.abs(slot.rotationY) > 0.01;
  return {
    onLeftWall,
    // Just clear of the wall plane so pipes read against it.
    x: onLeftWall ? -ROOM.halfX + ft(2) : slot.position[0],
    z: onLeftWall ? slot.position[2] : -ROOM.halfZ + ft(2),
  };
}

/** Where each service enters the room: back wall, far right. */
const ENTRY = { x: ROOM.halfX - ft(4), z: -ROOM.halfZ + ft(2) };

function GasRuns() {
  const runs: JSX.Element[] = [];
  const r = ft(0.75);
  for (const slot of SLOTS) {
    if (!slot.utilities.gas) continue;
    const a = wallAnchor(slot);
    const trunkY = ft(10);
    const riserTop = ft(26);
    runs.push(
      <group key={slot.id}>
        {/* trunk along the wall from the service entry to the appliance */}
        <Pipe
          from={[ENTRY.x, trunkY, ENTRY.z]}
          to={[a.x, trunkY, a.z]}
          radius={r}
          color={UTILITY_COLORS.gas}
        />
        {/* riser up to the connection height behind the range */}
        <Pipe
          from={[a.x, trunkY, a.z]}
          to={[a.x, riserTop, a.z]}
          radius={r}
          color={UTILITY_COLORS.gas}
        />
        {/* shutoff valve */}
        {slot.utilities.gas.shutoff && (
          <Fitting
            position={[a.x, riserTop, a.z]}
            size={[ft(4), ft(3), ft(3)]}
            color={UTILITY_COLORS.gas}
          />
        )}
      </group>,
    );
  }
  return <group name="utility-gas">{runs}</group>;
}

function PowerRuns() {
  const r = ft(0.4);
  const trunkY = ft(46);
  return (
    <group name="utility-power">
      {/* service panel the branch circuits home-run back to */}
      <Fitting
        position={[ENTRY.x, ft(54), ENTRY.z]}
        size={[ft(14), ft(20), ft(4)]}
        color={UTILITY_COLORS.power240}
      />
      {SLOTS.map((slot) => {
        const a = wallAnchor(slot);
        const { voltage } = slot.utilities.power;
        const color = voltage === 240 ? UTILITY_COLORS.power240 : UTILITY_COLORS.power120;
        // Outlets sit at the height the appliance actually connects.
        const outletY = slot.position[1] + ft(slot.cutout.h) * 0.45;
        return (
          <group key={slot.id}>
            <Pipe
              from={[ENTRY.x, trunkY, ENTRY.z]}
              to={[a.x, trunkY, a.z]}
              radius={r}
              color={color}
            />
            <Pipe
              from={[a.x, trunkY, a.z]}
              to={[a.x, outletY, a.z]}
              radius={r}
              color={color}
            />
            <Fitting
              position={[a.x, outletY, a.z]}
              size={
                a.onLeftWall ? [ft(2), ft(4.5), ft(3)] : [ft(3), ft(4.5), ft(2)]
              }
              color={color}
            />
          </group>
        );
      })}
    </group>
  );
}

function WaterRuns() {
  const r = ft(0.5);
  const supplyY = ft(16);
  const drainY = ft(8);
  return (
    <group name="utility-water">
      {SLOTS.map((slot) => {
        const w = slot.utilities.water;
        if (!w) return null;
        const a = wallAnchor(slot);
        return (
          <group key={slot.id}>
            {w.supply && (
              <>
                <Pipe
                  from={[ENTRY.x, supplyY, ENTRY.z]}
                  to={[a.x, supplyY, a.z]}
                  radius={r}
                  color={UTILITY_COLORS.water}
                />
                <Fitting
                  position={[a.x, supplyY, a.z]}
                  size={[ft(3), ft(3), ft(3)]}
                  color={UTILITY_COLORS.water}
                />
              </>
            )}
            {w.drain && (
              <Pipe
                from={[a.x, drainY, a.z]}
                to={[ENTRY.x, drainY, ENTRY.z]}
                radius={r * 1.6}
                color={UTILITY_COLORS.water}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

function DuctRuns() {
  return (
    <group name="utility-duct">
      {SLOTS.map((slot) => {
        const duct = slot.utilities.duct;
        if (!duct || duct.route === "recirc") return null;
        const radius = ft(duct.diameterIn) / 2;
        const top = slot.position[1] + ft(slot.cutout.h) * 0.55;
        const a = wallAnchor(slot);
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
  const visible = renderMode === "install" && enabled;

  return (
    <group name={"utility-layer-" + type} visible={visible}>
      {type === "gas" && <GasRuns />}
      {type === "power" && <PowerRuns />}
      {type === "water" && <WaterRuns />}
      {type === "duct" && <DuctRuns />}
    </group>
  );
}
