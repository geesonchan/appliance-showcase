# Data sheet spec

Where every field in `data/appliances.json` comes from, and what happens to it
on the way.

**Source:** the `showcase_export` tab of *2026 AA Inventory Manager*. It is a
read-only derived tab: a `QUERY` pulls eight raw columns from `Stock current`
for the models listed in `showcase_picks`, and the rest are filled in by hand to
its right.

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
| `installType` | Feature + Appliance Type + Width | An array, gathered from all three. The Appliance Type names the form directly for the families that come in several (`Single Oven`, `Microwave Drawer`, `Refrigerator Column`). See below. |
| `finish` | Color + Feature | `SS` → stainless, `Panel Ready` → panel-ready, `White` → white, `Black` → **matte-black** (the only black the scene renders). `Panel Ready` in Feature counts too. Empty → `["stainless"]`. |
| `highlights.en` | Feature | Whatever is left after install form and finish have taken their words: `French Door`, `Bottom Freezer`, `4 Door`… Split on `,` `;` `/`. |
| `widthIn` | Width | Number with the `CD` / `RD` suffix stripped. A row with no usable width is skipped into a single `no width` bucket and named under `--verbose`; it never fails the import. |
| `depthIn` | Depth | Blank → `null`. |
| `heightIn` | Height | Blank → `null`. |
| `slot` | *derived* | From `category`, via each slot's `compatibleCategories` in `data/slots.json`, so the two cannot drift. A category no slot accepts is skipped and counted. |

## Filled in by hand, to the right of the QUERY

| App field | Sheet column | Rule |
| --- | --- | --- |
| `cutoutWidthIn` | cutoutWidthIn | Blank → `null`; the fit check then falls back to `widthIn` and the import warns. |
| `cutoutHeightIn` | cutoutHeightIn | Blank → `null`. |
| `cutoutDepthIn` | cutoutDepthIn | Blank → `null`. |
| `requires.gasBTU` | gasBTU | Blank → `null`. |
| `requires.voltage` | voltage | `240` or `120`; anything else reads as 120. |
| `requires.amps` | amps | Blank → `null`. |
| `requires.cfm` | cfm | Blank → `null`. |
| `requires.water` | water | `true` / `yes` / `y` / `1`, case-insensitive. |
| `requires.makeupAirRequired` | makeupAirRequired | An explicit yes, **or** derived: `cfm >= 400` (California Title 24). |
| `msrpUSD` | msrpUSD | `$` and `,` stripped, rounded to whole dollars. |
| `leadTimeWeeks` | leadTimeWeeks | Blank → `null`. |
| `sourceUrl` | sourceUrl | Must be a URL. Blank fails validation; the import warns first. |
| `verifiedAt` | verifiedAt | ISO date, or blank → `null`, meaning nobody has checked this row against its `sourceUrl`. |

## Not from the sheet

| App field | Where it comes from |
| --- | --- |
| `series` | `null` on import. Hand-added afterwards if a row needs it. |
| `imageUrl` | `null`. Reserved for M3. |
| `highlights.zh` | `[]`. The translation pass fills it. |

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
| `Wine*`, `Beverage*`, `Freezer*` | `other` | — |
| `Warming Drawer`, `Ice-Maker`, `Trash Compactor` | `other` | — |
| `Built-In Coffee Machine`, `Countertop Coffee Machine` | `other` | — |
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
| `Countertop Coffee Machine` | `other` | |
| `Microwave Drawer` | `microwave` | |
| `Refrigerator Drawer` | `refrigerator` | |
| `Warming Drawer` | `other` | |
| `All Freezer` | `refrigerator` | a column that happens to be all freezer |
| `Freezer` | `other` | standalone |

Each pair has a test.

Note that `cooktop` and `other` are recognised categories with no slot in this
kitchen, so those rows are skipped at the next step and counted separately as
`no slot: cooktop`. That is a scene limitation, not a data error.

## Install form

`installType` is an array because a row can be several things at once. Sources,
in order:

| Source | Looks for | Produces |
| --- | --- | --- |
| Feature | `Slide-In` | `slide-in` |
| Feature | `Under Cabinet` | `under-cabinet` |
| Feature | `Chimney` | `wall-mount` |
| Feature | `Insert`, `Island`, `Downdraft`, `Column`, `Drawer`, `Single`, `Double`, `Combo` | the same word, lower cased |
| Appliance Type | `Single`, `Double`, `Combo`, `Drawer`, `Column`, `Countertop`, `Undercounter`, `Rangetop` | the same word, lower cased |
| Appliance Type | `Built-In` | `built-in` |
| Width | `CD` suffix | `counter-depth` |
| — | nothing matched | `["freestanding"]` |

So `Width = "36 CD"` on a `Refrigerator` with `Feature = "French Door"` gives
`widthIn: 36` and `installType: ["counter-depth"]`.

## Export summary

The import prints, and the tests assert on:

```
read 38 rows, exported 24
skipped:
     4  no slot: other
     2  blank type
     2  accessory-like
     1  no slot: cooktop
     1  Washer
     1  Dryer
     1  Backguard
     1  Filter
     1  no width
blank type (probably discontinued), check these 2:
  Thermador PRD304GHU
  Zephyr ZRM-E30AS
warnings:
     3  no sourceUrl
     1  no cutoutWidthIn
re-run with --verbose to list the rows behind those counts
```

`exported + skipped` always equals `rowsRead`; a test enforces it, so a row can
never vanish silently.

Everything is counted rather than listed, with two exceptions:

- **blank types are always named**, because skipping them is an inference from
  an empty cell and the inference is worth confirming;
- **`--verbose`** expands the warning buckets and the `no width` bucket into
  one line per row.

At full-catalogue scale a line per row buries the summary it belongs to, which
is why counts are the default.

When a file also contains unrecognised types, the summary above still prints —
so you see the blank-type models in the same run — and then the import fails:

```
2 unrecognised Appliance Type value(s):
  row 2: "Sous Vide Circulator" (BOSCH B36CL80SNS)
  row 7: "Warming Drawer" (GE JGP5036SLSS)
Add a rule to scripts/normalise.ts, or add the value to SKIPPED_TYPES, rather
than letting the rows through.
```

`data/appliances.json` is left untouched on that path.
