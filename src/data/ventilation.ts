import type { Appliance } from "../types";

/**
 * How much air the package actually moves.
 *
 * Most high-end hoods ship without a blower, and the ones that do carry no CFM
 * of their own: the number that matters — for duct sizing, and for whether
 * makeup air is raised — comes from the blower that was specified with it. The
 * makeup-air threshold itself is the `makeup-air` rule's, in data/rules.json,
 * and nowhere else (round 65).
 * See docs/decisions.md D6.
 */
export function effectiveCfm(
  hood: Appliance | undefined,
  blower: Appliance | null,
): number | null {
  if (!hood) return null;
  if (hood.blower === "required") return blower?.requires.cfm ?? null;
  return hood.requires.cfm;
}

/**
 * Airflow as it reads in copy.
 *
 * Separated at the thousand, because the install checklist already does and a
 * package that says "1,000 CFM" in one place and "1000 CFM" in another looks
 * like two different numbers.
 */
export const formatCfm = (cfm: number) => cfm.toLocaleString("en-US");
