# Reference material

Manufacturer drawings the geometry is built from. Two are referred to by name in
`docs/decisions.md` D13 and in the code:

| File | What it settles |
|---|---|
| `thermador-hood-clearance.png` | Canopy height, clearance over the cooking surface, where the duct collar sits, the electrical zone at the back. |
| `thermador-ducting.png` | The five ways a hood is ducted: up through the roof or out through a wall, and integral / remote / inline blowers, with the back-draft damper at the transition. |

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
