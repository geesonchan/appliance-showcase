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
| `fuel` | Appliance Type | Prefix: `Gas` → gas, `Induction` → induction, `Dual-Fuel` → dual, `Electric` / `E Range` / `ERange` → electric, anything else → `null`. |
| `installType` | Feature + Appliance Type + Width | An array, gathered from all three. See below. |
| `finish` | Color + Feature | `SS` → stainless, `Panel Ready` → panel-ready, `White` → white, `Black` → **matte-black** (the only black the scene renders). `Panel Ready` in Feature counts too. Empty → `["stainless"]`. |
| `highlights.en` | Feature | Whatever is left after install form and finish have taken their words: `French Door`, `Bottom Freezer`, `4 Door`… Split on `,` `;` `/`. |
| `widthIn` | Width | Number with the `CD` / `RD` suffix stripped. A row with no width is skipped and counted. |
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

| Appliance Type | category |
| --- | --- |
| `*Range` (`Gas Range`, `Induction Range`, `Dual-Fuel Range`, `ERange`) | `range` |
| `*Cooktop` | `cooktop` |
| `Refrigerator`, `Built-In Refrigerator` | `refrigerator` |
| `Dishwasher` | `dishwasher` |
| `*Hood` | `hood` |
| `OTR`, `Microwave` | `microwave` |
| `Wall Oven`, `Speed Oven`, `Steam Oven` | `wall-oven` |
| `Wine*`, `Beverage*`, `Freezer*` | `other` |
| `Washer`, `Dryer`, `Backguard`, `Handle`, `Filter`, `Blower`, `Pedestal`, `Outdoor*` | skipped, counted in the summary |
| *blank* | skipped as `blank type`, counted, **and the models are listed** |
| anything else | **fails the import** |

The last three rows are the important ones, and they are three different
things:

- **On the skip list** is a decision already made: an accessory or a laundry
  machine has no place in this scene.
- **Blank** means the model has almost certainly been discontinued — that is
  what an empty type indicates in `Stock current`. Those rows are skipped, but
  the import names every one of them, because "probably discontinued" is a
  judgement to confirm against the sheet, not a silent deletion.
- **Unrecognised** is a mistake. The import collects every unrecognised value
  in the file, prints them all with their row number and model, and exits
  non-zero without writing anything. One run tells you every value that needs a
  rule; you are never fixing them one at a time. A silent skip would shrink the
  catalogue and nobody would spot the missing model until a customer asked for
  it.

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
| Appliance Type | `Built-In` | `built-in` |
| Width | `CD` suffix | `counter-depth` |
| — | nothing matched | `["freestanding"]` |

So `Width = "36 CD"` on a `Refrigerator` with `Feature = "French Door"` gives
`widthIn: 36` and `installType: ["counter-depth"]`.

## Export summary

The import prints, and the tests assert on:

```
read 22 rows, exported 14
skipped:
    2  blank type
    1  no slot: cooktop
    1  no slot: other
    1  Washer
    1  Dryer
    1  Backguard
    1  Filter
blank type (probably discontinued), check these 2:
  Thermador PRD304GHU
  Zephyr ZRM-E30AS
warnings (3):
  bosch-b36cl80sns: no sourceUrl
```

`exported + skipped` always equals `rowsRead`; a test enforces it, so a row can
never vanish silently.

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
