import { useMemo } from "react";
import { SLOT_ORDER } from "./catalogue";
import { SLOT_BY_ID } from "./slots";
import { evaluateSlot, packageContext, type Finding } from "./rules";
import { resolveRoughIn, roughInFor, roughInWords } from "./roughIn";
import { useSelection, useSelectedBlower } from "../store/useSelection";
import { useAppStore, type CounterFinish } from "../store/useAppStore";
import { applianceBox } from "./applianceBox";
import {
  COLUMN_DOOR_PANELS,
  COMBO_OVEN,
  STEAM_OVEN,
  comboHandleAt,
  comboSillFor,
  isColumn,
  isCombo,
  isDouble,
} from "./columnModel";
import { CHIMNEY, chimneyParts, isChimney } from "./hood";
import { ISLAND, LAYOUT_LIMITS, LAYOUT_PARAMS, OMITTED_SLOTS, ROOM, RUNS } from "./room";
import { COFFEE_HEIGHT } from "./layoutTemplate";
import { formatDimension } from "./dimensions";
import { OVEN_GRILLE, towerVents, ventsAtRear, type TowerVent } from "./towerVent";
import { overhangSupportZone } from "./overhang";
import type { Appliance, SlotId } from "../types";

export interface Checklist {
  findings: Finding[];
  blockers: number;
  warnings: number;
}

/**
 * Every rule that fires against the package as currently specified.
 *
 * This is also the shape the quote sheet serialises: each finding carries the
 * rule that produced it and the slot it is about, so a line on the quote can be
 * traced back to why it is there.
 */
export function useChecklist(): Checklist {
  const selection = useSelection();
  const blower = useSelectedBlower();
  // What the top is made of changes what the overhang line may say. Round 69.
  const counter = useAppStore((s) => s.finishes.counter);
  return useMemo(() => checklistFor(selection, blower, counter), [selection, blower, counter]);
}

/**
 * The checklist for a selection, with no React in it.
 *
 * Pulled out in round 55 so the rule that every finding names a slot **this
 * package actually has** can be held to by a test rather than by a crash: the
 * panel groups its lines by slot and looks each one up, so a line filed under a
 * machine the room does not contain took the whole right-hand column down.
 */
export function checklistFor(
  selection: Record<SlotId, Appliance>,
  blower: Appliance | null,
  counter: CounterFinish = "quartz-white",
): Checklist {
  {
    const context = packageContext(selection["slot-hood"], blower, selection["slot-range"]);
    const findings = [
      ...SLOT_ORDER.flatMap((slotId) =>
        evaluateSlot(SLOT_BY_ID[slotId], selection[slotId], context),
      ),
      // One line per connection the model's own drawing calls for. These are
      // not rules — nothing decides whether they fire — they are the numbers
      // an installer repeats back.
      ...SLOT_ORDER.flatMap((slotId) =>
        resolveRoughIn(slotId, selection[slotId]).flatMap((resolved, i) => [
          {
            ruleId: `rough-in:${slotId}:${resolved.point.type}:${i}`,
            severity: "info" as const,
            messageKey: "rule.roughIn",
            slot: slotId,
            // Keys and figures; each page says them in its own language.
            params: roughInWords(resolved),
          },
          // Where no side of the machine had a cabinet, the list says so, and
          // says what has to hold for the way out to be allowed (round 71).
          ...resolved.noCabinetNotes.map((key, note) => ({
            ruleId: `rough-in:${slotId}:${resolved.point.type}:${i}:no-cabinet:${note}`,
            severity: "warning" as const,
            messageKey: key,
            slot: slotId,
            params: roughInWords(resolved),
          })),
        ]),
      ),
      // Package-wide findings are attributed to the hood, which is what they
      // are actually about.
      ...evaluateSlot(SLOT_BY_ID["slot-hood"], selection["slot-hood"], context, "package"),
      // Parts the room needs that no rule decides: a chimney that will not
      // reach this ceiling on its own takes an extension, and the number is
      // the room's rather than the model's.
      ...installParts(selection, counter),
    ];
    return {
      findings,
      blockers: findings.filter((f) => f.severity === "blocker").length,
      warnings: findings.filter((f) => f.severity === "warning").length,
    };
  }
}

/**
 * Accessories this room needs, as against this package.
 *
 * A chimney hood's duct cover covers a range of ceiling heights and no more.
 * A taller room needs the manufacturer's extension, and the install list is
 * where that belongs: it is not a rule anybody can fail, it is a part somebody
 * has to order.
 */
function installParts(selection: Record<SlotId, Appliance>, counter: CounterFinish): Finding[] {
  return [
    ...noIslandFallback(),
    ...fridgeDoorClearance(),
    ...chimneyExtension(selection),
    ...columnKit(),
    ...columnDoorPanel(selection),
    ...ovenDoorSwing(selection),
    ...microwaveReach(selection),
    ...towerLanding(),
    ...steamOven(selection),
    ...towerVent(selection),
    ...coffeeCabinet(selection),
    ...overhangSupport(counter),
    ...islandHoodCoverKit(selection),
  ];
}

/**
 * A seating overhang the stone will not carry on its own. D20, round 68.
 *
 * In the finished room it looks like any breakfast bar, which is the problem:
 * the support is concealed steel plate under the top, so the picture says
 * nothing, and this line is what stops the quote saying nothing too.
 *
 * Filed under a machine that stands in the island — the cooktop, in package
 * E — because a line has to name a slot the room has (round 55). Not the hood:
 * it hangs over the island, it is not in it. An island with no machine in it
 * files it under the cooking surface, which every package has.
 *
 * Round 69, Leo: the words follow the top. Quartz and marble are stone, and
 * the line quotes stone's 10"-12" and the concealed plate. An oak top gets the
 * judgement and nothing more — 15" wants carrying — because nothing here says
 * what wood carries, and a customer who picked oak should not read "stone".
 */
/**
 * CHXTHMIB, the telescopic duct cover for HMIB42WS, as a line to confirm. D20.
 *
 * Decided in round 37 and not built until round 69. The drawing puts a 72"
 * underside under this ceiling inside the standard covers' 30"-45-1/16"; the
 * guide's text says the standard covers fill an 8' ceiling and CHXTHMIB
 * reaches 9'-12', and the ceiling here is half an inch over 9'. The two do not
 * agree, so the kit goes on the quote marked to confirm with Thermador. The
 * importer skips anything named a kit (D4), so this line is a rule's.
 */
function islandHoodCoverKit(selection: Record<SlotId, Appliance>): Finding[] {
  const hood = selection["slot-hood"];
  if (SLOT_BY_ID["slot-hood"]?.mount !== "island" || hood?.model !== "HMIB42WS") return [];
  // The guide's own figures, pages 12 and 18: the supplied covers for an 8'
  // ceiling, CHXTHMIB for 9'-12'. Only past 8' is there anything to ask.
  if (ROOM.wallHeight <= 8 + 1e-9) return [];
  return [
    {
      ruleId: "island-hood-cover-kit",
      severity: "warning",
      messageKey: "rule.islandHoodCoverKit",
      slot: "slot-hood",
      params: { ceiling: formatDimension(ROOM.wallHeight * 12) },
    },
  ];
}

function overhangSupport(counter: CounterFinish): Finding[] {
  const zone = overhangSupportZone(ISLAND);
  if (!zone) return [];
  const inIsland = SLOT_ORDER.find(
    (slot) => slot !== "slot-hood" && SLOT_BY_ID[slot].mount === "island" && !OMITTED_SLOTS.includes(slot),
  );
  const slot = inIsland ?? SLOT_ORDER.find((s) => s === "slot-cooktop" || s === "slot-range")!;
  return [
    {
      ruleId: "overhang-support",
      severity: "warning",
      messageKey: counter === "wood-oak" ? "rule.overhangSupportWood" : "rule.overhangSupport",
      slot,
      params: { overhang: formatDimension(zone.overhangIn) },
    },
  ];
}

/**
 * The vent in the top of each hung oven's opening, at the back. It is a hole
 * the cabinetmaker cuts, so its size goes on the list; see `towerVent.ts`.
 */
function towerVent(selection: Record<SlotId, Appliance>): Finding[] {
  return towerVents(selection).flatMap((vent): Finding[] => {
    const machine = selection[vent.slot];
    return machine?.category === "coffee" ? coffeeVent(vent, machine) : ovenVent(vent, machine);
  });
}

/**
 * The same three lines for the coffee machine, in its own words: its manual
 * asks for the air at its back (TCM24PS p. 11), and a line that talked about
 * "the oven" and "the steam oven" over a coffee machine would be read as a
 * mistake by the one person who needs to believe it. Round 73.
 */
function coffeeVent(vent: TowerVent, machine: Appliance): Finding[] {
  const breathes = ventsAtRear(machine);
  return [
    {
      ruleId: `tower-vent:${vent.slot}`,
      severity: "info" as const,
      messageKey: "rule.coffeeTopVent",
      slot: vent.slot,
      params: { size: `${formatDimension(vent.widthIn)} × ${formatDimension(vent.depthIn)}` },
    },
    ...(breathes
      ? [
          {
            ruleId: `tower-bridge:${vent.slot}`,
            severity: "info" as const,
            messageKey: "rule.coffeeRearVent",
            slot: vent.slot,
            params: { gap: formatDimension(vent.bridgeStandOffIn) },
          },
          {
            ruleId: `oven-grille:${vent.slot}`,
            severity: "info" as const,
            messageKey: "rule.coffeeGrille",
            slot: vent.slot,
            params: {
              size: `${formatDimension(OVEN_GRILLE.heightIn)} × ${formatDimension(OVEN_GRILLE.widthIn)}`,
            },
          },
        ]
      : []),
  ];
}

function ovenVent(vent: TowerVent, machine: Appliance | undefined): Finding[] {
  return [
    // Where that air leaves, for a machine that breathes at its back — D's
    // steam oven, on Leo's site practice. Round 38; data since round 73.
    ...(ventsAtRear(machine)
      ? [
          {
            ruleId: `oven-grille:${vent.slot}`,
            severity: "info" as const,
            messageKey: "rule.ovenGrille",
            slot: vent.slot,
            params: {
              size: `${formatDimension(OVEN_GRILLE.heightIn)} × ${formatDimension(OVEN_GRILLE.widthIn)}`,
            },
          },
        ]
      : []),
    {
      ruleId: `tower-vent:${vent.slot}`,
      severity: "info" as const,
      messageKey: "rule.towerVent",
      slot: vent.slot,
      params: { size: `${formatDimension(vent.widthIn)} × ${formatDimension(vent.depthIn)}` },
    },
    // And the way to it: the boxes over such a machine have no backs and stand
    // off the wall. Anything else keeps a solid back against it. Round 39.
    ...(ventsAtRear(machine)
      ? [
          {
            ruleId: `tower-bridge:${vent.slot}`,
            severity: "info" as const,
            messageKey: "rule.towerBridge",
            slot: vent.slot,
            params: { gap: formatDimension(vent.bridgeStandOffIn) },
          },
        ]
      : []),
  ];
}

/**
 * Where the steam oven hangs, and what that puts the handle at.
 *
 * It has no microwave to reach for, so what is worth saying is where the
 * opening starts — on the toe kick and one drawer — where that puts the lower
 * door's handle, and the circuit it needs, which is the one thing about it an
 * electrician has to be told.
 */
function steamOven(selection: Record<SlotId, Appliance>): Finding[] {
  const oven = selection["slot-oven"];
  const slot = SLOT_BY_ID["slot-oven"];
  if (!oven || !slot || !isDouble(oven)) return [];
  const sillIn = round8(slot.position[1] * 12);
  return [
    {
      ruleId: "steam-oven",
      severity: "info",
      messageKey: "rule.steamOven",
      slot: "slot-oven",
      params: {
        sillIn,
        handleIn: round8(sillIn + STEAM_OVEN.lowerHandleIn),
        amps: slot.utilities.power?.amps ?? oven.requires.amps ?? 40,
      },
    },
  ];
}

/**
 * The coffee cabinet, and the dishwasher standing in the bottom of it.
 *
 * Two lines. The machine's height and services. And D11 rule 14, said out
 * loud: the dishwasher under it is not beside the sink, so it cannot take its
 * water and drain from the sink base the way the other one does — its own
 * circuit, hot water and drain go to this cabinet, and somebody pricing the
 * plumbing has to know that before they see it.
 */
function coffeeCabinet(selection: Record<SlotId, Appliance>): Finding[] {
  const coffee = selection["slot-coffee"];
  const slot = SLOT_BY_ID["slot-coffee"];
  if (!coffee || !slot) return [];
  const sillIn = slot.position[1] * 12;
  // As fractions, the way a tape reads: the manual's 37-7/16" is not 37-1/2"
  // (round8) and not 37.4375 (round 75). The message supplies the inch mark.
  const inches = (value: number) => formatDimension(value).replace(/"$/, "");
  const lines: Finding[] = [
    {
      ruleId: "coffee-machine",
      severity: "info",
      messageKey: "rule.coffeeMachine",
      slot: "slot-coffee",
      params: {
        sillIn: inches(sillIn),
        headIn: inches(sillIn + slot.cutout.h),
        amps: slot.utilities.power?.amps ?? coffee.requires.amps ?? 15,
      },
    },
  ];
  // Higher than the manual advises: a reminder, not a refusal (round 75,
  // Leo). TCM24PS p. 11 says "approx." and "should", and gives its reason.
  if (sillIn > COFFEE_HEIGHT.manualIn + COFFEE_HEIGHT.adviseMarginIn + 1e-6) {
    lines.push({
      ruleId: "coffee-high",
      severity: "warning",
      messageKey: "rule.coffeeHigh",
      slot: "slot-coffee",
      params: {},
    });
  }
  if (selection["slot-dishwasher-2"]) {
    lines.push({
      ruleId: "d11-14",
      severity: "info",
      messageKey: "rule.coffeeDishwasher",
      slot: "slot-dishwasher-2",
      params: {},
    });
  }
  if (selection["slot-wine-2"]) {
    lines.push({
      ruleId: "coffee-wine",
      severity: "info",
      messageKey: "rule.coffeeWine",
      slot: "slot-wine-2",
      params: {},
    });
  }
  // Whatever stands under the coffee machine, the gap up to it is a fixed
  // panel, never a drawer: TCM24PS p. 9 (D11 rule 14, round 73).
  const lower = RUNS.flatMap((run) => run.segments)
    .flatMap((segment) => segment.modules)
    .find((module) => module.slot === "slot-coffee")?.lowerSlot;
  if (lower) {
    lines.push({
      ruleId: "coffee-gap-panel",
      severity: "info",
      messageKey: "rule.coffeeGapPanel",
      slot: "slot-coffee",
      params: {},
    });
  }
  // A drain the machine works without is said to be optional, in so many
  // words, rather than priced as needed or left out (Leo, round 73).
  if (roughInFor(coffee)?.points.some((point) => point.type === "drain" && point.optional)) {
    lines.push({
      ruleId: "coffee-drain-optional",
      severity: "info",
      messageKey: "rule.coffeeDrainOptional",
      slot: "slot-coffee",
      params: {},
    });
  }
  return lines;
}

/**
 * How much counter there is between the cooking surface and the oven tower.
 *
 * Eighteen inches is what that stretch is built at: a landing wide enough to
 * put a pan down on, and what the wall's spare inches go into before they go
 * anywhere else. A wall that cannot pay for it builds narrower, down to six —
 * still over the five the machine's sheet asks for, and still counter rather
 * than a cabinet — and that is worth a line, because standing in front of it
 * is the only other way to find out.
 */
function towerLanding(): Finding[] {
  const { counterIn, wantIn } = LAYOUT_LIMITS.towerSpacer;
  const segment = RUNS.flatMap((run) => run.segments).find((item) =>
    item.id.includes("tower-clearance"),
  );
  if (!segment) return [];

  const builtIn = round8((segment.to - segment.from) * 12);
  if (builtIn >= wantIn - 1e-6) return [];

  return [
    {
      ruleId: "tower-landing",
      severity: "info",
      messageKey: "rule.towerLanding",
      slot: "slot-range",
      params: { builtIn, wantIn, specIn: counterIn },
    },
  ];
}

/**
 * Where the island's two machines went, when there is no island.
 *
 * A room without one still has to put the microwave drawer and the wine cabinet
 * somewhere, and where they end up is not obvious from looking: both are base
 * cabinets on the refrigerator's leg, the last two before its landing. Somebody
 * pricing the run needs to know that before they read the drawing, so it is a
 * line rather than a discovery.
 *
 * And when the leg would not take them even with everything on it at its
 * minimum, the room is built without them. That is the louder line of the two:
 * it is the one thing on this screen the customer did not ask for and cannot
 * see, and it comes with the two ways of getting them back.
 */
function noIslandFallback(): Finding[] {
  if (ISLAND.present) return [];

  if (OMITTED_SLOTS.length > 0) {
    return [
      {
        ruleId: "no-island-omitted",
        severity: "warning",
        messageKey: "rule.noIslandOmitted",
        slot: "slot-microwave",
        params: {},
      },
    ];
  }

  const runOf = (slot: SlotId) =>
    RUNS.find((run) => run.segments.some((segment) => segment.slot === slot))?.id;
  const wineRun = runOf("slot-wine");
  const microwaveRun = runOf("slot-microwave");
  if (!wineRun || !microwaveRun) return [];

  return [
    {
      ruleId: "no-island-fallback",
      severity: "info",
      messageKey: "rule.noIslandFallback",
      slot: "slot-microwave",
      params: { wineLegKey: `leg.${wineRun}`, microwaveLegKey: `leg.${microwaveRun}` },
    },
  ];
}

/**
 * Where the microwave's handle actually landed.
 *
 * The tower is cut to put it at the height asked for, and when that height is
 * outside what the machine's drawing allows the hole is clamped and the handle
 * lands somewhere else. That is a real answer rather than an error — but it is
 * the kind of thing nobody notices until they are standing in front of it, so
 * it says where the handle is, what was asked for, and the figure the sill was
 * chosen from.
 */
function microwaveReach(selection: Record<SlotId, Appliance>): Finding[] {
  const oven = selection["slot-microwave"];
  if (!oven || !isCombo(oven)) return [];

  const asked = LAYOUT_PARAMS.microwaveHandleIn;
  const { sillIn, clamped } = comboSillFor(asked);
  if (!clamped) return [];

  return [
    {
      ruleId: "microwave-reach",
      severity: "warning",
      messageKey: "rule.microwaveReach",
      slot: "slot-microwave",
      params: {
        atIn: round8(comboHandleAt(sillIn)),
        askedIn: round8(asked),
        sillIn: round8(sillIn),
        lowIn: round8(COMBO_OVEN.sillIn.min + COMBO_OVEN.microwaveHandleIn),
        highIn: round8(COMBO_OVEN.sillIn.max + COMBO_OVEN.microwaveHandleIn),
      },
    },
  ];
}

/** Eighths of an inch, which is how a figure like this is written down. */
const round8 = (value: number) => Math.round(value * 8) / 8;

/**
 * How far an oven door reaches into the room when it is open.
 *
 * D11 rule 7's 42" aisle already covers it — 26-5/8" of door in a 42" walkway
 * leaves room to stand — but nobody reading a plan can see a door that is
 * shut, and a tower beside the cooking surface puts that door where the cook
 * is standing. So the figure is on the list rather than implied by another
 * one. From docs/reference/mem301ws-manual.png.
 */
function ovenDoorSwing(selection: Record<SlotId, Appliance>): Finding[] {
  const oven = selection["slot-microwave"];
  if (!oven || !isCombo(oven)) return [];

  return [
    {
      ruleId: "oven-door-swing",
      severity: "info",
      messageKey: "rule.ovenDoorSwing",
      slot: "slot-microwave",
      params: { reachIn: COMBO_OVEN.doorReachIn },
    },
  ];
}

/**
 * The door a column wears, when it is not the cabinetmaker's.
 *
 * A column is sold panel-ready and the front is a decision: the joiner's door,
 * or one of the manufacturer's two stainless panels. Which one this kitchen
 * has is the row's own finish, so this line follows the catalogue rather than
 * deciding anything — a panel-ready row says nothing here and wears the
 * kitchen's door instead.
 */
function columnDoorPanel(selection: Record<SlotId, Appliance>): Finding[] {
  const wine = selection["slot-wine"];
  // The two part numbers are the 18" column's panels, and nothing else's.
  if (!wine || !isColumn(wine) || wine.finish.includes("panel-ready") || wine.widthIn !== 18) {
    return [];
  }

  return [
    {
      ruleId: "column-door-panel",
      severity: "info",
      messageKey: "rule.columnDoorPanel",
      slot: "slot-wine",
      params: {
        handleless: COLUMN_DOOR_PANELS.handleless,
        handleReady: COLUMN_DOOR_PANELS.handleReady,
      },
    },
  ];
}

/**
 * The kit that joins two refrigeration columns standing side by side.
 *
 * Not a rule anybody can fail — the generator already left the 5/8" for it —
 * but a part somebody has to order, and one that is easy to miss because it is
 * five eighths of an inch wide and holds up two machines. The line names it
 * and says which two it is between.
 */
function columnKit(): Finding[] {
  const segments = RUNS.flatMap((run) => run.segments);
  const spacers = segments
    .flatMap((segment) => segment.modules)
    .filter((module) => module.kind === "spacer");
  const spacer = spacers[0];
  if (!spacer) return [];

  // Filed under a column the kit is actually between, which is not always the
  // wine column: package D's bank happens to end with one and this line named
  // it outright, so package E — a freezer and a refrigerator, no wine — filed
  // the line under a machine that was not in the room. Round 55.
  const at = segments.findIndex((segment) => segment.modules.includes(spacer));
  const joined =
    [segments[at - 1], segments[at + 1], segments[at]].find(
      (segment) => segment?.slot && SLOT_BY_ID[segment.slot],
    ) ?? null;
  if (!joined?.slot) return [];

  return [
    {
      ruleId: "column-kit",
      severity: "info",
      messageKey: "rule.columnKit",
      slot: joined.slot,
      params: { model: spacer.code, gapIn: spacer.widthIn, count: spacers.length },
    },
  ];
}

/** The extension a room taller than the chimney's own travel needs. */
function chimneyExtension(selection: Record<SlotId, Appliance>): Finding[] {
  const hood = selection["slot-hood"];
  if (!hood || !isChimney(hood)) return [];

  const slot = SLOT_BY_ID["slot-hood"];
  const canopyTop = slot.position[1] + applianceBox(slot, hood).h;
  const chimney = chimneyParts(canopyTop);
  const riseIn = Math.round(chimney.rise * 120) / 10;

  // Below one section the chimney will not shorten: it is not a cut-to-fit
  // part, and the canopy or the ceiling has to move instead.
  if (chimney.tooLow) {
    return [
      {
        ruleId: "chimney-too-low",
        severity: "warning",
        messageKey: "rule.chimneyTooLow",
        slot: "slot-hood",
        params: { riseIn, sectionIn: CHIMNEY.sectionIn },
      },
    ];
  }
  if (!chimney.needsExtension) return [];

  return [
    {
      ruleId: "chimney-extension",
      severity: "info",
      messageKey: "rule.chimneyExtension",
      slot: "slot-hood",
      params: {
        model: CHIMNEY.extension,
        overIn: Math.round(chimney.shortIn * 10) / 10,
        riseIn,
      },
    },
  ];
}

/**
 * The gap a freestanding refrigerator's door needs against a return wall.
 *
 * Not a rule anybody can fail — the generator already left the space — but a
 * line the installer has to read, because three and a half inches of empty
 * wall looks like a mistake until somebody says what it is for. The 90-degree
 * stop is the manufacturer's answer to the same problem, and is offered rather
 * than specified. See docs/decisions.md D11 rule 11.
 */
function fridgeDoorClearance(): Finding[] {
  const segment = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-fridge");
  const filler = segment?.modules.find((module) => module.kind === "filler");
  if (!filler) return [];

  return [
    {
      ruleId: "fridge-door-clearance",
      severity: "info",
      messageKey: "rule.fridgeDoorClearance",
      slot: "slot-fridge",
      params: {
        gapIn: filler.widthIn,
        doorStop: LAYOUT_LIMITS.fridge.doorStop,
      },
    },
  ];
}
