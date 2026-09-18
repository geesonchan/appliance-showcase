# Data sheet spec

Where every field in `data/appliances.json` comes from, and what happens to it
on the way.

**Source:** two tabs of *2026 AA Inventory Manager*.

- **`showcase_specs`** is the hand-filled one, **keyed by Model**: cutouts,
  services, price, the document each row was checked against and the date it
  was checked. One row per SKU, in whatever order they were added.
- **`showcase_export`** is read-only and derived. A `QUERY` pulls eight raw
  columns from `Stock current` for the models listed in `showcase_picks`, and
  everything to its right is an `XLOOKUP` into `showcase_specs` on Model.

**Keyed, not positional.** The hand-filled columns used to sit beside the
`QUERY` in the same tab, which meant they were aligned by row position: a sort,
an insert or a deletion on either side slid one column against the other and
every row after it carried its neighbour's figures. Round 20 caught a block of
nine rows where the `sourceUrl` was one row out — a wine column citing a
refrigerator's sheet, an insert liner citing a blower's — with `verifiedAt`
dates against documents that were not theirs. Looking the values up by Model
is what makes that impossible rather than unlikely.

**Route:** download the tab as CSV, then

```bash
npm run import:csv -- ~/Downloads/showcase_export.csv
```

which normalises, validates against the zod schema the app itself loads, writes
`data/appliances.json`, and prints a summary of what it exported and skipped.

**The raw columns are never edited in the sheet.** Every normalisation rule
below lives in `scripts/normalise.ts` and is covered by tests. A change to a
rule is a code review and a test run, not a silent formula edit. See
docs/decisions.md D4.

---

## From `Stock current` (via QUERY, do not edit)

| App field | Sheet column | Rule |
| --- | --- | --- |
| `brand` | Brand | Known brands win outright (`GE`, `KitchenAid`, `Sub-Zero`, `Vent-A-Hood`…). Otherwise an ALL-CAPS name is title cased (`BOSCH` → `Bosch`, `BERTAZZONI` → `Bertazzoni`) and anything already mixed case is left alone. |
| `model` | Model | Trimmed. |
| `id` | Brand + Model | Slug of both, e.g. `bosch-b36cl80sns`. Together they identify a SKU. |
| `category` | Appliance Type | Lookup, see the table below. Blank is skipped as discontinued; an unrecognised value fails the import. |
| `fuel` | Appliance Type | Prefix: `Gas` → gas, `G ` → gas (as in `G Rangetop`), `Induction` → induction, `Dual-Fuel` → dual, `Electric` / `E Range` / `ERange` → electric, anything else → `null`. |
| `installType` | Feature + Appliance Type + Width + Depth, **or `PUBLISHED_SPECS`** | An array. Where `PUBLISHED_SPECS` names one for the model, that is the whole answer and the columns are not read; otherwise it is gathered from the words in Feature and Appliance Type and a `CD` in Width or Depth. See **Install form** below — including why a wrong install type is fixed in `PUBLISHED_SPECS`, not by adding a word to Feature. |
| `finish` | Color + Feature | `SS` or the word `stainless` → stainless, `Panel Ready` → panel-ready, `White` → white, `Black` → **matte-black** (the only black the scene renders). `Panel Ready` in Feature counts too. Empty → `["stainless"]`. |
| `highlights.en` | Feature | Whatever is left after install form and finish have taken their words: `French Door`, `Bottom Freezer`, `Bar Handle`, `4 Door`… Split on `,` `;` `/`. |
| `widthIn` | Width | Number with the `CD` / `RD` suffix stripped. A row with no usable width is skipped into a single `no width` bucket and named under `--verbose`; it never fails the import. |
| `depthIn` | Depth | Blank → `null`. `PUBLISHED_SPECS` comes first where it has one. A bare `CD` here is an install form, not a measurement: it sets `counter-depth` and leaves `depthIn` null. |
| `heightIn` | Height | Blank → `null`. `PUBLISHED_SPECS` comes first where it has one. |
| `doorConfig` | Feature | Refrigerators only, and `PUBLISHED_SPECS` first. Otherwise read off Feature's words: `Column` or `All Freezer`/`All Refrigerator` → column; `Side by Side` → side-by-side; `French` or `FD` → french door, with two drawers if it also says `4 Door` or `2 Drawer`; `Bottom Mount`/`Bottom Freezer` → bottom-freezer. Nothing recognised → `null`, and the room draws the commonest front (`french-door-1-drawer`) and marks it a guess. |
| `slot` | *derived* | From `category`, via each slot's `compatibleCategories` in `data/slots.json`, so the two cannot drift. A category no slot accepts is skipped and counted. |

## Filled in by hand in `showcase_specs`, looked up by Model

| App field | Sheet column | Rule |
| --- | --- | --- |
| `cutoutWidthIn` | cutoutWidthIn | `PUBLISHED_SPECS` first where it has one (so do the other two cutout cells). Blank → `null`; the fit check then falls back to `widthIn` and the import warns. What the three cutout figures mean depends on the install (decisions.md D4): the cabinet opening for a built-in, the hole in the counter for a drop-in, and the clear space — the machine's own outline — for a hung hood, which has no opening. |
| `cutoutHeightIn` | cutoutHeightIn | Blank → `null`. Mind the order: the cutout columns run Width, **Height**, Depth, while the body columns run Width, Depth, Height. |
| `cutoutDepthIn` | cutoutDepthIn | Blank → `null`. |
| `requires.gasBTU` | gasBTU | Blank → `null`. |
| `requires.voltage` | voltage | `240` or `120`; anything else reads as 120. |
| `requires.amps` | amps | Blank → `null`. |
| `requires.cfm` | cfm | Blank → `null`. Whether a package raises makeup air is decided from the airflow it actually moves, by the `makeup-air` rule in `data/rules.json`; the sheet's `makeupAirRequired` column is not read since round 65 (decisions.md D6). |
| `requires.water` | water | `true` / `yes` / `y` / `1`, case-insensitive. |
| `blower` | blower | Hoods only; `null` on anything else. `required` or `separate` → `required` (the hood ships without one, D6); anything else, blank included, → `integrated`. `PUBLISHED_SPECS` overrides it — VCIN36GWS, an insert liner, is `required` there. |
| `topDepthIn` | topDepthIn | Hoods only; `null` on anything else. The flat top of a wedge canopy, where the duct comes off. Blank → `null`. |
| `msrpUSD` | msrpUSD | `$` and `,` stripped, rounded to whole dollars. Blank **or zero** → `null`: a zero in the inventory means nobody has set a price, not that the model is free. Counted as `no msrpUSD`. |
| `leadTimeWeeks` | leadTimeWeeks | Blank → `null`. |
| `sourceUrl` | sourceUrl | `PUBLISHED_SPECS` first where it names the drawing its figures came from. Otherwise a URL, or `null` when blank. Counted as `no sourceUrl`; it does not fail the import. |
| `verifiedAt` | verifiedAt | ISO date, or blank → `null`, meaning nobody has checked this row against its `sourceUrl`. Also `null` when `PUBLISHED_SPECS` marks the row `unverified` (below). |

## Not from the sheet

| App field | Where it comes from |
| --- | --- |
| `series` | `null` on import. Hand-added afterwards if a row needs it. |
| `imageUrl` | `null`. Reserved for M3. |
| `highlights.zh` | `[]`. The translation pass fills it. |
| `burners`, `cooktopIn`, `backguardIn` | `PUBLISHED_SPECS`, below. |
| `depthWithDoorsIn`, `depthWithHandleIn`, `rearSpacerIn` | Likewise. |
| `frontLipIn`, `doorSplit` | Likewise. (`doorConfig` and `topDepthIn` can come from the sheet too — see the tables above.) |
| `compatibleBlowers` | `COMPATIBLE_BLOWERS` in `scripts/normalise.ts`, by hood model, from Thermador's ventilation accessory chart. Manufacturer compatibility rather than stock, so it is code, not a column. A hood that is not listed gets an empty list, and the app offers every blower in stock and says the list is unchecked. |

## What a drawing overrides: `PUBLISHED_SPECS`

A sheet carries what a shop stocks — brand, model, width, price. It does not
carry how many burners are on a range, where that range cooks as against how
tall it is, or how far a refrigerator's doors stand off its carcass, because no
buyer needs any of that to order one. This app draws the machine, so it does.

Those figures live in `PUBLISHED_SPECS` in `scripts/normalise.ts`, keyed by
model, each with the drawing it was read from named in a comment above it. The
import applies them **over** the sheet's own cells. Three things follow:

- **A figure the sheet has no column for** is simply added — a cooktop height,
  a front lip, a door split.
- **A nominal is refined to the published one.** The sheet's Width is what the
  model is called: a "36-inch" rangetop measures 35-15/16", and the fit check
  wants the machine rather than its name.
- **A cell the drawing contradicts is replaced, and the row is marked
  `unverified`** — which sets `verifiedAt` to null however recently the sheet
  says the row was checked, because the two sources disagree and only one of
  them can be what somebody read. Fix the cell in `showcase_specs` and the mark
  comes off. Which rows carry it today is a search, not a figure to keep here:
  `unverified: true` in `PUBLISHED_SPECS` (`scripts/normalise.ts`).

  It is for a disagreement nobody has reconciled, not for a decision. Where a
  machine publishes two ways of fitting it and this kitchen is built to the
  other one — the combination oven's sheet row gives the flush cutout where its
  tower is built to the standard one — neither the row nor the code is wrong,
  and the reason is written in the comment above the entry.

## Numbers

Every numeric cell goes through one parser, so decimals and fractions are the
same measurement however they were typed:

| Written as | Read as |
| --- | --- |
| `33.875` | 33.875 |
| `33-7/8` | 33.875 |
| `33 7/8` | 33.875 |
| `33-7/8"` | 33.875 |
| `7/8` | 0.875 |
| `36 CD` (Width) | 36, plus `counter-depth` |
| `CD` (Depth) | `null`, plus `counter-depth` |
| blank | `null` |

A cell with no number in it is null, never zero — a missing dimension has to
stay visibly missing, because zero would sail through a fit check.

---

## Appliance Type lookup

Rules are ordered; the first match wins, so the `Range` and `Cooktop` suffixes
catch every fuel prefix without a row per combination.

| Appliance Type | category | install form it implies |
| --- | --- | --- |
| `*Range` (`Gas Range`, `Induction Range`, `Dual-Fuel Range`, `ERange`) | `range` | — |
| `G Rangetop`, `Induction Rangetop` | `range` | `rangetop` |
| `*Cooktop` | `cooktop` | — |
| `Wall Oven`, `Speed Oven`, `Steam Oven` | `wall-oven` | — |
| `Single Oven` | `wall-oven` | `single` |
| `Double Oven`, `Steam Double Oven` | `wall-oven` | `double` |
| `Speed Combo Oven`, `Microwave Combo Oven`, `Steam Combo Oven`, `Triple Combo Oven` | `wall-oven` | `combo` |
| `OTR`, `Microwave` | `microwave` | — |
| `Microwave Drawer` | `microwave` | `drawer` |
| `Built-In Microwave` | `microwave` | `built-in` |
| `Countertop Microwave` | `microwave` | `countertop` |
| `Refrigerator`, `Built-In Refrigerator` | `refrigerator` | — |
| `Refrigerator Column` | `refrigerator` | `column` |
| `Undercounter Refrigerator` | `refrigerator` | `undercounter` |
| `Refrigerator Drawer` | `refrigerator` | `drawer` |
| `All Refrigerator`, `All Freezer` | `refrigerator` | — |
| `Dishwasher` | `dishwasher` | — |
| `*Hood` | `hood` | — |
| `Blower` | `blower` | — (filed under `slot-hood` but never offered as a hood; a line of its own on the quote, D6 and D9) |
| `Wine*` | `wine` | — |
| `Freezer Column` | `freezer` | `column` |
| `Built-In Coffee Machine` | `coffee` | `built-in` |
| `Beverage*`, `Freezer` and any other `Freezer*` | `other` | — |
| `Warming Drawer`, `Ice-Maker`, `Trash Compactor` | `other` | — |
| `Countertop Coffee Machine` | `other` | — |
| `Countertop Combo Oven` | `other` | `countertop` |
| the explicit skip list (laundry, parts, warranties — see `SKIPPED_TYPES`) | skipped by name, counted |  |
| anything containing `Kit`, `Panel`, `Handle`, `Cover`, `Filter` or `Accessor*` | skipped as `accessory-like`, counted |  |
| *blank* | skipped as `blank type`, counted, **and the models are listed** |  |
| anything else | **fails the import** |  |

### Order matters

Rules are tried in this order, and the order is the safety property:

1. blank, then `Outdoor*`
2. the **explicit skip list**, matched exactly
3. the **category rules** above, all anchored except the `*Range` / `*Rangetop`
   / `*Cooktop` / `*Hood` suffixes
4. the **accessory catch-all**
5. otherwise, unknown

The catch-all comes last on purpose. `Refrigerator Kit`, `Handle for
Refrigerator`, `Cafe Range Kit` and `Microwave Mounting Kit` are all parts named
after appliances; anchoring the category rules and running the exact tables
first means none of them can be mistaken for the real thing, and a genuine
appliance can never be swallowed by a word in its name. It also matches on word
boundaries, so `Kit` cannot eat a `Kitchen` anything.

### Near misses worth knowing about

| These look alike | but | |
| --- | --- | --- |
| `Speed Combo Oven` | `wall-oven` | goes in a tall tower |
| `Countertop Combo Oven` | `other` | sits on the counter |
| `Countertop Microwave` | `microwave` | |
| `Built-In Coffee Machine` | `coffee` | has a tall cabinet in package D |
| `Countertop Coffee Machine` | `other` | |
| `Freezer Column` | `freezer` | stands in a column group |
| `Microwave Drawer` | `microwave` | |
| `Refrigerator Drawer` | `refrigerator` | |
| `Warming Drawer` | `other` | |
| `All Freezer` | `refrigerator` | a column that happens to be all freezer |
| `Freezer` | `other` | standalone |

Each pair has a test.

`other` is a recognised category with no slot in this kitchen, so those rows
are skipped at the next step and counted as `no slot: other` — a scene
limitation, not a data error. `cooktop` used to be the same, until
`slot-cooktop` was added in round 49 (decisions.md D20); cooktops import now.
Which categories have a slot is `compatibleCategories` in `data/slots.json`,
not this paragraph.

## Install form

`installType` is an array because a row can be several things at once.

**First, `PUBLISHED_SPECS`.** Where it names an `installType` for the model,
that is the whole answer: the sheet's columns are not read for it. This is how
a machine's install is set when its words in the sheet say nothing, or the
wrong thing — CIT367YG's `drop-in` (its guide, pages 6-8), PCG366W's
`rangetop`, HMCB30WS's `wall-mount` + `chimney`, VCIN36GWS's `insert`, and the
towers' and columns' forms. **A wrong install type is fixed there, from the
model's own document, not by adding a word to Feature**: `drop-in` is not in
the word list below, so no Feature cell can produce it, and a word added to the
sheet to steer the importer is a rule that lives in the sheet, which D4
forbids.

This is also the answer to the hazard decisions.md D4 records:
**`["freestanding"]` usually means nothing matched**, not that the machine
stands on its own. A row whose words match nothing below comes in as
`freestanding`, in the same bucket as a machine that really does — the
dishwashers and the wine cabinet among them. Code that reads `installType`
should not take `freestanding` at its word, and the way a row stops being a
false `freestanding` is an entry in `PUBLISHED_SPECS` from its manual. How many
rows are in that bucket today is a count, not a figure to keep here: the rows
of `data/appliances.json` whose `installType` is exactly `["freestanding"]`.

**Otherwise, from the columns.** Feature and Appliance Type are read together —
every word below is looked for in both — then Width and Depth:

| Looks for (Feature or Appliance Type) | Produces |
| --- | --- |
| `Slide-In` | `slide-in` |
| `Under Cabinet` | `under-cabinet` |
| `Chimney` | `wall-mount` |
| `Insert`, `Island`, `Downdraft`, `Column`, `Drawer`, `Single`, `Double`, `Steam`, `Combo`, `Countertop`, `Undercounter`, `Rangetop` | the same word, lower cased |
| `Internal`, `Inline`, `External` (a blower's mounting) | the same word, lower cased |
| `Built-In` — **Appliance Type only** | `built-in` |
| `CD` in Width (`36 CD`) or as the whole Depth cell | `counter-depth` |
| nothing matched | `["freestanding"]` — see above |

So `Width = "36 CD"` on a `Refrigerator` with `Feature = "French Door"` gives
`widthIn: 36` and `installType: ["counter-depth"]`. The list itself is
`INSTALL_WORDS` in `scripts/normalise.ts`; this table follows it, not the other
way round.

## Export summary

For the test fixture, the import prints:

<!-- import-summary:fixture:start -->
```
read 45 rows, exported 34, skipped 11
skipped:
     2  blank type
     2  no slot: other
     2  accessory-like
     1  Washer
     1  Dryer
     1  Backguard
     1  Filter
     1  no width
blank type (probably discontinued), check these 2:
  Thermador PRD304GHU
  Zephyr ZRM-E30AS
warnings:
     3  no cutoutWidthIn
     2  no msrpUSD
     1  no sourceUrl
re-run with --verbose to list the rows behind those counts
```
<!-- import-summary:fixture:end -->

*This block is the test fixture's real output*
(`tests/fixtures/showcase_export.sample.csv`), *and a test holds it to that*
(`scripts/csv-to-json.test.ts`, "the documented import summary"): *change the
fixture or the summary's wording and the test fails with the text to paste
here. It shows the format; it is not a report on the live catalogue — for
that, run the import.*

`exported + skipped` always equals `rowsRead`. A test enforces it over the
fixture, and the import itself checks it on every real run: if it does not
close, the import exits with an error and writes nothing. Read the skipped
total on the first line, not the first line under `skipped:`.

Everything is counted rather than listed, with two exceptions:

- **blank types are always named**, because skipping them is an inference from
  an empty cell and the inference is worth confirming;
- **`--verbose`** expands the warning buckets and the `no width` bucket into
  one line per row.

At full-catalogue scale a line per row buries the summary it belongs to, which
is why counts are the default.

When a file also contains unrecognised types, the summary above still prints —
so you see the blank-type models in the same run — and then the import fails.
*Illustrative, not from any file: the rows and types below are made up to show
the shape.*

```
2 unrecognised Appliance Type value(s):
  row 2: "Sous Vide Circulator" (BOSCH B36CL80SNS)
  row 7: "Warming Drawer" (GE JGP5036SLSS)
Add a rule to scripts/normalise.ts, or add the value to SKIPPED_TYPES, rather
than letting the rows through.
```

`data/appliances.json` is left untouched on that path.
