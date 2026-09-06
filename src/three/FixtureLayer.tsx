import { bowlExtent, FIXTURES } from "../data/fixtures";
import { ROOM, ft } from "../data/slots";
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
 * An undermount bowl and a faucet.
 *
 * The bowl is drawn as a recess sunk into the counter rather than a solid, so
 * the white model reads as an opening in the run — which is what it is, and
 * what the cabinetmaker cuts.
 */
function Sink({ fixture }: { fixture: Fixture }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const bowl = fixture.bowlIn;
  if (!bowl) return null;

  const extent = bowlExtent(fixture);
  if (!extent) return null;

  const [x, , z] = fixture.position;
  // The finished top: a 34.5" box under a 1.5" counter. The counter is cut
  // around this basin rather than laid over it, so the two never share a plane
  // and cannot z-fight; see `counterPieces` in data/cabinets.ts.
  const counterTop = ROOM.counterHeight;
  const w = ft(bowl.w);
  const d = ft(bowl.d);
  const h = ft(bowl.h);
  const bowlZ = z + extent.acrossCentre;

  // A sink and its faucet are stainless whatever the cabinetry is doing, and
  // the finish helper already knows how each render mode treats it.
  const metal = finishSurface(renderMode, "stainless");

  return (
    <group userData={{ fixture: fixture.id }}>
      {/* The basin, its rim flush with the finished counter. */}
      <mesh position={[x, counterTop - h / 2, bowlZ]} receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          key={renderMode}
          color={metal.color}
          metalness={metal.metalness}
          roughness={metal.roughness}
        />
      </mesh>
      {/* Faucet: a riser behind the bowl with a spout reaching over it. */}
      <mesh position={[x, counterTop + ft(5), bowlZ - d / 2 - ft(1.5)]} castShadow>
        <cylinderGeometry args={[ft(0.6), ft(0.6), ft(10), 10]} />
        <meshStandardMaterial
          key={renderMode}
          color={metal.color}
          metalness={metal.metalness}
          roughness={metal.roughness}
        />
      </mesh>
      <mesh position={[x, counterTop + ft(10), bowlZ - d / 4]} castShadow>
        <boxGeometry args={[ft(1.2), ft(1.2), d / 2 + ft(1.5)]} />
        <meshStandardMaterial
          key={renderMode}
          color={metal.color}
          metalness={metal.metalness}
          roughness={metal.roughness}
        />
      </mesh>
    </group>
  );
}
