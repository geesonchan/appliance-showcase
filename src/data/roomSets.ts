/**
 * The rooms every proof builds, listed once (round 99a, D17: one rule written
 * once): round 98a's 1,045 L rooms — each package as it opens and in every
 * arrangement its switches make, and every model each slot can hold in its
 * own room — and round 99a's 91 one-wall rooms, built the same way. The two
 * dumps (`scripts/lDump.ts`, `scripts/oneWallDump.ts`) write them out, and
 * `machineLabel.test.ts` reads every word on their walls' bills.
 *
 * The modules are passed in rather than imported, so a dump can build these
 * rooms from another commit's tree (`ROOT`) and compare them with this one's.
 */

// The modules a room is built with, as a dump or a test loads them.
export interface RoomModules {
  packages: any;
  layoutState: any;
  room: any;
  candidates: any;
  catalogue: any;
  testRoom: any;
  layoutTemplate: any;
}

/** One room: its label, how to stand it up, and the models standing in it. */
export interface RoomCase {
  label: string;
  /** The package object the room is built from. */
  pkg: any;
  build(): { ok: boolean; reasons?: unknown; grown?: unknown };
  selection(): Record<string, any>;
}

/** The models a package specifies, with one slot swapped where asked. */
function selectionOf(m: RoomModules, pkg: any, swap?: [string, string]): Record<string, any> {
  const sel: Record<string, any> = {};
  for (const [slot, model] of Object.entries(pkg.defaultSelection)) sel[slot] = m.catalogue.APPLIANCE_BY_ID[model as string];
  if (swap) sel[swap[0]] = m.catalogue.APPLIANCE_BY_ID[swap[1]];
  return sel;
}

/** Each slot whose model the room is built round, and how to say so (rounds 83, 87, 89). */
const SETTERS: Record<string, string> = { "slot-range": "setRangeModel", "slot-hood": "setHoodModel", "slot-fridge": "setFridgeModel" };

/** Every arrangement the L's switches make, as round 98a's dump built them. */
function lArrangements(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [{}];
  for (const sinkLeg of ["back", "left"])
    for (const fridgeEnd of ["left", "back"])
      for (const coffeeLeg of ["left", "back"])
        for (const towerSide of ["left", "right"])
          for (const cornerType of ["blind", "lazy-susan"])
            for (const fridgeEndAbuts of ["cabinet", "wall"])
              for (const island of ["parallel", "perpendicular", "none"])
                out.push({
                  sinkLeg,
                  fridgeEnd,
                  coffeeLeg,
                  towerSide,
                  cornerType,
                  fridgeEndAbuts,
                  ...(island === "none" ? { hasIsland: false } : { hasIsland: true, islandOrientation: island }),
                });
  // The housing shape and two odd wall lengths, on the package's own arrangement.
  out.push({ housingStyle: "sweep" }, { backWallIn: 214.375, leftWallIn: 171.125 });
  return out;
}

/** The L's rooms: 1,045 as round 99a builds them (515 built, 530 refused). */
export function lRooms(m: RoomModules): RoomCase[] {
  const cases: RoomCase[] = [];
  for (const pkg of m.packages.PACKAGES.filter((p: any) => p.available)) {
    for (const arrangement of lArrangements()) {
      cases.push({
        label: `${pkg.code} ${JSON.stringify(arrangement)}`,
        pkg,
        // A refusal's reasons as round 98a's dump wrote them: the growing's
        // own, or the package switch's whole answer where that refused.
        build: () => {
          m.testRoom.resetRoom();
          const switched = m.layoutState.setActivePackage(pkg.id);
          if (switched.ok && Object.keys(arrangement).length > 0) {
            const grown = m.layoutState.setLayoutParamsGrowing({ ...m.room.REQUESTED_PARAMS, ...arrangement });
            return { ...grown, reasons: grown.reasons ?? switched };
          }
          return { ok: switched.ok, reasons: switched };
        },
        selection: () => selectionOf(m, pkg),
      });
    }
    // Every model each opening offers that fits, one at a time, in the package's own room.
    m.testRoom.resetRoom();
    m.layoutState.setActivePackage(pkg.id);
    for (const spec of pkg.slots) {
      for (const candidate of m.candidates.candidatesFor(spec.slotId, pkg)) {
        if (!candidate.fit.fits) continue;
        const id = candidate.appliance.id;
        if (id === pkg.defaultSelection[spec.slotId]) continue;
        cases.push({
          label: `${pkg.code} swap ${spec.slotId}=${candidate.appliance.model}`,
          pkg,
          build: () => {
            m.testRoom.resetRoom();
            m.layoutState.setActivePackage(pkg.id);
            const setter = SETTERS[spec.slotId];
            if (setter) m.layoutState[setter](m.catalogue.APPLIANCE_BY_ID[id]);
            return { ok: true };
          },
          selection: () => selectionOf(m, pkg, [spec.slotId, id]),
        });
      }
    }
  }
  m.testRoom.resetRoom();
  return cases;
}

/** A package's room on one wall, at the wall asked for or the one it needs. */
function standOneWall(m: RoomModules, pkg: any, patch: Record<string, unknown> = {}) {
  m.testRoom.resetRoom();
  m.layoutState.setActivePackage(pkg.id);
  const asked: any = { ...m.room.REQUESTED_PARAMS, ...patch, shape: "one-wall" };
  if (patch.backWallIn === undefined) asked.backWallIn = Math.max(asked.backWallIn, m.layoutTemplate.oneWallWantedIn(asked, pkg));
  return m.layoutState.setLayoutParamsGrowing(asked);
}

/**
 * One wall's rooms, 91: each package as it opens there, with the housing's
 * other shape, a wall a step or so longer than it needs where the slider
 * reaches that far, and the slider's top; and every model each slot can hold,
 * one at a time.
 */
export function oneWallRooms(m: RoomModules): RoomCase[] {
  const cases: RoomCase[] = [];
  for (const written of m.packages.PACKAGES.filter((p: any) => p.available)) {
    const shaped = m.packages.packageInShape(written, "one-wall");
    const wanted = m.layoutTemplate.oneWallWantedIn({ ...m.room.REQUESTED_PARAMS, shape: "one-wall" }, written);
    const longer = Math.ceil(wanted / 6) * 6 + 6;
    const patches = [
      {},
      { housingStyle: "sweep" },
      ...(longer < m.layoutTemplate.ONE_WALL_MAX_IN ? [{ backWallIn: longer }] : []),
      { backWallIn: m.layoutTemplate.ONE_WALL_MAX_IN },
    ];
    for (const patch of patches) {
      cases.push({
        label: `${written.code} one-wall ${JSON.stringify(patch)}`,
        pkg: shaped,
        build: () => standOneWall(m, written, patch),
        selection: () => selectionOf(m, shaped),
      });
    }
    standOneWall(m, written);
    for (const spec of shaped.slots) {
      for (const candidate of m.candidates.candidatesFor(spec.slotId, shaped)) {
        if (!candidate.fit.fits) continue;
        const id = candidate.appliance.id;
        if (id === shaped.defaultSelection[spec.slotId]) continue;
        cases.push({
          label: `${written.code} one-wall swap ${spec.slotId}=${candidate.appliance.model}`,
          pkg: shaped,
          build: () => {
            standOneWall(m, written);
            const setter = SETTERS[spec.slotId];
            if (setter) m.layoutState[setter](m.catalogue.APPLIANCE_BY_ID[id]);
            return { ok: true };
          },
          selection: () => selectionOf(m, shaped, [spec.slotId, id]),
        });
      }
    }
  }
  m.testRoom.resetRoom();
  return cases;
}
