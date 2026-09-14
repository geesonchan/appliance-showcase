import { useMemo } from "react";
import * as THREE from "three";
import type { LineTier } from "../data/roughIn";
import { listRoughIn, roughInCallout, type RoughInItem } from "../data/roughInList";
import { ROOM, ft } from "../data/slots";
import { formatDimension } from "../data/dimensions";
import { towerVents } from "../data/towerVent";
import { useAppStore } from "../store/useAppStore";
import { useRoughInFocus } from "../store/useRoughInFocus";
import { useSelection } from "../store/useSelection";
import { UNCONFIRMED, UNREVIEWED, UTILITY_COLORS } from "./materials";

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

const DASH = { dashSize: ft(1.2), gapSize: ft(0.8) };
/** The point picked in the list: a colour no service uses. */
const FOCUS = "#C2185B";
/**
 * The side of the invisible box a click on a point lands in, in inches. A
 * fitting is often 3" across, and what shows of it on screen is its outline and
 * leader rather than anything a ray passes through; round 43's probe found a
 * click on one passing through no rough-in point at all. Round 44.
 */
const HITBOX_IN = 7;
const HIT = THREE.Mesh.prototype.raycast;
const NO_HIT: THREE.Mesh["raycast"] = () => {};

/** The line material for each tier. */
function lineMaterial(tier: LineTier, colour: string, dash = DASH): THREE.Material {
  if (tier === "unconfirmed") return new THREE.LineDashedMaterial({ color: colour, ...dash });
  if (tier === "unreviewed") {
    return new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: UNREVIEWED.opacity });
  }
  return new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.7 });
}

/**
 * The connections each model actually needs, where its own entry puts them.
 *
 * Drawn inside whichever box the entry says: the microwave's outlet in its own
 * opening, the dishwasher's power, water and drain in the *sink* base two
 * cabinets away. That last one is not a detail — it is the physical reason the
 * dishwasher has to be next to the sink, and drawing it in the dishwasher's own
 * opening would be a lie an installer finds on site.
 *
 * How each is drawn says where its figures come from (D21), in three looks with
 * one meaning each: solid in the service's colour off a drawing, grey dashed
 * where it is reviewed but not confirmed, faint thin grey where nobody has
 * reviewed it. The callout names which. The point picked in the panel's list is
 * marked on top of everything, so it can be found behind an appliance.
 *
 * Nothing here takes a click outside the install view: the layer is only
 * hidden there, and a hidden mesh still takes a raycast, which would put these
 * in front of the appliances a customer is clicking.
 */
export function RoughInLayer() {
  const renderMode = useAppStore((s) => s.renderMode);
  const selection = useSelection();
  const showToast = useAppStore((s) => s.showToast);
  const active = useRoughInFocus((s) => s.active);
  const setActive = useRoughInFocus((s) => s.setActive);
  const install = renderMode === "install";

  const items = useMemo(() => listRoughIn(selection), [selection]);
  // Read off the run, so rebuilt with it.
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const vents = useMemo(() => {
    void layoutVersion;
    return towerVents();
  }, [layoutVersion]);

  return (
    <group name="rough-in-layer" visible={install}>
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
          <mesh
            name="tower-vent"
            userData={{ slot: vent.slot }}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={install ? HIT : NO_HIT}
          >
            <planeGeometry args={[ft(vent.widthIn), ft(vent.depthIn)]} />
            <meshBasicMaterial color={UTILITY_COLORS.duct} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {items.map((item) => (
        <Fitting
          key={item.key}
          item={item}
          install={install}
          active={active === item.key}
          onSelect={() => {
            setActive(item.key);
            const callout = roughInCallout(item);
            showToast(callout.key, callout.vars);
          }}
        />
      ))}
    </group>
  );
}

function Fitting({
  item,
  install,
  active,
  onSelect,
}: {
  item: RoughInItem;
  install: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const { resolved, tier } = item;
  const colour =
    tier === "confirmed"
      ? (COLOUR[resolved.point.type] ?? UTILITY_COLORS.power120)
      : tier === "unconfirmed"
        ? UNCONFIRMED
        : UNREVIEWED.color;
  const [x, y, z] = resolved.position;
  // At least the hitbox's size each way, and never smaller than the fitting.
  const hitbox = resolved.size.map((side) => Math.max(side, ft(HITBOX_IN))) as [number, number, number];

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
    const line = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([from, to]),
      lineMaterial(tier, colour),
    );
    line.computeLineDistances();
    line.raycast = () => null;
    return line;
  }, [x, y, z, resolved.host, tier, colour]);

  // Anything short of confirmed is an outline round a faint box, dashed where it
  // has been reviewed and thin where it has not.
  const outline = useMemo(() => {
    if (tier === "confirmed") return null;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(...resolved.size)),
      lineMaterial(tier, colour, { dashSize: ft(0.5), gapSize: ft(0.35) }),
    );
    edges.position.set(x, y, z);
    edges.computeLineDistances();
    edges.raycast = () => null;
    return edges;
  }, [tier, colour, x, y, z, resolved.size]);

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <mesh position={[x, y, z]} userData={{ roughIn: item.key, tier }} raycast={install ? HIT : NO_HIT}>
        <boxGeometry args={resolved.size} />
        {tier === "confirmed" ? (
          <meshStandardMaterial color={colour} metalness={0.2} roughness={0.5} />
        ) : (
          <meshBasicMaterial
            color={colour}
            transparent
            opacity={tier === "unconfirmed" ? 0.18 : 0.1}
            depthWrite={false}
          />
        )}
      </mesh>
      {/* What a click lands in: bigger than the fitting, never drawn, and only
          there in the install view. */}
      {install && (
        <mesh position={[x, y, z]} name="rough-in-hitbox" userData={{ roughIn: item.key, hitbox: true }}>
          <boxGeometry args={hitbox} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
      {outline && <primitive object={outline} />}
      <primitive object={lead} />
      {resolved.highLoopY !== null && (
        <HighLoop at={resolved.position} apex={resolved.highLoopY} colour={colour} tier={tier} />
      )}
      {/* The point picked in the list, drawn over whatever stands in front of it. */}
      {active && (
        <mesh position={[x, y, z]} renderOrder={999} raycast={() => null} name="rough-in-focus">
          <sphereGeometry args={[ft(4), 20, 14]} />
          <meshBasicMaterial color={FOCUS} transparent opacity={0.5} depthTest={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/**
 * A drain's high loop: up to its apex and back down.
 *
 * The apex height is the whole point of the detail — it is what stops the sink
 * draining back into the dishwasher, and it is a number an inspector checks. So
 * where that number is not off a drawing the loop is a line, not a pipe.
 */
function HighLoop({
  at,
  apex,
  colour,
  tier,
}: {
  at: [number, number, number];
  apex: number;
  colour: string;
  tier: LineTier;
}) {
  const curve = useMemo(() => {
    const [x, y, z] = at;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x + ft(3), apex, z + ft(1)),
      new THREE.Vector3(x + ft(6), apex, z + ft(2)),
      new THREE.Vector3(x + ft(8), Math.max(y, ROOM.toeKick), z + ft(3)),
    ]);
  }, [at, apex]);

  const line = useMemo(() => {
    if (tier === "confirmed") return null;
    const drawn = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)),
      lineMaterial(tier, colour),
    );
    drawn.computeLineDistances();
    drawn.raycast = () => null;
    return drawn;
  }, [tier, curve, colour]);

  const tube = useMemo(
    () => (tier === "confirmed" ? new THREE.TubeGeometry(curve, 20, ft(0.8), 6, false) : null),
    [tier, curve],
  );

  if (line) return <primitive object={line} />;
  return (
    <mesh geometry={tube!} raycast={() => null}>
      <meshStandardMaterial color={colour} metalness={0.2} roughness={0.55} />
    </mesh>
  );
}
