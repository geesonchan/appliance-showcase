import type { Appliance, Slot, Utilities } from "../types";

/**
 * What the rough-in actually has to be for a given appliance in a given slot.
 *
 * The slot carries what was roughed in; the appliance carries what it needs.
 * Where they differ the appliance wins, because that is the change the install
 * view exists to show: swapping a gas range for induction should visibly drop
 * the gas line and turn the branch circuit into a 240V feeder.
 *
 * The two thresholds below are sizing conventions, not validation. M2 step 3
 * moves them into `data/rules.json` alongside the §3.5.4 checks so Leo can
 * maintain them.
 */
export function deriveUtilities(
  slot: Slot,
  appliance: Appliance | undefined,
  /** For a hood, the blower actually moving the air. */
  effectiveCfmIn: number | null = null,
): Utilities {
  if (!appliance) return slot.utilities;
  const { requires } = appliance;
  const cfm = effectiveCfmIn ?? requires.cfm;

  return {
    gas:
      requires.gasBTU === null
        ? null
        : {
            // A 1/2" line runs out of capacity around 65,000 BTU on a typical
            // residential run.
            pipeSize: requires.gasBTU > 65_000 ? '3/4"' : '1/2"',
            shutoff: true,
          },
    power: {
      voltage: requires.voltage,
      amps: requires.amps ?? slot.utilities.power.amps,
      dedicated: true,
    },
    water: requires.water
      ? { supply: true, drain: slot.utilities.water?.drain ?? false }
      : null,
    duct:
      slot.utilities.duct === null || cfm === null
        ? slot.utilities.duct
        : {
            // 6" to 400 CFM, 8" to 600, 10" above that.
            diameterIn: cfm > 600 ? 10 : cfm >= 400 ? 8 : 6,
            route: slot.utilities.duct.route,
          },
  };
}
