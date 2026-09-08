import { applianceBox } from "./applianceBox";
import { cooktopHeight } from "./rangeModel";
import { CABINET_STANDARDS, ISLAND, ROOM, RUNS, RUN_BY_ID, ft } from "./room";
import { SLOT_BY_ID } from "./slots";
import type { Appliance, SlotId } from "../types";

export interface Dimension {
  id: string;
  /** The two ends, in world feet. */
  from: [number, number, number];
  to: [number, number, number];
  /** What it measures, in inches. */
  valueIn: number;
  /**
   * Which slots this figure is about. Empty means it describes the room rather
   * than any one appliance, so it disappears while a slot is being looked at.
   */
  slots: SlotId[];
  /**
   * Where along the line the figure sits, 0 to 1. Staggered between
   * neighbouring dimensions so two adjacent chains do not print on top of each
   * other — the same reason a draughtsman staggers them.
   */
  labelAt: number;
  /**
   * Drawn whatever the render mode, and whether or not the dimension layer is
   * on.
   *
   * Almost nothing qualifies. A clearance that has to be left empty is not an
   * annotation about the room — it is the reason three and a half inches of the
   * wall have no cabinet on them, and a reader who cannot see it is looking at
   * a gap somebody forgot to fill. See docs/decisions.md D11 rule 11.
   */
  always?: boolean;
  /** A note printed under the figure, e.g. the range a clearance may fall in. */
  noteKey?: string;
  noteVars?: Record<string, string | number>;
}

/**
 * The dimensions a builder would put on the drawing.
 *
 * Every figure is read from the D13 standards or from the model that is
 * actually specified — nothing here is a literal. Swapping the range changes
 * the cooktop height, and the clearance above it moves with it, which is the
 * point: these are the numbers the room is built to, not captions describing a
 * picture of it.
 *
 * They are laid out as a chain in the plane of the back run, the way a section
 * drawing stacks them, each at its own offset so the extension lines do not
 * collide.
 */
export function dimensionsFor(
  selection: Partial<Record<SlotId, Appliance>>,
  /** When a slot is being looked at, only the figures about it are drawn. */
  selectedSlot: SlotId | null = null,
): Dimension[] {
  const backRun = RUN_BY_ID.back;
  const range = SLOT_BY_ID["slot-range"];
  const hood = SLOT_BY_ID["slot-hood"];
  const { hood: hoodStd, upper } = CABINET_STANDARDS;

  // In front of the run's face, so the lines are not buried in the cabinets.
  const plane = backRun.centre + ROOM.counterDepth / 2 + 0.35;
  // Left of the range opening, stepping outward so they read as a chain.
  const rangeSegment = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-range")!;
  const at = (step: number) => rangeSegment.from - 0.5 - step * 1.5;

  const rangeAppliance = selection["slot-range"];
  // The cooking surface, not the machine's top: a range with a backguard is
  // sold at 47-7/8" and cooks at 36", and this line is the counter height.
  const cooktop = rangeAppliance
    ? cooktopHeight(rangeAppliance, applianceBox(range, rangeAppliance))
    : ft(range.cutout.h);
  const hoodBottom = hood.position[1];
  const hoodAppliance = selection["slot-hood"];
  const canopy = hoodAppliance ? applianceBox(hood, hoodAppliance).h : ft(hood.cutout.h);

  const vertical = (
    id: string,
    step: number,
    y0: number,
    y1: number,
    extra: Partial<Dimension> = {},
  ): Dimension => ({
    id,
    from: [at(step), y0, plane],
    to: [at(step), y1, plane],
    valueIn: Number(((y1 - y0) * 12).toFixed(3)),
    labelAt: 0.5,
    slots: [],
    ...extra,
  });

  const all: Dimension[] = [
    vertical("floor-to-ceiling", 3, 0, ROOM.wallHeight, { labelAt: 0.72 }),
    vertical("floor-to-counter", 2, 0, ROOM.counterHeight, { labelAt: 0.3 }),
    vertical("floor-to-cooktop", 1, 0, cooktop, {
      labelAt: 0.62,
      slots: ["slot-range", "slot-hood"],
    }),
    vertical("cooktop-to-canopy", 0, cooktop, hoodBottom, {
      noteKey: "dimension.clearanceRange",
      noteVars: { min: hoodStd.aboveCooktopMinIn, max: hoodStd.aboveCooktopMaxIn },
      slots: ["slot-range", "slot-hood"],
    }),
    vertical("canopy-height", 0, hoodBottom, hoodBottom + canopy, {
      slots: ["slot-range", "slot-hood"],
    }),
    vertical("counter-to-uppers", 4, ROOM.counterHeight, ROOM.upperBottom, {
      noteKey: "dimension.standard",
      noteVars: { value: upper.bottomAboveCounterIn },
    }),
    // The gap a refrigerator door needs against a return wall. Drawn whatever
    // the mode: it is not an annotation about the room, it is the reason three
    // and a half inches of that wall have no cabinet on them. D11 rule 11.
    ...fridgeClearance(),
    // The aisle, measured on the floor between the run and the island. A room
    // with no island has no aisle to dimension, so the figure is absent rather
    // than zero.
    ...(ISLAND.present
      ? [
          {
            id: "island-aisle",
            labelAt: 0.5,
            slots: ["slot-microwave", "slot-wine"] as SlotId[],
            from: [ISLAND.x[0] + 1, 0.03, backRun.centre + ROOM.counterDepth / 2] as [
              number,
              number,
              number,
            ],
            to: [ISLAND.x[0] + 1, 0.03, ISLAND.z[0]] as [number, number, number],
            valueIn: Number(
              ((ISLAND.z[0] - backRun.centre - ROOM.counterDepth / 2) * 12).toFixed(3),
            ),
          },
        ]
      : []),
  ];

  // Nothing selected: the whole drawing. Looking at one appliance: only the
  // figures about it, because flying in to read one clearance and getting
  // seven numbers is worse than getting none.
  if (!selectedSlot) return all;
  return all.filter(
    (dimension) => dimension.always || dimension.slots.includes(selectedSlot),
  );
}

/** Inches as a builder writes them: 36¾ rather than 36.75. */
export function formatDimension(valueIn: number): string {
  const whole = Math.floor(valueIn + 1e-6);
  const fraction = valueIn - whole;
  const sixteenths = Math.round(fraction * 16);
  if (sixteenths === 0) return `${whole}"`;
  if (sixteenths === 16) return `${whole + 1}"`;
  let numerator = sixteenths;
  let denominator = 16;
  while (numerator % 2 === 0) {
    numerator /= 2;
    denominator /= 2;
  }
  return `${whole}-${numerator}/${denominator}"`;
}

/**
 * The clearance between a freestanding refrigerator and the wall beside it.
 *
 * Only when there is a wall there: against cabinetry the door sweeps past the
 * cabinet's front and there is nothing to dimension. Measured on the floor,
 * across the filler that holds the gap open.
 */
function fridgeClearance(): Dimension[] {
  const segment = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-fridge");
  const filler = segment?.modules.find((module) => module.kind === "filler");
  if (!segment || !filler) return [];

  const run = RUNS.find((r) => r.segments.includes(segment))!;
  // The filler is the last module on the segment, at its far end.
  const to = segment.to;
  const from = to - ft(filler.widthIn);
  const across = run.centre + ROOM.counterDepth / 2 + 0.2;
  const at = (along: number): [number, number, number] =>
    run.axis === "x" ? [along, 0.03, across] : [across, 0.03, along];

  return [
    {
      id: "fridge-door-clearance",
      from: at(from),
      to: at(to),
      valueIn: Number((filler.widthIn).toFixed(3)),
      slots: ["slot-fridge"],
      labelAt: 0.5,
      always: true,
      noteKey: "dimension.fridgeDoorClearance",
    },
  ];
}
