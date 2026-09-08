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
| `t36ft820ns-spec.png` | Freestanding counter-depth refrigerator: 35-5/8" x 72" x 24" body, 1" fixed spacers on the back, 28-3/4" with the doors and 31-7/16" with the handles, 1/8" clearance each side, 44-9/16" with a door open. The two depths are what separate it from a built-in by eye. |
| `hmcb30ws-spec.png` | Chimney wall hood: 29-15/16" x 23-3/16" canopy, 8-9/16" tall with a 5" front face; chimney 13-3/16" x 10-3/4" with a 5-1/2" grille at the top of each side; 30-42" from the canopy's **underside** to the top of the chimney. |
| `mfgs4030rs-front.png` | Freestanding gas range: 29-7/8" x 47-7/8" x 28", five burners, backguard with a digital display, five knobs and a vent strip on the front, storage drawer at the bottom. |
| `lazy-susan-corner.svg` | Corner lazy susan: 36" along each wall, 24" deep, 34-1/2" high, and one 24" door set at 45 degrees across the corner. **Drawn here from published dimensions rather than traced from a photograph** — see below for where the figures come from. |

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

## What a corner lazy susan looks like from the room

One door set diagonally across the corner, with the square carcass behind it.
Not two flat fronts meeting at a right angle, which is what this app drew until
round 18 and is a box nobody sells. The trade calls the diagonal one a *diagonal
corner* susan; the other common answer is a bi-fold pair of doors on one leg,
which is a different cabinet and not what is drawn here.

The figures, and where each comes from:

- **36" along each wall, 24" deep, 34-1/2" high.** cabinets.com's DCLS36-L gives
  "36 3/16" wide, 34.5" high, 24" deep"; Lanae and Nelson list the same class at
  33-36" wide, 24" deep, 34.5" high.
- **A 24" door face at 45 degrees.** Leo's round-18 figure. None of the vendor
  pages publishes the door width, so it is his rather than theirs — and it is
  consistent with the box: a 24" chord cuts 16-15/16" off each 18" half-edge,
  which leaves the returns a susan needs to hinge against.
- **Two revolving shelves.** What makes it a susan rather than a diagonal corner
  sink base, which is the same shape with a different inside.

The drawing is `lazy-susan-corner.svg`, made here from those numbers. No product
photograph is in this repository: the vendor pages below are where to look at a
real one.

Sources:

- [cabinets.com DCLS36-L, diagonal corner lazy susan base](https://www.cabinets.com/dcls36-l-shaker-maple-painted-bright-white-diagonal-corner-lazy-susan-base-cabinet-1-door-assembled-kitchen-cabinet.html)
- [Highlands Designs BSS36, the bi-fold alternative](https://www.highlandsdesigns.com/item.php?item_id=5449&category_id=148)
- [Lanae, corner cabinet dimensions](https://lanaehome.com/blogs/news/corner-cabinet-dimensions-lazy-susan-and-alternatives)

`CABINET_STANDARDS.corner.diagonalFraction` is 2/3, which is the 24" on a 36"
box, and gives the wall cabinet over it its own face to the same proportion.

## Reading the hood's 30-42"

It is measured from the canopy's underside to the top of the chimney, not from
the canopy's top. The canopy is 8-9/16" of it, so the chimney alone shows
21-7/16" collapsed — which is one section, with the other entirely inside it.
That is where `CHIMNEY.sectionIn` comes from, and it is why an 8' ceiling over a
36" cooking surface uses the assembly at exactly its shortest: 36 + 30 + 8-9/16
puts the canopy's top at 74-9/16", and 96 - 74-9/16 is 21-7/16".

What the part can cover is therefore one section at the bottom and two nearly
drawn apart at the top, rather than the sheet's 30-42, which is the rated
installation range for an 8' to 9' ceiling rather than the travel of the tube.
See docs/decisions.md D13.

## prg366wh-spec.pdf — not in the repository yet

Leo's round-11 note points at `docs/reference/prg366wh-spec.pdf` page 1 for the
Thermador Pro Harmony range. The file has not been added, so the figures used
are the ones written out in that note: 36" x 36-3/4" x 24-3/4", six burners in
three columns of two, a 3" island trim, eight knobs across the fascia, and a
door taking about 60% of the front. They are in `PUBLISHED_SPECS` in
`scripts/normalise.ts` and in `RANGE_PROPORTIONS` in `src/data/rangeModel.ts`.
Drop the PDF in and they can be checked against it.
