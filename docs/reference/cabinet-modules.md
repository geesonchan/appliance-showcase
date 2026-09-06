# North American cabinet modules

What you can actually order. Every kitchen in this app is built out of these and
nothing else: a run is a list of boxes whose widths add up exactly, with fillers
absorbing whatever is left over. If a run cannot be composed from this table,
`checkLayout` refuses it and says by how much — the same answer a cabinet
supplier gives you.

Sizes below are the framed-cabinet convention shared by KraftMaid, Wellborn,
Diamond and the RTA suppliers. IKEA's SEKTION line is dimensioned in metric and
does **not** match it; it is listed at the end as the exception, because mixing
the two is the mistake this table exists to prevent.

## Reading a code

Letters say what the box is, numbers say how big: width first, then height where
the height is not implied.
([Captivating Cabinets](https://www.captivatingcabinets.com/blog/how-to-read-cabinet-sku-codes))

| Code | Meaning |
|---|---|
| `B24` | Base, 24" wide. Height 34½" and depth 24" are implied. |
| `DB18` | Drawer base, 18" wide — all drawers, no door. |
| `SB33` | Sink base, 33" wide. |
| `W3042` | Wall, 30" wide × 42" tall. Depth 12" implied. |
| `T3696` | Tall / pantry, 36" wide × 96" tall. Depth 24" implied. |
| `LS36` | Lazy susan corner base, 36" along each wall. |
| `BBC36-42` | Blind base corner: a 36" cabinet that consumes 42" of wall. |
| `WER2442` | Wall easy-reach corner, 24" each wall × 42" tall. |
| `BF3` / `WF3` / `TF3` | Base / wall / tall filler, 3" or 6" wide. |
| `BEP` / `WEP` | Base / wall end panel, ¾" thick. |
| `RO36` | Not a cabinet — a 36" rough opening for an appliance, dimensioned on the plan. |

## Base cabinets

24" deep, 34½" tall; with a 1½" top that makes the 36" finished counter height
that is the industry standard.
([KraftMaid](https://www.kraftmaid.com/kraftmaid/kitchen-cabinet-sizes))

| | Widths (inches) |
|---|---|
| Standard run `B##` | 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48 |
| In practice | 12–36 in 3" steps covers nearly every run |
| Drawer base `DB##` | 12–36; two deep drawers only at 30, 33, 36 |
| Sink base `SB##` | 30, 33, 36, 42 — 30 and 33 are the common pair |

Sources:
[KraftMaid](https://www.kraftmaid.com/kraftmaid/kitchen-cabinet-sizes),
[flipkitchen size chart](https://www.flipkitchen.ca/learn/guide/sizes.html),
[CabinetSelect](https://cabinetselect.com/standard-kitchen-cabinet-sizes/).

**Either side of a range** you want a base cabinet, not a filler: 12" is the
minimum landing anyone will sign off, 15" and 18" are the comfortable ones. This
is the constraint D11 rule 4 encodes.

## Wall cabinets

12" deep. Widths 9–36" in 3" steps (KraftMaid goes to 48"). The height is part
of the code and decides where the run tops out, given the standard 54" underside
— 18" above a 36" counter.
([KraftMaid](https://www.kraftmaid.com/kraftmaid/kitchen-cabinet-sizes),
[flipkitchen](https://www.flipkitchen.ca/learn/guide/sizes.html))

| Height | Tops out at | Used for |
|---|---|---|
| 30" | 84" | The default upper. |
| 36" | 90" | More storage, soffit above. |
| 42" | 96" | To the ceiling in a 96" plan. |
| 12" / 15" / 18" | — | **Bridge cabinets**: over a fridge, a hood or a doorway. |

A bridge cabinet is the piece over a hood or a refrigerator. 12", 15" and 18"
are the stock heights, and 12" deep is normal over a hood while 24" is normal
over a fridge.
([Wholesale Cabinet Supply](https://www.thewcsupply.com/pages/bridge-wall-cabinet-cabinet-glossary),
[George Cabinetry](https://georgecabinetry.com/blog/adding-wall-bridge-cabinets-to-your-kitchen-design/))

## Tall cabinets

24" deep, widths 9–36", heights 84 / 87 / 90 / 93 / 96".
([KraftMaid](https://www.kraftmaid.com/kraftmaid/kitchen-cabinet-sizes))

- **Oven tower** `OC30##`: 30" and 33" are the two that matter; 33" takes about
  90% of the ovens on the market.
  ([CabinetSelect](https://cabinetselect.com/standard-kitchen-cabinet-sizes/))
- **Refrigerator enclosure**: 33" for a standard fridge, 36" for a counter-depth
  French door, 42" or 48" for a built-in panel-ready one.
  ([CabinetSelect](https://cabinetselect.com/standard-kitchen-cabinet-sizes/))

An enclosure is normally built rather than bought: a tall filler or finished
panel each side of the opening, and a bridge cabinet over the top. A 36"
appliance in a 42" enclosure is 3" of panel each side, which is what this app
draws.

## Corners

The corner is where a run stops being arithmetic, so it is worth being exact.

| Option | Wall consumed | Notes |
|---|---|---|
| Lazy susan `LS33` / `LS36` | 33" or 36" **on each wall** | Two rotating shelves, bi-fold doors. The clean answer, and what Scheme 01 uses. |
| Blind base `BBC36-42` | 39–48" | The cabinet is narrower than the space it occupies; the difference is dead corner reached past the neighbour's door. |
| Diagonal corner `DCSB36` | 36" each wall | A 45° face, usually for a corner sink. |
| Wall easy-reach `WER2442` | 24" each wall | The upper equivalent of a lazy susan. |
| Wall diagonal `WDC2442` | 24" each wall | 45° face. |

Sources:
[Lanae](https://lanaehome.com/blogs/news/corner-cabinet-dimensions-lazy-susan-and-alternatives),
[flipkitchen](https://www.flipkitchen.ca/learn/guide/sizes.html),
[Wholesale Cabinet Supply LS36](https://www.thewcsupply.com/products/kd-ls36).

A blind corner also needs 3–6" of filler beside it so the door can clear the
adjacent run's handles — which is why it eats 39–48" for a 36" box.

## Fillers and end panels

Widths move in 3" steps, so a wall almost never divides evenly. Fillers absorb
the remainder and get scribed to the wall on site.
([Kitchen Cabinet Kings](https://kitchencabinetkings.com/blog/how-to-install-cabinet-filler-strips/),
[Sherwood Shelving](https://sherwoodshelving.com/knowledge-base/dealer/cabinet-installation/how-to-scribe-filler-strips/))

| Item | Size |
|---|---|
| Base filler `BF3` / `BF6` | 3" or 6" × 34½" |
| Wall filler `WF3` / `WF6` | 3" or 6" × the cabinet height |
| Tall filler `TF3` / `TF6` | 3" or 6" × 96" |
| End panel `BEP` / `WEP` | ¾" thick, finished on the exposed side |

Two rules the code follows:

1. A filler goes **against a wall or beside an appliance**, never in the middle
   of a run where a cabinet belongs.
2. A run's modules plus its fillers add up to the run's length exactly. A
   remainder that no combination of 3" and 6" fillers can absorb is a layout
   error, not something to round away.

## IKEA SEKTION — the exception

SEKTION is metric under imperial labels and does not interoperate with the
above. Base widths 12 / 15 / 18 / 21 / 24 / 30 / 36 / 47", wall cabinets **15"
deep** rather than 12", wall heights 15 / 20 / 30 / 40", and a 30" base box on
legs that reaches 36" finished with a 4½" toe kick and a 1½" top.
([Dimensions.com](https://www.dimensions.com/element/ikea-sektion-wall-cabinet-1-door),
[Inspired Kitchen Design](https://inspiredkitchendesign.com/the-comprehensive-guide-to-ikeas-sektion-wall-cabinets/))

The 15" wall depth and the 20"/40" heights are the traps: a SEKTION upper will
not line up with a framed hood or a framed bridge cabinet. This app builds to
the framed convention throughout, and a SEKTION layout would need its own table
rather than a tweak to this one.

## What Scheme 01 is made of

Read each run from the inside corner outward.

**Left wall — 138"**

| Code | Width | |
|---|---|---|
| `LS36` | 36" | Lazy susan, shared with the back run |
| `B24` | 24" | |
| `DB18` | 18" | Drawer base |
| `B18` | 18" | The refrigerator's landing (D11 rule 6 wants ≥15") |
| `T4296` | 42" | Refrigerator enclosure: `TF3` + 36" opening + `TF3`, bridge over |

Uppers: `WER2442` + `W3042` + `W3042` + `W1242` = 96", stopping at the tower.

**Back wall — 132"** (the corner square belongs to the left run)

| Code | Width | |
|---|---|---|
| `B15` | 15" | Landing |
| `RO36` | 36" | Range opening |
| `B15` | 15" | Landing |
| `SB30` | 30" | Sink base |
| `RO24` | 24" | Dishwasher opening |
| `B12` | 12" | To the open end |

Uppers: `W1242` + `W4212` over the hood + `W3042` + `W3042` + `W1842`.
The `W4212` is the bridge: 84" to 96", picking the run up where the canopy stops.
