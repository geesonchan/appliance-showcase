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
