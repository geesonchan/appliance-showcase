import fixturesFile from "../../data/fixtures.json";
import { FIXTURE_PLACEMENT } from "./room";
import { fixturesFileSchema, parseDataFile } from "./schema";
import type { Fixture, FixtureId } from "../types";

/**
 * The fittings the kitchen has, as opposed to the products it was sold.
 *
 * A sink takes up a cabinet segment and needs supply and drain roughed in, so
 * the layout rules and the install view both have to know about it — but it has
 * no brand, no price and no alternatives to swap between. Putting it in the
 * appliance catalogue would give it all three and make it a line on a quote.
 * See docs/decisions.md D11.
 */
const parsed = parseDataFile(fixturesFileSchema, fixturesFile, "data/fixtures.json");

export let FIXTURES: Fixture[];
export let FIXTURE_BY_ID: Record<FixtureId, Fixture>;

/** Re-place the fittings against the room as it now stands. */
export function rebuildFixtures() {
  FIXTURES = parsed.fixtures.map((record) => ({ ...record, ...FIXTURE_PLACEMENT[record.id] }));
  FIXTURE_BY_ID = Object.fromEntries(
    FIXTURES.map((fixture) => [fixture.id, fixture]),
  ) as Record<FixtureId, Fixture>;
}

rebuildFixtures();

/**
 * Where a fixture's basin sits, in run-local feet: how far it reaches along the
 * run either side of centre, and how far across it from the run's centre line.
 *
 * The counter and the basin both read this, so the hole in the top and the bowl
 * that drops into it cannot drift apart.
 */
export function bowlExtent(fixture: Fixture) {
  if (!fixture.bowlIn) return null;
  return {
    alongHalf: fixture.bowlIn.w / 24,
    /** Set 1" toward the room, as an undermount bowl is. */
    acrossCentre: 1 / 12,
    acrossHalf: fixture.bowlIn.d / 24,
    depth: fixture.bowlIn.h / 12,
  };
}

/**
 * The parts of a sink, in the run's own frame.
 *
 * Along the run is x and across it is z, with the wall at negative z — the same
 * frame every appliance is drawn in. The faucet goes against the wall side of
 * the bowl because that is where the supply comes up, and the spout reaches
 * back over it. Working these out here rather than in the layer is what makes
 * "the faucet is within four inches of the wall" a thing a test can ask,
 * whichever leg the sink ended up on.
 */
export function sinkParts(fixture: Fixture) {
  const bowl = fixture.bowlIn;
  const extent = bowlExtent(fixture);
  if (!bowl || !extent) return null;

  const w = bowl.w / 12;
  const d = bowl.d / 12;
  const h = bowl.h / 12;
  const across = extent.acrossCentre;
  /** The wall side of the basin, which is where the tap deck is. */
  const behind = across - d / 2 - 1.5 / 12;

  return {
    basin: { w, d, h, x: 0, z: across },
    riser: { r: 0.6 / 12, h: 10 / 12, x: 0, z: behind },
    spout: { w: 1.2 / 12, reach: d / 2 + 1.5 / 12, x: 0, z: across - d / 4 },
  };
}
