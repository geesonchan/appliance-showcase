import type { Appliance, SlotId } from "../types";
import { APPLIANCE_BY_ID } from "./catalogue";
import type { RequirementItem } from "./layoutTemplate";
import { PACKAGE } from "./packages";
import { SLOT_BY_ID, SLOT_RECORDS } from "./slots";

/**
 * What a machine is called, wherever the page names it.
 *
 * Round 99, Leo: "标签跟着选中的机器走，按类别和安装方式取词，所有显示的地方都经同一个函数".
 * A slot's name used to be the slot's, whatever stood in it: B's and E's
 * combination oven was "Microwave" on every pin, card and line from the day
 * it went in, and an oven tower swapped to a double oven kept "Steam oven".
 * Now the machine says what it is, by its category and how it installs; the
 * slot keeps its own name only where that says more about the same machine.
 */
export type MachineKind =
  | "refrigerator"
  | "refrigeratorColumn"
  | "freezer"
  | "wine"
  | "wineColumn"
  | "dishwasher"
  | "coffee"
  | "cooktop"
  | "hood"
  | "otr"
  | "range"
  | "rangetop"
  | "microwaveDrawer"
  | "comboOven"
  | "steamOven"
  | "doubleOven"
  | "singleOven";

/**
 * Every name the page could not find and fell back for (round 99c, Leo:
 * "查不到名字：用那个位置自己的名字"). Since round 99 a name not found threw, and
 * in round 99b one throw emptied the page; now the page goes on, and this list
 * is how the words test still says no name was missing.
 */
export const NAME_FALLBACKS: string[] = [];

function fellBack(what: string) {
  if (!NAME_FALLBACKS.includes(what)) console.error(`machineLabel: ${what}`);
  NAME_FALLBACKS.push(what);
}

/** What a machine is, by its category and how it installs; null for a kind with no name. */
export function kindOf(appliance: Appliance): MachineKind | null {
  const has = (type: string) => (appliance.installType as readonly string[]).includes(type);
  switch (appliance.category) {
    case "wall-oven":
      return has("combo") ? "comboOven" : has("steam") ? "steamOven" : has("double") ? "doubleOven" : "singleOven";
    case "range":
      return has("rangetop") ? "rangetop" : "range";
    case "microwave":
      return "microwaveDrawer";
    case "otr":
      return "otr";
    case "refrigerator":
      return has("column") ? "refrigeratorColumn" : "refrigerator";
    case "wine":
      return has("column") ? "wineColumn" : "wine";
    case "freezer":
    case "dishwasher":
    case "coffee":
    case "cooktop":
    case "hood":
      return appliance.category;
    default:
      return null;
  }
}

/** The name of each kind on a pin, a card, the list and the quote. */
const LABEL: Record<MachineKind, string> = {
  refrigerator: "slot.fridge",
  refrigeratorColumn: "slot.fridge",
  freezer: "slot.freezer",
  wine: "slot.wine",
  wineColumn: "slot.wineColumn",
  dishwasher: "slot.dishwasher",
  coffee: "slot.coffee",
  cooktop: "slot.cooktop",
  hood: "slot.hood",
  otr: "slot.otr",
  range: "slot.range",
  rangetop: "slot.rangetop",
  microwaveDrawer: "slot.microwave",
  comboOven: "slot.comboOven",
  steamOven: "slot.oven",
  doubleOven: "slot.doubleOven",
  singleOven: "slot.singleOven",
};

/**
 * A slot's own name, where the slot keeps one, and the machine it is the
 * name of: D's second dishwasher; E's wine cooler under the coffee machine,
 * called as every wine cooler is since round 99. Any other machine in that
 * slot is called what it is.
 */
const OWN_NAME: Record<string, MachineKind> = {
  "slot.dishwasher2": "dishwasher",
  "slot.wine2": "wine",
};

/** What a slot is called on the page, with this machine in it. */
export function slotLabelKey(slotId: SlotId, appliance?: Appliance): string {
  const own = SLOT_BY_ID[slotId].labelKey;
  if (!appliance) return own;
  const kind = kindOf(appliance);
  if (!kind) {
    fellBack(`no name for a ${appliance.category} (${appliance.model}) in ${slotId}`);
    return own;
  }
  return OWN_NAME[own] === kind ? own : LABEL[kind];
}

/** The name of each kind on a wall's bill, where a machine stands on the wall. */
const BILL: Partial<Record<MachineKind, string>> = {
  refrigerator: "requirement.fridge",
  refrigeratorColumn: "requirement.fridgeColumn",
  freezer: "requirement.freezer",
  wine: "requirement.wine",
  wineColumn: "requirement.wineColumn",
  dishwasher: "requirement.dishwasher",
  cooktop: "requirement.cooktop",
  range: "requirement.range",
  rangetop: "requirement.rangetop",
  microwaveDrawer: "requirement.microwave",
  comboOven: "requirement.comboOven",
  steamOven: "requirement.oven",
  doubleOven: "requirement.doubleOven",
  singleOven: "requirement.singleOven",
};

/**
 * The bill's word for one thing on a wall, with these machines in the room.
 *
 * What the template names itself — a landing, a filler, a panel, the coffee
 * cabinet by what is under the machine — it names; a machine on the wall is
 * named by the machine chosen, the package's own where none is.
 */
export function billLabelKey(item: RequirementItem, selection: Partial<Record<SlotId, Appliance>>): string | null {
  if (item.labelKey) return item.labelKey;
  // No position to be named by (Leo, round 99c: 甲): the bill shows its width
  // and code alone.
  if (!item.slot) {
    fellBack(`a bill item with neither a word nor a slot (${item.code ?? item.rule ?? item.widthIn})`);
    return null;
  }
  const appliance = selection[item.slot] ?? APPLIANCE_BY_ID[PACKAGE.defaultSelection[item.slot] ?? ""];
  const kind = appliance ? kindOf(appliance) : null;
  const word = kind ? BILL[kind] : undefined;
  if (!word) {
    fellBack(`no bill word for ${item.slot} with ${appliance?.model ?? "nothing"} in it`);
    // From the records, not the room: a position this room does not have is
    // still named (A has no oven; D's bill named under A asked for one).
    return SLOT_RECORDS.find((record) => record.id === item.slot)!.labelKey;
  }
  return word;
}
