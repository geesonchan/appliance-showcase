import { FIXTURES, sinkParts } from "../data/fixtures";
import { ROOM } from "../data/slots";
import { useAppStore } from "../store/useAppStore";
import { finishSurface } from "./materials";
import type { Fixture } from "../types";

/**
 * The fittings the room has rather than the products it was sold.
 *
 * Drawn beside the appliances rather than among them: a fixture has no finish
 * to swap and no alternatives to compare, so it takes the counter's own
 * material in every render mode and never carries a pin. It is here because the
 * layout rules need it — the dishwasher's position is defined relative to the
 * sink, and a kitchen drawn without one explains nothing about where the
 * plumbing goes. See docs/decisions.md D11.
 */
export function FixtureLayer() {
  const showCabinets = useAppStore((s) => s.showCabinets);
  return (
    <group name="fixture-layer" visible={showCabinets}>
      {FIXTURES.map((fixture) => (
        <Sink key={fixture.id} fixture={fixture} />
      ))}
    </group>
  );
}

/**
 * An undermount bowl and a faucet, turned to face the way its run does.
 *
 * The bowl is drawn as a recess sunk into the counter rather than a solid, so
 * the white model reads as an opening in the run — which is what it is, and
 * what the cabinetmaker cuts.
 *
 * Everything is drawn in the run's own frame inside a rotated group, the same
 * as an appliance. Drawing it in world coordinates is why the tap stayed
 * pointing at the back wall after the sink moved to the left one.
 */
function Sink({ fixture }: { fixture: Fixture }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const parts = sinkParts(fixture);
  if (!parts) return null;

  const { basin, riser, spout } = parts;
  const counterTop = ROOM.counterHeight;
  // A sink and its faucet are stainless whatever the cabinetry is doing, and
  // the finish helper already knows how each render mode treats it.
  const metal = finishSurface(renderMode, "stainless");
  const Steel = () => (
    <meshStandardMaterial
      key={renderMode}
      color={metal.color}
      metalness={metal.metalness}
      roughness={metal.roughness}
    />
  );

  return (
    <group
      position={fixture.position}
      rotation={[0, fixture.rotationY, 0]}
      userData={{ fixture: fixture.id }}
    >
      {/* The basin, its rim flush with the finished counter. */}
      <mesh position={[basin.x, counterTop - basin.h / 2, basin.z]} receiveShadow>
        <boxGeometry args={[basin.w, basin.h, basin.d]} />
        <Steel />
      </mesh>
      {/* Faucet: a riser on the wall side with a spout reaching over the bowl. */}
      <mesh position={[riser.x, counterTop + riser.h / 2, riser.z]} castShadow>
        <cylinderGeometry args={[riser.r, riser.r, riser.h, 10]} />
        <Steel />
      </mesh>
      <mesh position={[spout.x, counterTop + riser.h, spout.z]} castShadow>
        <boxGeometry args={[spout.w, spout.w, spout.reach]} />
        <Steel />
      </mesh>
    </group>
  );
}
