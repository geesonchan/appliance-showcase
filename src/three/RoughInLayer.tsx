import { useMemo } from "react";
import * as THREE from "three";
import { SLOT_ORDER } from "../data/catalogue";
import { resolveRoughIn, roughInFor, roughInSentence, type ResolvedPoint } from "../data/roughIn";
import { ROOM, ft, isOmitted } from "../data/slots";
import { formatDimension } from "../data/dimensions";
import { towerVents } from "../data/towerVent";
import { useAppStore } from "../store/useAppStore";
import { useSelection } from "../store/useSelection";
import { UTILITY_COLORS } from "./materials";
import type { SlotId } from "../types";

/** Which of the four service colours a connection reads as. */
const COLOUR: Record<string, string> = {
  power: UTILITY_COLORS.power120,
  water: UTILITY_COLORS.water,
  drain: UTILITY_COLORS.water,
  "air-gap": UTILITY_COLORS.water,
  gas: UTILITY_COLORS.gas,
  duct: UTILITY_COLORS.duct,
  "anti-tip": "#6B7268",
  "service-channel": "#6B7268",
};

/**
 * The connections each model actually needs, where its own drawing puts them.
 *
 * Drawn inside whichever box the manual says: the microwave's outlet in its own
 * opening, the dishwasher's power, water and drain in the *sink* base two
 * cabinets away. That last one is not a detail — it is the physical reason the
 * dishwasher has to be next to the sink, and drawing it in the dishwasher's own
 * opening would be a lie an installer finds on site.
 *
 * A short leader runs out to the front of the cabinet so the fitting can be
 * seen and clicked through a wireframed carcass.
 */
export function RoughInLayer() {
  const renderMode = useAppStore((s) => s.renderMode);
  const selection = useSelection();
  const showToast = useAppStore((s) => s.showToast);

  const points = useMemo(
    () =>
      SLOT_ORDER.flatMap((slotId) =>
        // A machine that is not in the room has nothing to rough in for.
        isOmitted(slotId)
          ? []
          : resolveRoughIn(slotId, selection[slotId]).map((resolved) => ({ slotId, resolved })),
      ),
    [selection],
  );
  // Read off the run, so rebuilt with it.
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const vents = useMemo(() => {
    void layoutVersion;
    return towerVents();
  }, [layoutVersion]);

  return (
    <group name="rough-in-layer" visible={renderMode === "install"}>
      {/* The vent in the top of each hung oven's opening, at the back. It is
          only ever drawn here: in the finished room it is behind the machine
          and under the cabinet over it, which is the point of putting it there. */}
      {vents.map((vent) => (
        <group
          key={vent.slot}
          position={vent.position}
          rotation={[0, vent.rotationY, 0]}
          onClick={(event) => {
            event.stopPropagation();
            showToast("towerVent.callout", {
              size: `${formatDimension(vent.widthIn)} × ${formatDimension(vent.depthIn)}`,
            });
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "auto")}
        >
          <mesh name="tower-vent" userData={{ slot: vent.slot }} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[ft(vent.widthIn), ft(vent.depthIn)]} />
            <meshBasicMaterial color={UTILITY_COLORS.duct} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {points.map(({ slotId, resolved }, i) => (
        <Fitting
          key={`${slotId}-${resolved.point.type}-${i}`}
          slotId={slotId}
          resolved={resolved}
          onSelect={() => {
            const { where, at } = roughInSentence(resolved.point);
            showToast("roughIn.callout", {
              type: resolved.point.type,
              where,
              at,
            });
          }}
        />
      ))}
    </group>
  );
}

function Fitting({
  slotId,
  resolved,
  onSelect,
}: {
  slotId: SlotId;
  resolved: ResolvedPoint;
  onSelect: () => void;
}) {
  const selection = useSelection();
  const colour = COLOUR[resolved.point.type] ?? UTILITY_COLORS.power120;
  const [x, y, z] = resolved.position;
  const source = roughInFor(selection[slotId])?.sourceUrl;
  void source;

  // The leader: out of the carcass toward the room, so it is visible and
  // clickable through a wireframe.
  const lead = useMemo(() => {
    const from = new THREE.Vector3(x, y, z);
    const to = from.clone();
    if (Math.abs(resolved.host.max[0] - resolved.host.min[0]) > Math.abs(resolved.host.max[2] - resolved.host.min[2])) {
      to.z = resolved.host.max[2] + ft(4);
    } else {
      to.x = resolved.host.max[0] + ft(4);
    }
    return new THREE.BufferGeometry().setFromPoints([from, to]);
  }, [x, y, z, resolved.host]);

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <mesh position={[x, y, z]}>
        <boxGeometry args={resolved.size} />
        <meshStandardMaterial color={colour} metalness={0.2} roughness={0.5} />
      </mesh>
      <lineSegments geometry={lead} raycast={() => null}>
        <lineBasicMaterial color={colour} transparent opacity={0.7} />
      </lineSegments>
      {resolved.highLoopY !== null && <HighLoop at={resolved.position} apex={resolved.highLoopY} colour={colour} />}
    </group>
  );
}

/**
 * A drain's high loop: up to its apex and back down.
 *
 * The apex height is the whole point of the detail — it is what stops the sink
 * draining back into the dishwasher, and it is a number an inspector checks.
 */
function HighLoop({
  at,
  apex,
  colour,
}: {
  at: [number, number, number];
  apex: number;
  colour: string;
}) {
  const geometry = useMemo(() => {
    const [x, y, z] = at;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x + ft(3), apex, z + ft(1)),
      new THREE.Vector3(x + ft(6), apex, z + ft(2)),
      new THREE.Vector3(x + ft(8), Math.max(y, ROOM.toeKick), z + ft(3)),
    ]);
    return new THREE.TubeGeometry(curve, 20, ft(0.8), 6, false);
  }, [at, apex]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={colour} metalness={0.2} roughness={0.55} />
    </mesh>
  );
}
