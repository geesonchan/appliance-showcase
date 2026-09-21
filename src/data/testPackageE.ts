import appliancesFile from "../../data/appliances.json";
import { PACKAGE_BY_ID } from "./packages";
import type { Appliance, Package } from "../types";

/**
 * Package E's shape, for tests and prototypes until E is configured.
 *
 * One copy: round 55's checklist test built it inline, and round 68's overhang
 * and island-hood tests need the same package. Two hand-built E's would be one
 * more thing that could disagree with itself (D17).
 */
const CATALOGUE = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
const byModel = (model: string) => CATALOGUE.find((entry) => entry.model === model)!;

/** Package E's shape: cooking on the island, two columns, no wine and no range. */
export function testPackageE(id: string): Package {
  const a = PACKAGE_BY_ID["package-a"];
  const d = PACKAGE_BY_ID["package-d"];
  const b = PACKAGE_BY_ID["package-b"];
  const take = (pkg: Package, slotId: string) => pkg.slots.find((s) => s.slotId === slotId)!;
  const hood = take(a, "slot-hood");
  return {
    ...d,
    id,
    columnOrder: ["slot-freezer", "slot-fridge"],
    defaultLayout: {
      sinkLeg: "back",
      fridgeEnd: "left",
      coffeeLeg: "back",
      backWallIn: 240,
      leftWallIn: 168,
      // A cooktop island's aisle, since round 56, and D20's 24" island.
      aisleIn: 48,
      islandOverhangIn: 15,
      islandDepthIn: 24,
    },
    slots: [
      { ...take(d, "slot-freezer"), widthIn: 18 },
      take(d, "slot-fridge"),
      { ...take(b, "slot-microwave"), beside: "run" },
      { ...take(d, "slot-coffee"), standsOver: null },
      take(a, "slot-dishwasher"),
      {
        ...hood,
        slotId: "slot-cooktop",
        category: "cooktop",
        widthIn: 36,
        installType: "drop-in",
        builtForCooktopIn: null,
        heightIn: null,
        depthIn: null,
        utilities: { gas: null, power: { voltage: 240, amps: 50, dedicated: true }, duct: null },
      },
      // Ducted as HMIB42WS's guide shows; an island hood may not be declared
      // up through a cabinet or out through a wall (round 58).
      { ...hood, widthIn: 42, installType: "island", builtForCooktopIn: 36, utilities: { gas: null, power: null, duct: { diameterIn: 8, route: "through-ceiling" } } },
    ],
    defaultSelection: {
      "slot-freezer": byModel("T18IF900SP").id,
      "slot-fridge": byModel("T30IR905SP").id,
      "slot-microwave": byModel("MEM301WS").id,
      "slot-coffee": byModel("TCM24PS").id,
      "slot-dishwasher": byModel("SHV78CM3N").id,
      "slot-cooktop": byModel("CIT367YG").id,
      "slot-hood": byModel("HMIB42WS").id,
    },
  } as Package;
}
