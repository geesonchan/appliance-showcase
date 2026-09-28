import type { Appliance, Slot, Utilities } from "../types";
import { ductDiameterFor, gasPipeFor } from "./rules";

/**
 * What the rough-in actually has to be for a given appliance in a given slot.
 *
 * The slot carries what was roughed in; the appliance carries what it needs.
 * Where they differ the appliance wins, because that is the change the install
 * view exists to show: swapping a gas range for induction should visibly drop
 * the gas line and turn the branch circuit into a 240V feeder.
 *
 * The gas pipe and the duct size are asked of `data/rules.json`, the same
 * figures the checklist uses — one copy each (round 78, D17's table).
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
            // The `gas-pipe-size` rule's own threshold and pipe (round 78).
            pipeSize: gasPipeFor(requires.gasBTU),
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
            // `thresholds.duct` in data/rules.json, the checklist's own figure
            // (round 78). This read 8" at exactly 400 CFM where the table says 6".
            diameterIn: ductDiameterFor(cfm)!,
            route: slot.utilities.duct.route,
          },
  };
}
