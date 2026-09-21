import { PACKAGE_BY_ID } from "./packages";
import type { Package } from "../types";

/**
 * Package E under another id, for tests that register a copy of it.
 *
 * One copy of E, in data/packages.json (round 69). Until E was configured,
 * this built E's shape by hand out of A, B and D — and in doing so carried
 * D's blower along, which E's island hood, with a blower of its own, does
 * not take. A hand-built second E is one more thing that can disagree with
 * itself (D17), so there is none.
 */
export function testPackageE(id: string): Package {
  return { ...PACKAGE_BY_ID["package-e"], id };
}
