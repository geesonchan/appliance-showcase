# Reference material

Manufacturer drawings the geometry is built from. Two are referred to by name in
`docs/decisions.md` D13 and in the code:

| File | What it settles |
|---|---|
| `thermador-hood-clearance.png` | Canopy height, clearance over the cooking surface, where the duct collar sits, the electrical zone at the back. |
| `thermador-ducting.png` | The five ways a hood is ducted: up through the roof or out through a wall, and integral / remote / inline blowers, with the back-draft damper at the transition. |
| `thermador-t36bt120ns.png` | Refrigerator: receptacle and water in the neighbouring cabinet, the 7-1/4" service channel across the back of the opening. **Not in the repository yet.** |
| `thermador-md24bs.png` | Microwave drawer: outlet on the rear wall of the opening 4" in and 14-5/8" up, anti-tip bracket top rear. **Not in the repository yet.** |
| `bosch-dishwasher-install.png` | Dishwasher: power, hot water and drain all in the sink base, drain run as a high loop peaking 33-43" off the floor. **Not in the repository yet.** |

Positions taken from these are in `data/rough-in.json`, keyed by model, with the
sheet each came from recorded against it. A model with no entry falls back to
the room's generic heights and is marked "generic rough-in" under `?debug=1`,
so a missing drawing shows as missing rather than as a guess.

**The image files are not in the repository yet.** The numbers taken from them
are, and every one of them is written down rather than left implicit:

- canopy body 18" high
- canopy underside 30" (gas minimum) to 40" above the cooking surface, default 30"
- 36" counter + 30" clearance + 18" canopy = wall cabinets resume at 84"
- duct collar 8-3/8" above the canopy top
- canopy at least as wide as the range: a 36" range takes a 36" or 42" canopy

They live in `CABINET_STANDARDS.hood` in `src/data/room.ts`, so the drawings
arriving later can be checked against the code rather than the other way round.
If a figure here turns out to disagree with the sheet, change the constant and
the room rebuilds around it.
