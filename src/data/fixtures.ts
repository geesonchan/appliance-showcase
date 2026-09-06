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

export const FIXTURES: Fixture[] = parsed.fixtures.map((record) => ({
  ...record,
  ...FIXTURE_PLACEMENT[record.id],
}));

export const FIXTURE_BY_ID: Record<FixtureId, Fixture> = Object.fromEntries(
  FIXTURES.map((fixture) => [fixture.id, fixture]),
) as Record<FixtureId, Fixture>;

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
