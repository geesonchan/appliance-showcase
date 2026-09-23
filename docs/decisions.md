# Decisions

Standing decisions that outlive a single milestone. Each one records what was
decided, why, and what it forbids — the last part matters most, because these
exist to stop a behaviour creeping back in.

---

## D1 · The camera moves for three reasons, and no others

**Decided:** 2026-09-05 (round 2), extended round 3 and M3-2.

The camera pose is user state. Nothing may move it as a side effect of an
unrelated change. Exactly three behaviours are allowed to move it, or to change
what it shows, on their own:

1. **Direct navigation.** Selecting an appliance flies the camera in; the reset
   button returns it to the default isometric view; the zoom buttons step the
   orthographic zoom. All are the direct result of the user asking to move.
2. **The mobile sheet framing offset.** While the half-height sheet is open the
   framing shifts up by 12% of the viewport height, easing over 300ms, and
   returns when the sheet closes. Implemented as a pan — target and position
   move by the same vector — so the orbit relationship, and therefore the
   controls' own state, is untouched. The offset is derived in screen space
   every frame, so it survives orbiting and zooming.
3. **Fading what stands in the way.** Every slot declares a `bestView` — azimuth
   and pitch, in `data/slots.json` — and the fly-in arrives there directly.
   Where cabinetry, the island counter or a wall then sits on the sight line, it
   drops to 20% opacity for as long as that slot is selected and is restored
   exactly as it was on the way out. Only what is actually on the line: the
   check is a small grid of rays over the appliance's own footprint, cast along
   the camera's forward axis, because the camera is orthographic and one ray
   down the middle slips between two cabinets and leaves both of them solid.

   **This replaces the earlier licence to drop the pitch for island slots.** The
   microwave drawer faces the perimeter, so with an orthographic camera and a
   near plane behind the room there is no angle that sees it with nothing in
   front. Moving the camera to dodge an obstruction only trades it for a worse
   angle; the obstruction is what has to move.

**Forbidden:** switching render mode, toggling day/night, toggling a layer, or
changing language must leave the camera pose bit-identical.

**Why this is written down:** it has already regressed once. Passing
`shadows={renderMode === "realistic"}` to the R3F `Canvas` could re-create the
renderer, which re-ran the effect that constructs `OrbitControls`, which reset
the pose to the default. The fix was to make `shadows` a constant and decide
per-light whether it casts. Anything that changes the identity of the renderer
or the camera will do the same thing again.

**How to check:** the smoke test asserts that the on-screen positions of all six
pin labels are byte-identical across the three render-mode switches. Pin
positions are projected through the camera, so they are a direct proxy for the
pose. Under `?debug=1` the fade publishes what it is currently hiding as
`window.__faded`, and the smoke test asserts that flying to the microwave fades
the island counter and that resetting the view restores everything.

---

## D2 · Layers are mounted once and toggled by `visible`

**Decided:** 2026-09-05 (M1).

`CabinetLayer`, `ApplianceLayer` and the four `UtilityLayer`s stay mounted for
the life of the page. Render mode changes material properties and `visible`
flags; it never mounts or unmounts geometry.

**Two consequences that are easy to get wrong:**

- A material whose `transparent` flag changes needs a *new* material, not a
  property write — three.js will not recompile the program otherwise. These
  materials carry a React `key` on the flag. `ShaderWarmup` compiles those
  variants at load so the first switch into install mode does not stall.
- `Raycaster` does **not** skip invisible objects (three.js dropped that in
  r152), and line raycasts use a threshold measured in world units — a whole
  foot at this scale. An invisible wireframe is therefore still a raycast hit.
  The cabinet wireframe opts out with `raycast={() => null}`, and pin occlusion
  only counts visible meshes.

---

## D3 · Product data is JSON, validated at load

**Decided:** 2026-09-05 (M2).

`data/*.json` is the source of truth for appliances, slots, schemes and rules.
It is validated with zod at import time and the app refuses to start on a
schema violation rather than rendering something subtly wrong.

Room geometry — wall positions, cabinet run segments, counter heights, where the
island stands — stays in `src/data/room.ts`. It is scene construction, not
product data, and Leo does not maintain it in the Sheet.

**Unpriced is a real state, not a zero.** `msrpUSD` is nullable, and a zero in
the sheet reads as null too: an allocated or made-to-order line has no list
price, and counting it as zero would quietly understate the package total —
the one number a customer remembers. The UI shows "price on request" for those
models, totals cover only the priced ones, and both panels say "N of M priced"
whenever the total is not the whole package.

Every catalogue row carries `sourceUrl` and `verifiedAt`. `verifiedAt: null`
means nobody has confirmed that row against the manufacturer's own page yet;
seed data ships that way deliberately, so unverified pricing is visible in the
data rather than assumed.

---

## D4 · The inventory sheet is a read-only source, and cleaning happens in code

**Decided:** 2026-09-05 (M2).

`data/appliances.json` is generated from the `showcase_export` tab of *2026 AA
Inventory Manager* — a derived tab whose eight raw columns are pulled by `QUERY`
from `Stock current`, for the models listed in `showcase_picks`. Export is a
manual CSV download through `npm run import:csv`. No Apps Script, no API.

**The raw columns are never edited, and no cleaning is done in the sheet.**
Every normalisation rule — the Appliance Type lookup, the fuel prefixes, the
`CD` width suffix, brand casing — lives in `scripts/normalise.ts` and is covered
by tests. The full mapping is docs/data-sheet-spec.md.

**Why:** the sheet is the system of record for a shop's stock, not for this app.
It has other consumers and other people editing it. A cleaning formula added
there would be invisible to this repository, unversioned, and untested; the same
rule in code is reviewable, diffable, and fails a test when it stops matching.

**Forbidden:** reading a column this app cleaned itself back into the sheet, and
adding a rule that only exists as a spreadsheet formula.

**Three ways a row can fail to make it in, and they are not the same thing:**

1. **On the skip list** — `Washer`, `Handle`, `Outdoor*` and the rest. A
   decision already made; counted in the export summary.
2. **Blank `Appliance Type`** — in `Stock current` this means the model has
   almost certainly been discontinued, so the row is skipped and counted
   separately as `blank type`. The import also **names every one of those
   models**, because it is inferring intent from an empty cell and that
   inference should be confirmed against the sheet, not taken on trust.
3. **Unrecognised** — a value nobody has classified. This **fails the import**.
   The whole file is scanned first and every unrecognised value is reported at
   once with its row and model, so one run surfaces all of them; nothing is
   written on that path. Skipping silently would shrink the catalogue
   invisibly — the failure mode is a model quietly missing from the picker,
   which nobody notices until a customer asks for it.

There is a fourth, added after a census run over the full 4,703-row inventory:
a **catch-all for accessories**. Anything whose type contains `Kit`, `Panel`,
`Handle`, `Cover`, `Filter` or `Accessor*` and has not already been classified
is skipped and counted as `accessory-like`. It runs *last*, after both exact
tables, because the inventory is full of parts named after appliances —
`Refrigerator Kit`, `Handle for Refrigerator`, `Cafe Range Kit`. Ordering it
last, and anchoring the category patterns, is what stops the catch-all eating a
real appliance.

`exported + skipped === rowsRead` is asserted, so no row can disappear without
appearing in one of those counts.

*Amended 2026-09-14 (round 40), Leo:* it is asserted on the real run too, not
only over the test fixture. A run that does not close exits with an error and
writes nothing (`assertAccounted`), and the first line of the summary carries
the skipped total — `read 33 rows, exported 32, skipped 1` — so that line read
on its own adds up. The reason: an import was reported as read 33 / exported 29
/ skipped 1. The converter counts every row it does not export, so the other
three were almost certainly on another line under `skipped:`, but that run's
CSV and output are not in the repository and no committed `appliances.json` ever
held 29 entries (it went from 25 to 32 in `e0eaf0f` and has been 32 since), so
which three rows, and why, cannot be recovered. The same kind of failure as the
smoke suite's count (Open items): a summary that can be misread as success.

*Amended 2026-09-14 (round 40), Leo: a cutout figure means one of three things,
by how the machine is installed.* The three `cutout*In` cells are the space the
machine needs, and what bounds that space depends on the install:
- **Built in** — a wall oven, a built-in refrigerator, a dishwasher: the cabinet
  opening.
- **Dropped in** — a cooktop, a rangetop: the hole in the counter, with how far
  the machine drops below the counter in `cutoutHeightIn`.
- **Hung** — an island hood, hung from the ceiling over open space: there is no
  opening. The figure is the clear space the machine needs, which is its own
  outline. HMIB42WS's cutout cells equal its body on purpose, 42" wide, 27"
  deep, 30" high, and are not a mistake to clear. (Its installed height is
  another matter; see D20.)

So a cutout equal to the body is right for a hung machine and a question worth
asking of any other. The fit check passes a machine that exactly fills its
space, with a millionth of an inch of tolerance so fractions added in floating
point never fail on equality (`fit.ts`). Two sheet traps sit next to this: the
cutout columns run Width, Height, Depth while the body columns run Width,
Depth, Height, so copying one set across the other crosses height and depth.

**T36IT100NP's 84" is taken as the cabinet opening's height — an inference.**
*(Leo, round 40.)* Its own sheet is not in `docs/reference/`, so which of
its figures 84" is cannot be read. Three things point the same way, and none
of them is that sheet:
- (a) Leo confirms 84".
- (b) The sheet of its sibling in the same Freedom series, T36BT120NS
  (`docs/reference/thermador-t36bt120ns.png`, page 4, proud install), marks 84"
  as the height of the cutout.
- (c) Package A's refrigerator slot is 36" x 84" x 25", and a built-in
  refrigerator renders in it and fits (round 40 screenshot). The machine drawn
  there is T36BT120NS, not T36IT100NP; T36IT100NP appears among that slot's
  alternatives with no overrun against it but has not itself been drawn.

To check when T36IT100NP's sheet is in the repository. The side effect now:
`appliances.json` has 84" for both its body height and its cutout height, so
the clearance between them is zero. `normalise.ts` quotes that sheet's page 4
as giving the body as 83-7/8" (`FREEDOM_SPLIT`, round 13); if the sheet, once
in, says so, the body height changes and the cutout stays 84".

**Counts by default, rows on request.** The summary reports buckets, not lines:
`no width: 12` rather than twelve lines. `--verbose` expands them. The one
exception is blank types, which are always named, for the reason above. A
census over the whole inventory is what made this necessary — a line per row
buries the summary it belongs to.

**The mapping table is the specification.** Every value the census turned up
has a test case in `scripts/classification.test.ts`, including the near misses
that sit one word apart: `Speed Combo Oven` is a wall oven and `Countertop
Combo Oven` is not; `Microwave Drawer`, `Refrigerator Drawer` and `Warming
Drawer` are three different categories; `All Freezer` is refrigeration and
`Freezer` is not.

---

**`freestanding` usually means "nothing matched". A known hazard, noted
2026-09-14 (round 50), Leo.** The importer reads install type from words in the
Feature and Appliance Type cells, and a row where none of its words appears
comes in as `freestanding`. Of the eight catalogue rows that say freestanding,
the two dishwashers (SHV78CM3N, SHX78CM5N), the over-the-range microwave
JVM3160RFSS and the wine cabinet PRW24C01CG are that default. They sit in the
same bucket as the machines that really stand on their own, like package C's
range, and nothing tells the two apart. Nothing visible is wrong today. But
round 45's HMIB42WS was a model that some piece of code trusted an install type
for, so any new logic that reads `installType` should not take `freestanding` at
its word. How a machine installs comes from its manual, into `PUBLISHED_SPECS`;
CIT367YG's `drop-in` is the first to arrive that way since PCG366W's `rangetop`
(round 50). Not changed.

*Round 67:* the "eight" above was a count typed in when this was written, and
it has moved — CIT367YG left the bucket when it became `drop-in`. How many rows
are a default `freestanding` today is a count to run, not a figure to keep: the
rows of `data/appliances.json` whose `installType` is exactly
`["freestanding"]`. The fix for any one of them, and why it is not a word
added to Feature, is written where the importer is described:
docs/data-sheet-spec.md, **Install form**.

## D5 · The kitchen is a rangetop, an island, and no wall oven

**Decided:** 2026-09-05 (M2), from Leo's read of the catalogue.

Five judgements about how this kitchen is actually specified, which between
them decide the scene layout:

1. **A 36" rangetop and a single wall oven duplicate each other.** The classic
   package pairs the 36" rangetop with a 24" undercounter wine cabinet instead.
   So Scheme 01 has no oven tower, and `wall-oven` reports as `no slot:
   wall-oven` on import. Scheme 02 brings the tower back.
2. **The microwave drawer and the wine cabinet go under the island counter.**
   Both are 24" base openings on the island's front face.
3. **A model narrower than the opening is not blocked.** It needs filler, and
   the panel says how much on each side — the difference halved, to a tenth of
   an inch. Narrow is a trim question the cabinetmaker answers.
4. **Depth is reported, never blocking.** An enclosure can be furred out; a wall
   cannot be widened. Only width gates.
5. **Most high-end hoods ship without a blower.** See D6.

**The island's two openings face opposite ways, on purpose.** The microwave
drawer opens toward the perimeter, where the cook stands. The wine cabinet
opens toward the seating side, where the person pouring stands — and, not by
accident, toward the camera, so the overview shows a glass door rather than a
blank cabinet end. The microwave's fly-in therefore orbits round to the working
side, which is one of the two camera behaviours D1 allows; the wine cabinet
needs no such help.

**The room is 14' x 12'.** Confirmed on review.

That depth is set by the island rather than by taste: a 24" run plus a 36"
island plus the 42" aisles either side is what a working kitchen needs, and the
10' this started at put the island within arm's reach of the range.

---

## D6 · A blower is a line on the quote, not a slot in the room

**Decided:** 2026-09-05 (M2).

Most high-end hoods ship without a blower, and it is the blower — not the hood —
that has a CFM. So:

- Hoods carry a `blower` field: `integrated` or `required`.
- `required` hoods have `cfm: null`. The package's **effective CFM** comes from
  the blower, and that is what sizes the duct and decides makeup air.
- The blower is chosen in its own picker under the hood, offering blowers from
  the same maker, and it takes its own line on the package total — a separate
  purchase with its own lead time, which burying it in the hood's price would
  hide.
- Blowers are classified as their own category and filed under `slot-hood`,
  because that is what they attach to, but they are kept out of the hood picker.
  They are not slot occupants.
- `internal` / `inline` / `external` is read from the Feature column. Drawing
  the blower in its actual position is M3.

**A hood that needs a blower and has none is a blocker**, not a warning: it is
not an installable specification.

**Makeup air: what the line may say, and where each part of it comes from.**
*(Amended rounds 65 and 66, Leo.)* A package whose blower moves 400 CFM or
more gets one line on the install checklist, the hood's spec card and the
quote — in all four packages as they open (A, B and D at 1,000 CFM, C at 600).
From the project's first day to round 64 it read "California Title 24 requires
makeup air". Since round 66:

> {cfm} CFM. Codes may require makeup air at this airflow. California
> Mechanical Code §505 calls for makeup air above 400 CFM; Title 24 may also
> apply based on floor area. Whether it is required depends on the home's
> combustion appliances and floor area — confirm with your HVAC contractor and
> local building department.

> {cfm} CFM。此风量下规范可能要求配置补风系统。加州机械规范（CMC）第 505 节规定
> 400 CFM 以上需补风；Title 24 另有按房屋面积计算的要求。是否必须，取决于住宅内的
> 燃烧设备类型和面积，请与暖通承包商及当地建筑部门确认。

**Where each part comes from.**
- **That a high-CFM hood may need makeup air**: both hood guides in
  `docs/reference/`, `HMIB42WS_Installation.pdf` and `vcin36gws-manual.pdf` —
  local codes may require it above a figure that varies from place to place,
  for the owner and installer to determine. VCIN36GWS offers a relay for a
  makeup-air damper. Neither gives a figure or names a code.
- **400 CFM: the California Mechanical Code (CMC), section 505**, whose source
  is the same provision in the IRC and the IMC. **Written as "§505" and no
  further**: secondary sources give it as 505.1 or as 505.2 (the second is the
  IMC's numbering), and the CMC's own text has not been read.
- **Title 24 is two different things, and the old line ran them together.**
  Part 6, §150.0(o), governs the exhaust itself — at least 100 CFM, at most 3
  sones, HVI-certified, ducted outside — not makeup air. Separately, Title 24
  has a makeup-air requirement worked from floor area: the two largest exhaust
  fans together above 15 CFM per 100 square feet.
- **How it was checked**: by Leo in round 66, from public secondary sources,
  not the codes' own text. San Francisco's amendments have not been checked;
  "confirm with … local building department" in the line is what covers that.
- The round-65 version, "local building codes may require…", said only what
  the guides say. It was right in direction and is replaced because Leo's
  check gives the code and the figure.

**It is a reminder, not a verdict — and must stay one.** *(Leo, round 66.)*
Whether makeup air is required is not something this app can decide. The 400
CFM rule bites only where the house has a naturally drafted fuel-burning
appliance; a house whose combustion appliances are all direct-vent or power-
vented is outside it, and the 15 CFM per 100 square feet rule likewise applies
only where a naturally drafted appliance is inside the house's pressure
boundary. Deciding it needs the water heater, the furnace, the fireplace and
the floor area — and this app knows only the hood's CFM. So the line says
"may", names the codes, and sends the customer to the people who can see the
house. **Do not try to make this rule answer "required" or "not required".**
- A counter-intuitive point, recorded because it is easy to get backwards: the
  floor-area rule is far stricter than 400 CFM. A 2,000 sq ft house allows the
  two largest fans 300 CFM together, and the hoods this app shows are mostly
  1,000 CFM. "Makeup air above 400" can be the lenient reading in a house with
  gas appliances, not the strict one.

**The threshold lives in one place**, the `makeup-air` rule's condition in
`data/rules.json` (D7: a merchant's figure, changed without a release). Three
other copies were deleted in round 65, none of which anything read:
`thresholds.makeupAirCfm`, `needsMakeupAir()` in `ventilation.ts` (called only
by a test), and the importer's `makeupAirRequired` flag with its own `>= 400`
(the sheet's column of that name is no longer read).

---

## D7 · Rules are data; availability is code

**Decided:** 2026-09-05 (M2).

`data/rules.json` holds the §3.5.4 checks *and* the sizing thresholds that used
to be constants in the scene — the gas pipe upsize BTU, the makeup air CFM, the
duct diameter bands. A threshold is a business judgement, and changing one
should not need a release.

A rule is `{ id, scope, severity, messageKey, when[], params }`. `when` reads
dotted paths out of an evaluation context of `appliance`, `slot`, `fit` and
`package`; `scope` says whether it is answered once per appliance or once for
the whole package, because a rule that reads only `package.*` facts would
otherwise report the same finding six times.

Every rule has a positive and a negative sample in `src/data/rules.test.ts`,
each keyed to a real model, so moving a threshold shows up as a failing test
naming the model that moved across it.

**Slot availability is deliberately not in rules.json.** An over-the-range
microwave occupying the hood's wall is different in kind from the checklist
rules: those describe extra work, this one removes a choice. It lives in
`src/data/availability.ts` and drives an explicit unavailable state in the
picker.

**The install checklist is the quote sheet's input.** Each finding carries its
rule id and the slot it is about, so a line on the quote can be traced back to
why it is there.

---

## D8 · A scheme is a preference; the catalogue is the truth

**Decided:** 2026-09-06 (M2), after the first real import.

`data/appliances.json` is regenerated from the inventory sheet whenever stock
changes, so the ids in it change. A `defaultSelection` naming a model that has
left the catalogue must not stop the app: it falls back to the cheapest
candidate for that slot and warns on the console naming what it could not find.
`defaultBlower` simply becomes null, since a blower is optional by nature.

A selection filed under the **wrong** slot still throws — that is a mistake in
the scheme, not a change in stock.

**Tests follow the same rule.** The rule and fit tests are built from
`src/data/testFixtures.ts`, not from the live catalogue: a test keyed to a SKU
fails the day that SKU sells out, which says nothing about the rule under test.
Only `catalogue.test.ts` asserts over live data, and only invariants that should
genuinely track it — unique ids, categories matching their slot, the scheme
resolving.

The first import proved the point twice over: the wine cabinet came through
filed under Zephyr rather than Thermador, and the blowers were not in the
catalogue at all yet.

---

## D9 · A blower has no width, and does not need one

**Decided:** 2026-09-06 (M2), from the first import.

Three blowers were dropped as `no width`. That was the importer being right
about the wrong thing: a blower is an accessory bolted to a hood, not something
that goes in an opening, so the sheet has no width for it and the fit check has
nothing to say about it.

`widthIn` is nullable, and the schema refuses a null on anything except a
blower — an appliance that goes in a cutout without a width is still an error.
The importer skips `no width` for every category but that one.

---

## D10 · The quote is derived, never stored

**Decided:** 2026-09-06 (M2 wrap-up).

The quote sheet is built from the same state the scene is showing, at the moment
it is opened. There is no separate quote document that can be saved, edited or
left behind: **a quote can never describe a package the customer did not see.**

Two forms over that one document, because they answer different questions — a
plain-text summary for a person, JSON for a system, with every id, rough-in and
rule id in it. Both come out of `buildQuote()`, so they cannot disagree.

**What it forbids:** editing a line on the quote without changing the selection
behind it; a "saved quote" that outlives the configuration it came from; a
summary assembled separately from the JSON.

**Unknown is not zero.** An unpriced model is left out of the subtotal and the
count says how many were priced; an unpublished lead time omits the line rather
than promising "0 weeks". This applies wherever the app states a package fact —
the right-hand panel follows the same rule.

**Machine translation is labelled.** `zh.json` carries `_translationStatus:
"machine"` and the top bar shows an `MT` chip while it is active. The file and
the UI state are marked rather than every string, so the interface stays
readable; a coverage test fails if the two locales drift apart or a placeholder
set stops matching.

**Reviewed copy is locked to the words that were reviewed.** *(Round 70, Leo.)*
`src/i18n/reviewed.json` lists the lines Leo has read and approved — the key
**and the text as he approved it**, per language — and `reviewed.test.ts` fails
unless `en.json` and `zh.json` say exactly that. A list of keys alone would stay
green when somebody later edited an approved sentence; with the text in it, the
edit turns red and the line has to be read again before it goes out. Locking
"the wording at the time" is the point here, not the accident it is in other
tests: what is held is the wording that was reviewed. The file stays marked
machine-translated as a whole; a listed key is the exception. The first entries
are the makeup-air line in both languages (D6, round 66).

**Approved is not one thing, so the list says which.** *(Round 70, Leo.)* Each
entry carries an `approval`: **`written`** is Leo's own wording — the makeup-air
line, which he wrote — and **`read`** is copy generated to his template that he
then went through line by line, which is the round-70 rough-in vocabulary: the
kinds of connection, the boxes, the measurement phrases, the line that composes
them and the left-and-right note. Both are approved and both are locked; a
person reading the list later should be able to tell which they are looking at
without asking.

**A line for the customer says what is, not what we changed.** *(Leo, round
71.)* The reader has never seen the previous version, so a sentence written as
a change tells them about our work instead of about their kitchen. Round 71's
Chinese said 该接点**改到**机器背后 — "moved to", which implies it used to be
somewhere else — where the English says only "goes behind the appliance". It
now says 设在. **Do not use 改到, 移到, 更新为 or their English equivalents in
copy a customer reads**; the install history belongs in this file and in the
commits. This is the same fault as round 65's makeup-air line in a different
guise: the Chinese saying more than the English.

⚠️ **Three kinds of connection are named in English on the Chinese page, and
it is not a missed translation.** *(Leo, round 70, from site.)* "air gap",
"anti-tip" and "service channel" stay English in `zh.json`. Installers here say
them in English, and a customer showing the Chinese quote to one has to be able
to point at the same words. Every other kind — 电源, 进水, 排水, 燃气, 排风管 —
is Chinese. `roughInChinese.test.ts` takes exactly those three out before it
checks that no Chinese rough-in line carries a Latin letter, so the exception
cannot quietly widen. **Do not "fix" them.**

---

## D11 · The cabinet layout rules

**Decided:** 2026-09-06 (M3), Leo's trade rules.

These are not preferences. A kitchen that breaks them is wrong on site, so the
room, every layout template and the M3-3 generator are all held to them, and
each one has a test with a case that breaks it.

1. **A tall cabinet goes at the end of a run, never at a corner.** A tower in the
   middle of a run cuts the countertop in two; a tower at a corner blocks the
   corner cabinet's door.
2. **The corner is a corner cabinet** — lazy susan or blind corner — and carries
   nothing with a door of its own. Two doors meeting at an inside corner foul
   each other.
3. **The countertop runs unbroken from the corner to the tall cabinet.** In the
   run model that means the segments tile the run: no gaps, no overlaps. The
   range is the one thing that sits *in* the counter rather than under it.
4. **A cooking surface has counter on both sides: 15" on one and 12" on the
   other, the wide side toward the sink**, and the hood over it is at least as
   wide and centred on it. Twelve inches is where you put a hot pan down;
   fifteen is the side the pan goes on to the sink. *(Leo, confirmed round 19;
   the figures are `rangeLanding` in `data/rules.json`.)* The rule is stated for
   the two places a cooking surface can be, so moving one onto an island is not
   a new rule:
   - **Against a wall**, the two landings are along the run. Where an oven
     tower stands on one side (rule 12), that side is the tower's clearance
     instead, and the other side is the 15".
   - **On an island**, the two landings are along the island's length, the same
     15" and 12", measured to the end of the island or to the next opening in
     it. Which end is the wide one, and what an island asks for behind a
     cooktop, are settled with package E, not here.

   *Amended 2026-09-13 (round 36), Leo.* This entry used to say "at least 12"
   of counter each side", which is not what has been built or checked since
   round 19. The checker holds the pair rather than the direction; every
   arrangement the generator builds today puts the wide side toward the sink.
5. **The dishwasher is immediately beside the sink**, and within 36" of it —
   further and you are carrying dripping plates across the floor.
6. **The refrigerator has at least 15" of counter on its door side**, to land
   what you just took out.
7. **An island stands clear of the run and of the room, and its openings face
   the people who use them.** *(Rewritten round 69 for package E; the first
   form was about the microwave drawer and the wine cabinet alone.)* Three
   checks, each failing under its own code:
   - **`d11-7-aisle`** — the aisle between the island and the perimeter run,
     counter edge to counter edge (D20): 42", and 48" in front of a cooktop.
   - **`d11-7-seating`** — behind a seating overhang, 44" to the end of the
     room. An island with no overhang has nobody sitting at it and passes.
   - **`d11-7-facing`** — where the island carries both a microwave drawer and
     a wine cabinet, they face opposite ways: the drawer to the working side,
     the wine cabinet to the seating side (already D5). An island without both
     has nothing to face and passes.

   Until round 69 all three failed as `d11-7`, which said "rule 7" and not
   which check; on package E, whose island has neither machine, only the two
   aisles apply, and both hold.
8. **The corner is continuous.** A lazy susan is a 36" square that belongs to
   both legs: the other leg starts exactly where its square stops, with no gap
   and no overlap, and the wall corner cabinet does the same at its own 24".
   The countertop is one L-shaped slab turning the corner, fabricated and drawn
   as a single piece — the range and the sink are holes cut through it, not
   breaks in it. A box per run leaves the square between the legs to nobody,
   which is what the room used to show.
9. **The dishwasher's power, water and drain all land in the sink base.** This
   is not a separate preference — it is the physical fact rule 5 is a
   consequence of. The dishwasher goes beside the sink because that is the
   cabinet its three connections are in, and the checker reads the model's
   rough-in entry to say so rather than taking it on trust.
   *Amended 2026-09-14 (round 41), Leo: the source is site practice, not a
   drawing.* In a US kitchen a dishwasher's power, water and drain are brought
   to the sink base as standard. The one Bosch page in `docs/reference/` shows
   the hoses and cord fed through the adjacent cabinet without saying that
   cabinet is the sink base. The rule does not change; its source does, and the
   dishwasher's points are drawn dashed accordingly (D21). The checker's code
   called this rule `d11-8` until round 69; it is `d11-9`, as numbered here.

10. **The sink has counter on both sides and stands clear of the corner.** One
    side is at least 24" and the other at least 18"; the dishwasher counts as
    the 24" side, because 24" of surface at counter height is what the rule is
    for. Between the sink base and the corner cabinet there is at least 15" of
    counter, or the corner cabinet's door has nowhere to open. The sink group
    sits centred in what is left of the leg and reads range, landing, sink,
    dishwasher: past the counter you put the pan down on, then the bowl, then
    the machine you load from it. The figures are Leo's to change and live
    in `LAYOUT_LIMITS` in `roomShell.ts`, where the generator lays a run out to
    them and `checkLayout` holds it to them.

11. **A refrigerator is surrounded by what it is sold as.** A built-in gets a
    finished panel each side and a cabinet over it; a freestanding one gets
    counter-deep panels so its doors and handles stand proud of them, and a
    cabinet sitting on its own top rather than a bridge. Against a return wall
    it takes 3-1/2" of filler, or the door will not open ninety degrees and the
    drawers will not come out.
12. **A cooking surface with an oven tower beside it keeps open counter between
    them.** Five inches is the machine's own clearance to a combustible
    surface; eighteen is what the stretch is built at, because it is the
    landing a pan comes off the burner onto and because five inches of gap
    makes the tower crowd the cooking. The tower's own side is a 3/4" finished
    end panel from the floor to its top, and the wall's spare inches go to
    these landings before they go anywhere else. A wall that cannot pay for
    eighteen builds them narrower, three inches at a time, together, and never
    under six.
13. **Nothing hangs in front of a window.** The bank of wall cabinets breaks at
    the opening and is finished as an end each side of it; a tall unit or a
    hood housing in front of one is a refusal rather than something to draw.
    The sink goes under the window, because that is where people put it and
    where a photograph of a kitchen shows it — within six inches of its middle,
    which is a cabinet step and a half. The sill clears the worktop by at least
    two inches, so the backsplash has somewhere to land and a tap has somewhere
    to stand. Between the casing and the cabinet beside it there are three
    inches of finished panel, the same on both sides, and they come out of the
    bank rather than out of whatever the wall had spare. The wall above the
    opening carries on bare to the top line: no cabinet is hung in the strip
    between a window's head and the ceiling.
14. **A dishwasher that is not beside the sink still gets everything a
    dishwasher needs.** Package D's second dishwasher stands in the bottom of
    the coffee cabinet, so rule 5 does not ask where it is — but its circuit,
    hot water and drain are brought to its own cabinet rather than borrowed
    from the sink base, the checker fails a room where they are missing, and
    the install list says so in as many words. The coffee cabinet itself is a
    tower standing in the middle of a run on purpose: 24" wide, the machine's
    opening 42" off the floor unless somebody moves it, a 3/4" finished board
    at each end and counter past both. It is the second exception to rule 1,
    after the oven beside the cooking surface. It goes on whichever leg
    `coffeeLeg` names, and a leg that will not take it is refused with the bill
    and the other leg offered.
15. **Two machines set into the same run have a board between them: 3/4".**
    *(Leo, round 53.)* A rough opening is a hole in a run, not a cabinet with
    sides of its own, so two of them side by side is two machines with nothing
    between at all — which is what the microwave drawer and the wine cabinet
    were when an island was turned off and they moved onto the refrigerator's
    leg. Measured, the gap between them was 0.0000".
    - **Three-quarters, not an inch and a half.** These two are set into
      openings in one run and share its structure; they are not two free-standing
      cabinets that each need their own side. One standard carcass side is the
      whole of what the job asks for, and 3/4" is the same board a tall unit is
      finished with at each end.
    - **Ordered as a `panel`**, which since round 50 records `face: "strip"` and
      is drawn flush with the door faces. **A divider in a run is meant to be
      seen** — which is the plainest difference from the column kit below.
    - ⚠️ **Its own constant**, `RUN_DIVIDER` in `layoutTemplate.ts`, **not
      `LAYOUT_LIMITS.towerSpacer.panelIn`.** That figure is also 3/4" and is the
      side of an oven tower. The two agree today by coincidence of what a board
      is milled at, and **changing one is not a reason to change the other**;
      reusing either for the other's job ties two decisions together that are
      made separately. The constant says so where it is defined.
    - **When it bites.** Only when the pair is actually placed, which is when
      the refrigerator's leg reaches the bill: 159" before this rule, **159-3/4"
      after**. Below that both machines are left out rather than the room being
      refused, which is D11's existing and intended behaviour and is not changed
      here.
    - **What it costs: nothing, with one exception worth naming.** D18's
      auto-lengthening never fires for this — turning the island off does not
      refuse, it omits — and the wall slider steps 6", so a room dragged up from
      144" lands on 162" either way. ⚠️ **The exception is a room set to exactly
      159" or 160" by URL**: it flips from "both machines" to "both omitted",
      and it is the whole pair at once, not one of them. Leo, round 53:
      acceptable.

**What Thermador asks between two column machines is a different question, and
it is not this rule.** *(Leo, round 53. Two cases, not to be mixed.)*

- **(a) Columns standing hard against each other, as a bank.**
  - cold beside cold: **nothing is needed** — no heater kit on the current
    models, and what you see is two metal fronts side by side with no cabinet
    door between them. This is what `COLUMN_SPACER`'s 5/8" kit is, and it is
    enough.
  - hot beside cold: **at least 1-3/16" (30 mm) clear between the two
    machines.**
- **(b) Two machines set into the same run** — rule 15 above, a 3/4" board,
  and it has nothing to do with whether either of them is hot.

⚠️ **The 1-3/16" is recorded and deliberately not implemented.** Nothing
triggers it today: package D's bank is freezer + refrigerator + wine and
package E's is an 18" freezer + a 30" refrigerator, so every column in the
catalogue's banks refrigerates and the 5/8" kit is the right part for all of
them. It would first matter the day somebody puts an oven or a steam column
into a bank. **Do not implement it now, and do not move D's or E's columns
because of it.**

⚠️ **And it does not compare with 5/8" directly.** The 1-3/16" is *clear space
between the two machines*; the 5/8" is *the thickness of a divider*. They
measure different things, and reading "1-3/16 > 5/8, so the kit is too thin" is
reading two different quantities off one number line.

⚠️ **Source: Leo, from a Thermador installation drawing. The drawing was not in
the session where this was written down and has not been read here.** It is
Leo's figure with a drawing behind it, which is a stronger footing than most —
but before anything is built on it, the drawing itself goes into
`docs/reference/` and this note says which sheet and which dimension.

**A window is a fact of the building, not a fitting.** It is a layout
parameter — which wall, where along it, how wide, how high, how far off the
floor — and the room is laid out around it rather than the other way round.
The default has no position at all: it is "over the sink", and it follows the
sink to whichever leg the sink is on. That is what a customer means by the
phrase, and it is why moving the sink to the other wall moves the window with
it rather than leaving a hole behind a run of cabinets. A window that does name
a place pulls the sink toward it instead, three inches at a time, off one
landing and onto the other; what the run will not move that far is a refusal
with the arithmetic.

**And the window itself moves, to keep the two sides even.** Three inches of
scribe each side of the casing is easy to state and impossible to guarantee by
arithmetic alone: the wall each side of an opening is whatever the run leaves,
and two banks of different widths finish with different scribes — three inches
on one side and five on the other, which is the first thing anybody sees. So
the opening is centred in the stretch of wall it is in, as near that centre as
the six inches the sink may be from the glass allow, and two banks of the same
width are then built of the same boxes and finish the same way. Where no
position within those six inches does it, the room is refused with the
arithmetic and the way out is a narrower window.

*Amended round 63: the six inches between the sink and its window are judged
in one place,* `sinkFromWindow` in `windows.ts`, which placing the window and
refusing the room both ask. They used to be two checks with two tolerances,
and a window placed at six inches was refused for being over six: package B
with a lazy susan at left walls of 155-7/8", 158-7/8" … 176-7/8", one in every
three inches, and every eighth either side of each built (D17, round 63).

*Amended 2026-09-17 (round 60): the window moves an eighth of an inch at a
time, not a quarter.* The two gaps are held to within an eighth of each other,
and a slide moves their difference by twice the step, so a quarter-inch step
could never finish a wall that started the difference at an odd number of
quarters: package A in D's room, with D's 178-7/8" left wall held, was refused
at every back wall from 216" to 232" ending in 1/4 or 3/4 and built at every
whole and half inch, and narrowing the window from 36" to 30" did not help.
The step is now the tolerance (`fitWindow`). **What it changed**, over 3,200
rooms — each package's own room, six arrangements across a sweep of both walls,
and an eighth-inch sweep of each wall:
- **208 rooms that were refused now build**, all with the two gaps exactly equal
  (A 64, B 80, C 64, D none).
- **172 rooms that built already have their window an eighth of an inch
  over** (A 53, B 66, C 53, D none), every one on a wall ending in an odd
  eighth. The two gaps are an eighth apart before and after, within the
  tolerance either way; the new place is simply the one the search, nearest
  the middle first, now reaches first.
- **Nothing on a whole or half inch moved, and none of the four packages' own
  rooms did.** A, C and D's windows are in the back wall; B's is in the left,
  where its sink is.
- Package D was refused in none of these rooms and nothing of D's moved, which
  is why switching to D always worked and switching away from its room did not
  (D18, round 60). Why D's layout escapes the fault was not looked into.

**Rule 12, extended 2026-09-12 (round 30), Leo: a group of columns.** Where a
package stands its refrigeration as separate columns, they are one group at the
end of one leg and nothing is put between them. Left to right as you face them
it is freezer, refrigerator, wine — 24", 30", 24" — whichever leg the group is
on, which means the run's own order is reversed on the left wall, where the
corner is on your right. Each pair is joined by Thermador's COMBIKIT10, 5/8"
between the cases, hidden behind doors that close over it; each end of the group
is a 3/4" finished board from the floor to the top. So the group is
24 + 5/8 + 30 + 5/8 + 24 + 3/4 + 3/4 = 80-3/4", every cutout 84" high and 25"
deep, one tall unit to the cabinetmaker. The doors are steel and stand on each
machine's own grille, at its drawing's figure and unscaled; what is lined up is
the bottom of the doors, not the grilles. The steam oven beside the cooking
surface is held to the rest of rule 12 exactly as the combination oven is. It has
no microwave handle to hang it from.

**Amended 2026-09-12 (round 31), Leo: the steam oven stands on a toe kick and
one drawer.** The round-30 figure was 18", worked backwards from a 40" lower
handle; that reasoning belongs to a combination oven's microwave and this
machine has none, and 18" left 14" of front under it — a second drawer or a
door nobody uses. So under the opening there is the run's 4" toe kick and one
8" drawer, and nothing else. Leo asked for an 8"-10" drawer and a 12"-14" sill;
12" is the only figure in that band on D13's 3" step, so the sill is 12", the
lower handle lands at 34", and the door over the opening is 36-5/8" to the top
of the 96" tower. *(Leo's call, not a drawing: there is no PODS302B installation
sheet in `docs/reference/`, so the machine's own allowed sill range has not been
checked against 12".)* Every tower whose opening is off the floor now stands its
drawer on the toe kick the same way, which includes package B's combination
oven.

**Amended 2026-09-13 (round 32), Leo, from site practice: a hung oven breathes
through the top of its opening, at the back.** Not through a grille in the
drawer or the toe kick under it: that is on the front of the tower and is the
first thing anybody sees of it. The shelf the bridge cabinet stands on — the top
of the opening — is cut through along its back edge instead, hard against the
back of the opening, where it is behind the machine and under the cabinet and
cannot be seen from the room. It is most of the opening's width and 2"-3" deep;
it is built at 3", with a 3/4" board left each side so the shelf still bears on
the carcass, which makes it 28-1/2" x 3" in a 30" opening. The junction box is
where the machine's own sheet puts it, above or beside the opening (MEM301WS;
there is no PODS302B sheet, see above). It is drawn in the install view with its
width figured, and it is a line on the install list. It applies to every tall
unit whose opening starts above the floor with no machine under it — B's
combination oven and D's steam oven by one rule — and not to a refrigerator
column or the coffee cabinet. *(Leo's figures, not a drawing: neither sheet in
`docs/reference/` gives a vent size.)*

**Amended 2026-09-13 (round 36), Leo: a hung oven is a standard install, and
its front is in the plane of the doors.** The machine was drawn back inside its
opening, its door skin two inches behind the doors of the tower round it. A
standard install is not that: the machine's trim is wider and taller than the
cutout, laps over the cabinet round it, and finishes in the plane of the doors.
So the front of the door skin is set at the front of the tower's doors, a
sixteenth in front of them so the two faces do not share a plane, and the
handle stands its own figure further out. The trim's border is each sheet's
overlap: MEM301WS 1/2" at the top, 9/16" each side, nothing at the bottom, with
a 2-3/8" handle; PODS302B 3/4"-1-1/2" at the top — 1-1/2" in package D's
47-3/8" cutout — 9/16" each side, nothing at the bottom, with a 2-5/8" handle.
Behind the trim, what goes into the hole is the machine less those overlaps.
The figures are in
`src/data/ovenTrim.ts`; a model with no entry there keeps the old placement
rather than borrowing another machine's. *(Both from the manufacturer's sheets,
now `docs/reference/mem301ws-spec.pdf` and `pods302b-spec.pdf`. The PODS302B
sheet also puts its standard sill at 4-3/4"-18-3/4", which takes round 31's
12"; it still gives no vent size.)* Round 32's vent was checked at the same
time and is where that amendment says: in the shelf over the opening, at the
back, drawn only in the install view, with nothing named a vent on or under
either tower.

**Amended 2026-09-13 (round 37), Leo: the cabinet over a hung oven has an open
back and stands off the wall.** The vent in the shelf lets the machine's air
out of the opening; this is where it goes next. The box directly over the
oven has no back panel and does not touch the wall. Its front stays in the
plane of the tower, so it is shallower by what it stands off, and the 12"
box stacked on it (D19) stands off with it, so the gap behind runs up to the
scribe at the ceiling. Two parts of this are to confirm:
- **The stand-off figure is Leo's to give from site.** Until then it is 3",
  the depth of the vent under it, so the gap is directly over the hole
  (`TOWER_VENT.bridgeStandOffIn`). The install list states the figure and
  says it is to be confirmed.
- **The stack standing off with the bridge is this round's reading, not
  Leo's words.** He named the one box over the oven. A stack against the wall
  would close the top of that gap at 96", so it follows the box under it.

It applies to the same towers as the vent: B's combination oven and D's steam
oven. Refrigerator columns and the coffee cabinet stay against the wall.

**Amended 2026-09-13 (round 38), Leo: a steam oven's air leaves through a
grille at the top of the column.** The stack standing off with the bridge is
confirmed. The air goes up the gap behind the two boxes and leaves through a
louvre in the door of the stacked box, just under the crown. The boxes keep
their heights and line up with everything beside them; only that one door is
cut short, and the strip it gives up is the grille, in the door's own finish,
so the elevation shows one door in two parts.
- **Keyed on the machine, not on the tower.** A steam oven gets a grille; a
  combination oven in the same tower does not. So D's PODS302B has one, B's
  MEM301WS does not, and package E's 30" combination oven will not either
  without a change to the rule. The import reads "steam" out of the Appliance
  Type (`Steam Oven`, `Steam Double Oven`, `Steam Combo Oven`) and
  `isSteamOven` is what the joinery asks.
- **6" x 28" is worked back from an area, not read off a drawing.** The
  PODS302B sheet (`docs/reference/pods302b-spec.pdf`) states no ventilation
  requirement for the cabinet: cutout, sill, trim and junction box, and nothing
  else. `OVEN_GRILLE` in `towerVent.ts`.
- **This is Leo's site practice, not a drawing** — the open back, the stand-off,
  the stack following it and the grille alike.
- **Still open.** The stand-off figure has not been given, so it is still 3".
  And with the grille only on a steam oven, B's tower has the open back and
  the stand-off but no way out at the top. Whether the open back and stand-off
  should follow the same rule — (a) only over a steam oven, B back to a solid
  back against the wall — or stay on every hung oven with B's outlet found some
  other way — (b) — is Leo's to choose. Until then the code does what round 37
  built: both on every hung oven.

**Amended 2026-09-13 (round 39), Leo: one condition decides all three.** Leo
chose (a). A tower holding a steam oven gets the open backs, the stand-off and
the grille in the stacked box's door. Any other tower gets solid backs against
the wall and no grille. So B's combination oven is back to a solid back
against the wall.
- **B is a decision, not an oversight.** The MEM301WS manual and sheet in
  `docs/reference/` state no requirement for space behind the cabinet over it.
  No written requirement means it is not done.
- **The stand-off is 3".** That is Leo's figure from site
  (`TOWER_VENT.bridgeStandOffIn`), not an inference and not a drawing.
- **All of it is site practice**, not a manufacturer's drawing: the open
  backs, the stand-off and the grille.
- **It follows the machine.** The cabinets carry which oven they stand over;
  whether they stand off is decided from the machine in that slot, so swapping
  D's steam oven for a combination oven puts the backs against the wall and
  takes the grille away.

**Scheme 01 as laid out.** Left wall, from the far end back to the corner:
refrigerator tower, 15" landing, corner cabinet. Back wall, from the corner
out: 18" counter, range with its hood, 18" counter, sink, dishwasher, counter to
the open end.

**The run model.** `room.ts` describes each run as ordered segments from the
corner outward — `corner`, `counter`, `appliance`, `tall`, `fixture` — and
`cabinets.ts` draws whatever it is given. That is the shape M3-3's generator
produces, so the generator and the hand-written Scheme 01 are checked by the
same code (`checkLayout`), which returns what is wrong rather than throwing:
a template that cannot be built has to say why.

**A sink is a fixture, not an appliance.** It takes a cabinet segment and needs
supply and drain roughed in, so the layout rules and the install view both have
to know about it — but it has no brand, no price and no alternatives. Putting it
in the appliance catalogue would give it all three and put it on a quote.

**The stretch after the corner is not a rule of its own.** An early version of
the generator always left 12" of counter between the corner cabinet and
whatever came next. Nothing asks for that: rule 1 keeps the tower off the
corner through the tower's own 15" landing, and rule 10 keeps the sink off it
through its 15". A drawer base beside a lazy susan is ordinary. So that stretch
is wanted rather than needed, and it is the first thing dropped when a wall is
short — which is what a designer drops first too.

**Rule 7 is about an island.** Two openings coming in from opposite faces with
an aisle to the perimeter is a fact about an island; a kitchen whose parameters
ask for none has neither a seating side nor an aisle, and its microwave drawer
and wine cabinet are two base cabinets in a run. The checker skips the rule
rather than failing it.

**And when there is no island, those two are split rather than stacked.** Both
onto whichever leg is quieter is 48" of opening in one place, which is what made
a blind corner refuse a room that is otherwise fine. The microwave drawer goes
in the base beside the range on the landing side: it is a drawer, so there is
countertop over it, and 24" of surface at counter height is the landing rule 4
asks for — the same argument rule 10 already makes about the dishwasher counting
as the sink's wide side. So it costs the run only what the landing was taking
anyway. The wine cabinet finishes the refrigerator's leg, the last base cabinet
before the tower's landing, because rule 1 keeps the tower itself last.

A refusal is what happens when *that* will not fit, not before it is tried. And
where the two went goes on the install list: it is not obvious from the drawing,
and somebody pricing the run needs to know.

**The wall cabinets meet the canopy.** The bank each side of a hood stops
exactly at its flank, and the cabinet against it is a cabinet rather than a
filler. A gap beside a canopy is one nobody can get a cloth into and a foot of
shelf nobody has, and the scribe a run needs belongs against a wall, where
nothing has to reach past it. The bridge over the canopy is the canopy's own
width.

**Rule 11: a freestanding refrigerator is surrounded, differently.** The
enclosure round a built-in wraps its doors: panels as deep as the machine, and a
bridge over the top from the head of the opening. A freestanding counter-depth
machine gets a panel each side that is only counter deep, so its doors and their
handles stand proud of the cabinet line rather than being buried in it, and a
cabinet over it that starts an inch above its own top rather than at the head of
an opening. No bridge, and no panel wrapping a door.

The depths are the point, and they are what tells the two apart from across the
room. A T36FT820NS is a 24" body held 1" off the wall by its own spacers, 28-3/4"
with the doors shut and 31-7/16" with the handles on: 3-3/4" of door and 2-3/4"
of handle in front of a 24" run. Drawing it flush is drawing the other machine.

And a door opens through more than the machine's own width. Beside a standard
24" cabinet that costs nothing — the door sweeps past the cabinet's front, and
the manufacturer's eighth of an inch is the whole of it. Beside a return wall it
costs three and a half inches, or the door fouls the wall before ninety degrees
and the drawers will not come out. `fridgeEndAbuts` says which is there; the
wall case puts a filler in the run, prints the figure on the drawing whatever the
render mode, and puts a line on the install list. It is not an annotation about
the room: it is the reason three and a half inches of that wall have no cabinet
on them, and a reader who cannot see it is looking at a gap somebody forgot to
fill.

**Amended 2026-09-13 (round 32), Leo: a group of columns meets the wall as one
unit.** Package D's refrigerator is the middle column of three, and the return
wall was placed beside the refrigerator's own opening — between two columns. The
wall is past the whole group: the group's outer 3/4" board stays, the 3-1/2"
full-height filler stands between that board and the wall, and nothing inside
the group is ever a wall or a filler. A single refrigerator is unchanged — its
filler is part of its own surround and it ends its run — and so is a bank the
template orders itself, which gives its 3" end panel up to the clearance. The
wall and the clearance figure are both found from the filler that ends the
refrigerator's run, not from the refrigerator's segment.

Rules 1 and 6 were checked for the same mistake at the same time. Rule 1 was
already right: it asks whether counter follows a tall segment, and every part of
a group — boards, kits, the clearance filler — is tall, so the group is one tall
unit; its exceptions are keyed to `beside` on a package slot, which no column
has. Rule 6 already measured the landing before the whole group, but did not
check that the refrigerator was in the tall stretch it measured at, so a board
past a freestanding machine would have read as no landing. It now only measures
at the group when the refrigerator is part of it. Both have a test that fails the
old way. Rule 6 still takes the better of the machine's two sides rather than
its door side specifically: no model in the catalogue records its hinge.

**A run does not always divide by the module step.** Three and a half inches of
door clearance is not a multiple of three, and what goes in the remainder is a
scribe: a strip of finished panel, cut on site, against the wall. So the width
rules are checked on a segment's boxes rather than on the stretch, and a bank of
wall cabinets is as long as it is rather than as long as it rounds to. Rounding
it away is how a bank came out half an inch longer than the wall it was on.

**And a wall is drawn as a wall.** Where the layout says there is a return wall
past the refrigerator, one is built — in the wall's own colour, at the wall's own
height, returning 30" into the room. Three and a half inches of empty run at the
end of a leg reads as a cabinet somebody forgot; the same three and a half
inches against a wall reads as a door that has to open.

**A wall that will not fit shrinks; it never drops an element.** Every element
on a run has a hard minimum — the appliances and the corner box are fixed, the
landings have theirs, and what finishes a run has its own — and the wall's
minimum is their sum. Below that the slider clamps and the bill is printed;
below what the package itself needs, the layout is refused. Nothing is ever
removed to make a wall add up.

That is not a style point. The back wall's minimum used to be reached by
deleting the cabinet after the dishwasher, which left the dishwasher hard
against the right wall with nothing for its door to swing past — while the
refrigerator on the other leg kept a filler for exactly that. One rule, applied
to one machine and not the other. So a run now always finishes on something
that is not an appliance: a filler against a wall, a cabinet in the open, a
finished panel beside a tower.

The figures are in `data/rules.json` under `layout`, beside the install rules,
because a merchant changes a landing and a programmer does not. `shrinkOrder`
says which stretch gives up its slack first as a wall gets shorter, and surplus
is handed out in the reverse of it — so a stretch early in that order never
carries more slack than one late in it.

**One datum for what sticks out.** A protrusion is measured from the cabinet
face, everywhere a customer can see it — the front of the run is the line their
eye follows along a kitchen and the thing a machine visibly stands out from. The
carcass front and the published cutout are draughtsman's datums an inch apart,
and printing whichever the calling code had to hand is how one refrigerator got
three figures for the same fact: 5-3/4" past the cabinets, 4-3/4" from its own
back, 3-3/4" past the carcass line. `protrusionDatum` in `data/rules.json`
names it. And what is measured is the machine rather than the hole it needs — a
cutout depth includes service space behind, so measuring against it reported a
built-in as standing proud of cabinets it is defined by finishing flush with.

**Amended 2026-09-08 (round 19), Leo: the datum includes the rear spacers.**
A freestanding refrigerator is held off the plaster by an inch of its own
spacers, so its 28-3/4" of machine puts the door face 29-3/4" from the wall and
5-3/4" proud of a 24" panel. The spacers are behind the machine and they are
what decides where its doors end up; the drawing is built on where the machine
has to stand, not on where its back is.

**What this forbids:** placing an appliance by eye; a layout template that
"mostly" follows the rules; hard-coded cabinet boxes that no rule can be run
against; adding the sink, the pot filler or the ice-maker line to
`appliances.json`; a refusal that says no without saying what is in the way;
drawing a freestanding machine flush with the cabinets beside it; leaving a
clearance against a wall that is not there.


---

## D12 · This is a tool for explaining a kitchen, not for selling one

**Decided:** 2026-09-06 (M3), Leo.

The product is what a salesperson stands in front of a customer with, to explain
**the layout and what installing it actually involves**. It is not a quoting
tool that happens to have a 3D view.

**What follows from it.** The scene gets the screen: at least 80% of the
viewport, with both side columns collapsible and the right one closed by
default. The package total, the price range and Request Quote come off the main
interface; the quote lives on its own page behind one entry in the top bar.
Prices still exist — they are on the spec card and on that page — but they are
not what the room is about.

**What it forbids:** a running total on the main screen; a price on a pin; any
call to action that treats the room as a checkout. And, from §2.2 of the brief:
no free-form cabinet placement. Appliances slide within their own cabinet
segment to a legal position and no further — the moment a customer can drag a
cabinet anywhere, this is a design tool and every rule in D11 becomes advisory.

**Amended 2026-09-12 (round 31), Leo: the page opens with Configuration open
and the appliance list closed.** That reverses the default above. Configuration
is what gets used in front of a customer; the list is one click away. On a phone
both still open closed, behind the sheet. Whichever way somebody leaves the two
rails, they stay that way until the tab is closed (sessionStorage, not
localStorage: the next customer gets the default). The list rail is a fixed
width now rather than a share of the screen, and never scrolls sideways. At
1440px wide, the scene now gets about 79% of the screen when the page opens,
just under the 80% above.

**Amended 2026-09-13 (round 32), Leo: the scene gets at least 78% of the
viewport, not 80%.** Configuration open by default is the round-31 decision,
and 79.5% at 1440px is what it costs. The figure moves; the layout does not.

---

## D13 · The dimensions a kitchen is actually built to

**Decided:** 2026-09-06 (M3, round 6), Leo, with the Thermador clearance and
ducting sheets (see `docs/reference/`).

D11 says where things go relative to each other. This says what size they are.
Both are checked by `checkLayout`, and the M3-3 generator has to satisfy both.

**Cabinets.**

- Base: 24" deep, a 34.5" box under a 1.5" top, 36" finished.
- Widths: 12" to 36" in 3" increments.
- Wall: 12" deep, 30 / 36 / 42" tall, hung 18" over the counter — so 54" to the
  underside.
- Tall: 24" deep, 84 / 90 / 96".
- Corner: a 36" lazy susan, or a 42" blind corner.
- An L wants a short leg of at least 8ft and a long leg of 10–14ft, each
  measured from the inside corner outward. A tall cabinet is finished off with a
  24–48" return rather than left as a cliff at the end of a wall.
  **Amended 2026-09-07 (round 19), Leo: the long leg's cap is 14ft, not 12.**
  Twelve feet was what stopped a kitchen with no island from ever carrying the
  microwave drawer and the wine cabinet on the refrigerator's leg — the pair
  costs 60" of run, since each is an enclosure with a finished panel each side.
  **Amended again 2026-09-08 (round 25), Leo: the cap is 180", and the wall
  slider goes to 204".** Package B's back wall carries the sink, the
  dishwasher, the rangetop and the oven tower, and has to keep 18" of landing
  each side of the burners; at 168" the landings came out at 6". Supersedes
  the round-19 figure above (144" to 168"). `CABINET_STANDARDS.legIn.longMax`
  in `roomShell.ts` has carried 180 since then; this entry is the record that
  was missing. *(Added round 31 — the decision is round 25's, the write-up is
  late.)*
  **Amended a third time 2026-09-13 (round 35), Leo: the wall slider goes to
  240", and the single-run cap to 216".** Package D's refrigerator columns on
  the back wall need 207-1/2" and its coffee cabinet there 224-1/4", and at a
  204" slider both were refused rather than grown into (D18). A seventeen-to-
  twenty-foot wall is an ordinary kitchen; 204" was set early without one in
  mind. The slider's top is the run cap plus the corner's 24" depth, so the cap
  moves with it: 180" to 216". Supersedes round 25's 180" run and 204" slider.
  *(Leo confirmed both figures on 2026-09-13, round 36.)*
- **What finishes a run.** Against a wall, a filler at least 3" wide: a door
  needs somewhere to swing past, and the refrigerator's own clearance is the
  same rule. In the open, a whole cabinet with a finished end panel closing its
  carcass off — a construction rather than a figure, so its minimum is the
  narrowest box anybody stocks plus the panel's own thickness. Never an
  appliance, either way.
- **The order a wall gives ground in** as it gets shorter, first to last:
  the corner-to-range stretch, then the landings to their own minimums, then
  the range-to-sink stretch. Surplus is handed out in the reverse. Nothing is
  ever deleted to make a wall fit; a wall too short for every element at its
  minimum is refused with the bill.

**Ventilation**, from the clearance sheet.

- Canopy 18" high, its underside 30" (the gas minimum) to 40" above the cooking
  surface, default 30".
- 36" counter + 30" + 18" = 84", which is where the run of wall cabinets picks
  up again, so their tops line up with the canopy's.
- Duct collar 8-3/8" above the canopy top, with the electrical zone behind it.
- Canopy at least as wide as the range, and centred on it.
- **The clearance is measured from the cooking surface**, which is the range's
  own top rather than the counter beside it: a slide-in range's grates stand
  proud of the counter, and hanging the hood off the counter spends three
  quarters of an inch of a clearance that has no slack in it. The hood slot
  records the surface the wall was drilled for; specifying a range that differs
  from it is what the clearance rule catches.
- **A run may finish up to 6" short of the ceiling.** With the canopy at
  84-3/4" and a 96" ceiling there are 11-1/4" for the bridge above it, and
  nobody lists an 11" bridge — so it is ordered to the whole inch and the
  remainder is the closing scribe. Anything more than 6" stops reading as a
  scribe and starts reading as a mistake.

**Ducting**, from the ducting sheet — five installations, not five drawings of
one:

1. Up through the roof, or horizontally out through an exterior wall.
2. **Integral**: the blower sits in the canopy.
3. **Remote**: the blower is at the termination, on the roof or the wall.
4. **Inline**: the blower is in the duct run, in the ceiling or the attic.
5. A back-draft damper at the transition, whichever of these it is.

The install view draws whichever one the specified blower implies, so choosing
an inline blower moves the box up into the ceiling in front of the customer.

**Blower compatibility is data, not a heuristic.** A hood carries
`compatibleBlowers[]` from the manufacturer's chart and the picker offers only
those. Pairing by brand was a guess that happens to work until a Zephyr blower
turns up beside a Thermador hood — and it is wrong within a brand too, since
VTN1DZ fits the 30" Thermador hood and not the 36". A hood nobody has checked
offers everything in stock and says the list is unverified, rather than
narrowing to nothing.

**What this forbids:** a cabinet width off the 3" grid; a canopy hung by eye; a
wall cabinet that stops short of the canopy's top; offering a blower because it
shares a badge; putting any of these numbers in the geometry instead of in
`CABINET_STANDARDS`, where the checker can read them.


---

## D15 · A kitchen is finished by the run, not by the shelf

**Decided:** 2026-09-07 (M3-5, round 13), Leo.

A second colour in a kitchen goes on a whole stretch of cabinetry — the island
in oak, the back wall in ink — and takes the wall cabinets, the base cabinets
and the towers on that run with it. It does not go on "the uppers".

**Why.** Splitting a run at counter height is a different decision and mostly a
dated one: it reads as two kitchens meeting rather than one kitchen with a
feature. What a designer actually says is "the island is different", and the
whole island is different, top to bottom.

**What follows from it.** Every cabinet box carries the run it belongs to, so
the question the interface asks is "which run" rather than "which height". The
finish picker offers a primary palette and a separate accent palette — a
separate one, because an accent chosen from the five you just chose the main
colour from is the same kitchen with a mistake in it — and no accent run at
all is the default, because one colour is what "the cabinets are green" means.

**What it forbids:** a finish control that splits a run horizontally; an accent
that only reaches part of a run; putting either palette on the quote. Colour is
how the room is looked at, not what is bought (D12).

**Amended 2026-09-13 (round 33), Leo: any RAL colour in the table, and deeper
woods.** The five swatches stay as the quick picks for both palettes, and under
each is a RAL number input. A number in `data/ral.json` paints the doors — or
the accent run — exactly that colour; a number the table does not carry says so
and changes nothing, and so does anything that is not a RAL number. The table is
forty codes kitchens are commonly specified in, with the sRGB values from the
detail table of Wikipedia's *List of RAL colours*. RAL publishes no official
sRGB, so these are approximations, and `_meta.provenance` in the file says so.
It is still colour, not product: nothing about it reaches the package or the
quote. The oak on doors and floors is a shade deeper, toward #8B6B47, and the
clay swatch is a deeper walnut brown to match (#6B4E3D) — in round 35 renamed
Walnut / 胡桃 and made a true walnut, #5D4037; later in round 35 replaced by a
deep, cool Burgundy / 酒红, #6E2639, with wood left to the oak swatch and the RAL
input (`?cabinet=clay` and `?cabinet=walnut` both open it). The walls are a
finish too since round 35: warm grey by default (#D6D2CB), a step below the
counters and the pale doors so they do not compete, with mid grey, taupe and
white to choose from under Floor. The backsplash is tile, not wall, and stays. A tile floor is large
format — 24" x 48" by default, 32" x 32" or 48" x 48" — laid third-bond with
1/16" joints; the size is a finish setting under Floor. Marble is warm grey with
ink-dot veining, and quartz stays pale. None of it is a download; every surface
is still drawn on a canvas.

---

## D14 · The layout is a plain sequence, not a derived value

**Registered:** 2026-09-06 (M3-4), before building it.

M3-4 is the Run Composer: a track per leg, filled by hand from a module
palette, with an "auto-fill" that calls the generator. Appliances appear in the
track as `RO` openings. `checkLayout` runs on every edit. Only along a wall,
only from the module list, filling rather than drawing — there is no free
two-dimensional placement, for the reason in D12.

**The constraint that has to hold now, before any of that is built:** what the
generator returns is an ordinary array of ordinary objects. Not a getter, not a
memo keyed to the parameters, not a frozen constant — a list somebody can splice
an item into. The moment the composer exists, the generator stops being the only
author of a layout and becomes the thing that proposes one; if its output were a
derived value, "edit item 3" would have nowhere to write.

**What it forbids:** deriving the segment list lazily from the parameters at
read time; freezing or memoising it in a way that makes an edit meaningless;
any code that assumes the current layout came from the generator rather than
from a person.

## D16 · A package is data, and it is the third half of a slot

**The decision.** Which appliances a kitchen is specified with lives in
`data/packages.json`, and the generator reads its slot list from there rather
than knowing the six appliances by name. A package entry says, per slot: the
category, the appliance's own width, how it installs, whether it is a
full-height unit, and whether the cabinetmaker builds around it.

**Why the slot has three halves now.** `data/slots.json` carries the product
side — the label, the utility rough-ins, the best view — because that does not
change when the model does: a 30" range and a 36" range want gas in the same
place. `room.ts` carries the placement, because where a thing stands is scene
construction. The package carries the size and the joinery, because that is
most of what separates one package from another. Splitting them this way means
a second package is a data file, not a branch.

**The two flags that change the room rather than resize it.**

`enclosure: false` is a full-height appliance standing on its own — a
freestanding refrigerator at the end of a counter. No finished panel either
side, no cabinet bridging over the top, the toe kick stops at it the way it
already stopped at a freestanding range, and no filler panel above it: what is
above it is the room. Its opening is the appliance's own width, where an
enclosed one is the appliance plus a finished panel each side. Charging a
freestanding unit for panels nobody ordered is how a wall comes out 6" short.

`installType: "chimney"` takes the cabinet off the wall above the hood. An
under-cabinet hood is screwed to the underside of one and the duct runs up
inside it, so that box is structural. A chimney hood carries its own flue to
the ceiling, and a cabinet over it would be a cabinet with a stainless duct
through the middle of it. The D13 addendum still holds either way: the banks
each side sit hard against the canopy's flanks.

**What the wall was drilled for is the package's.** D13 says a hood is hung once,
off the cooking surface the installer set it from, not off whichever range is
swapped in later. But which surface *that* is belongs to the package: A is a pro
range cooking at 36-3/4", C is a freestanding one cooking at 36". Three quarters
of an inch is the difference between a chimney that collapses to fit an 8'
ceiling and one that will not.

**Switching packages.** The room is regenerated first, and a package that will
not fit the walls as they stand is refused and does not take — the same bargain
a refused slider makes. A room drawn to one package while the data says another
is a 30" range in a 36" hole.

What was chosen carries across by slot id, because the six slots do not change.
Two things stop a model coming across. It may not fit what the new package
leaves — and that is not only width: a built-in refrigerator is exactly as wide
as package C's opening and is still the wrong machine, because C stands it at
the end of a run with the finished sides it does not have. And it may never
have been chosen: a slot still sitting on the outgoing package's default was
specified by that package, not by the customer, so it gives way to what the
incoming one specifies. Otherwise asking for package C shows you package A's
dishwasher and calls it C.

**What it forbids:** a width, an install type or a piece of joinery written
into the generator; a package that adds an appliance the template has nowhere
to stand (that is a loud failure, not a silent omission); a package switch that
leaves the carcass and the data disagreeing.

## D17 · A push is not a deploy

**Decided:** 2026-09-08 (round 21), Leo, after four failed deploys in a row.

The Pages workflow ran `npm run test:unit` and `npm run build`; the local loop
had drifted to `npx vitest run src/`, which is the same suite minus
`scripts/**` — 853 tests against CI's 1052. A change that gave wall ovens a
slot broke two assertions in the importer's tests, every deploy from `d02cda9`
to `a5750fd` failed in the test step at about 25 seconds, and the link went on
serving the last good build. Four rounds were reported as pushed and green.
The site was a day behind and nothing said so.

**Three things follow, and they are not negotiable.**

1. **Run what CI runs, before pushing.** `npm run test:unit` and `npm run
   build` — the first covers `scripts/**` as well as `src/**`, the second
   type-checks before it bundles. A narrower command is an inner loop, never a
   green light.
2. **Wait for the run.** `gh run watch <id> --exit-status` after the push, and
   the report carries the conclusion and the link. "Pushed" is not a result.
3. **Check the link, not the workflow.** The footer carries the build's commit
   (`__COMMIT__`, from the runner's SHA or from git), so the live page says
   which build it is. A deploy that reports success and a page that reports the
   previous hash is a deploy that did not land.

**How the link is checked, from round 52.** *(Leo.)* The footer is rendered by
the bundle, so fetching the page's HTML and looking for the hash finds nothing —
the check has to be one that can actually be run from a terminal rather than one
that reads as if it were. **Compare the asset filenames the served HTML
references against the ones `npm run build` just produced locally.** Vite names
every chunk by a hash of its contents, so

```
curl -s <site> | grep -o -E 'assets/[A-Za-z0-9._-]+'
```

against `dist/assets/` is the same build or it is not, file by file, and it
answers the question the footer was being asked for: **is the code on the link
the code in front of me.** It is the stronger check of the two — the footer says
which commit the runner *thought* it was building, while the asset hashes are
the bundle itself — and it needs no browser. Read the footer as well when a
browser is already open; neither replaces waiting for the run.

⚠️ **Pin `?quality=high` on both sides of a pixel diff.** *(Round 53.)* The
render tier starts high on a desktop and is **measured from the frame rate**,
so a slower start drops it — and the live site loads over the network while the
local one does not. Round 53 measured the same change three times and got
0.212%, then 13.012%, then 0.212% again; the 13% was every shaded pixel in the
room shifting a level or two, with the thing actually being looked at unchanged
underneath it. Two loads of the *live* page at the same wait differed from each
other by 12.8% for the same reason. `initialQuality` in `useAppStore.ts` takes
`?quality=`, and its own comment says it is there for screenshots. Use it.

⚠️ **Which means every earlier live-against-local diff carried this noise.**
*(Leo, round 53.)* Round 52 reported eight shots at zero pixels changed with
the tier unpinned. **Those zeros are true** — a global wash cannot subtract
itself to nothing, so both sides plainly landed on the same tier — **but they
landed there by luck, not by method.** Read the earlier rounds' figures that
way: a zero still means no change, while a small non-zero one that was
explained away may have been the tier rather than the thing. Pin it from here.

**Read the amplitude before drawing any conclusion.** *(Leo, round 53: this is
the more general of the two, because the next global noise will not be the
quality tier.)* The standard step, whenever a diff comes back bigger than
expected: **bucket the changed pixels by how far each one moved** — 1-2 levels,
3-8, 9-32, over 32 — and only then say what happened. A real change is a few
pixels moved a long way; a tier, a fade, an exposure shift is a great many
pixels moved one or two. In round 53 that one pass turned "13% changed, cause
unknown" into a settled answer, and it would have done the same for any other
whole-frame cause. Do not go looking for the cause first.

**The first real regression the diff caught.** *(Leo, round 55.)* Until round
55 every diff in this project confirmed something already expected — zero where
nothing should move, a change where a change was made. In round 55 the
sight-line fade was extended to the appliances, the unit suite was green, and
of the twenty shots of A to D **one** had changed: package D's fly-in on its
refrigerator, 2.3% of the frame, the freezer column beside it turned to glass.
Nothing else in the process would have seen it — no test covers what a fly-in
looks like, and nobody looks at D's refrigerator fly-in by eye after a change
about an island hood. **It would have shipped.** That is the case for diffing
every round, including the rounds where the answer is expected to be zero.

**Two bugs can hide each other, so a fix is diffed again after it is made.**
*(Leo, round 59.)* The throw in `PinProjector` stopped one frame being drawn
on a switch into D, and that frame happened to be the one in which the shadow
map's single refresh was spent on the room being taken down. With the throw,
the refresh fell on a later frame and the shadows were right; take the throw
away and 641 pixels of stale shadow appeared. Nothing about the shadows had
changed — the first bug had been covering the second. **The reason to look at
the pictures again after fixing something is not only that the fix may break
something; it is that the fix may uncover something that was already broken.**
A fix that removes an error, a skipped frame, an early return or an exception
is exactly the kind that can do it.

**A fallback that behaves strangely: ask first what it was put in to get
round.** *(Leo, round 60.)* Switching from D to A shrank the room from
224-1/4" x 178-7/8" to 147" x 105", smaller than A's own default room. The
shrinking was done by the last fallback in `setActivePackage`, which sizes both
walls to the bare minimum a package's legs need. It looked like a second bug.
It was not: the fallback was added in the round that laid out package D
(2026-09-12), and its comment names the case it was for — "D's 175-1/4" left
wall … B's window will not sit evenly in it". **175-1/4" ends in a quarter**,
and so does 224-1/4". Both refusals were one fault in the window search (D11
rule 13, round 60), and the fallback was a plaster over the first of them. **We
were not fixing two bugs; we were fixing one bug and the plaster put on it.**
The general form: when a fallback, a special case or a retry does something
odd, find what it was written to avoid. That thing may be the real problem, and
it may still be there — here it was, and it had been shrinking rooms and
growing walls by an eighth of an inch (D18, round 60) ever since.

**A number that cannot say exactly why it is that number may be working round
a bug.** *(Leo, round 61.)* One fault in the window search — a quarter-inch
step against an eighth-inch tolerance — passed itself off as **two** settled
decisions and one sentence to a customer, and each of them looked reasonable
on its own:
- the fallback in `setActivePackage` that sizes both walls to a package's
  minimum, written in the round that laid out package D (2026-09-12) to get
  past a 175-1/4" wall, and found to be a plaster in round 60;
- **package D's default left wall of 178-7/8"**, recorded in round 35 as "the
  columns on the back leg need the eighth of an inch", found in round 60 when
  the fix made a test that held it go red, and changed back in round 61;
- and the toast a customer read while it happened: "Left wall lengthened from
  178¾″ to 178⅞″ to fit the refrigerator on that leg" — the figure and the
  reason both invented by the code, and neither true.

**Where a figure cannot be given an exact reason, record that it cannot.** An
eighth of an inch "for the window to sit evenly" reads like a reason and is
not one: nothing says why an eighth, or why that wall. The honest entry would
have been "178-7/8" because 178-3/4" is refused and we do not know what makes
the difference" — which is a question somebody would have pulled at, where a
plausible sentence is one nobody ever reads again. **The explanation outlives
the bug**: this one stood for twenty-six rounds and had a test holding it.

**One rule checked in two places will drift apart — the third time in one
fallback.** *(Leo, round 63.)* The same fallback in `setActivePackage`, three
rounds, three precision faults:
- **round 60**: `fitWindow` slid the window a quarter inch at a time against
  an eighth-inch tolerance, and walls ending in 1/4 or 3/4 were refused;
- **round 61**: package D's default left wall of 178-7/8" was that same fault
  recorded as a design decision;
- **round 63**: whether the sink stands within six inches of its window was
  checked twice — `fitWindow` placed the window at six inches and a
  millionth, `windowRefusals` judged the room at six inches exactly, and a
  six worked in feet and multiplied by twelve came out 6.000...1. Package B
  with a lazy susan refused one left wall in every three inches, and the
  fallback turned those refusals into rooms cut to 214-3/8" x 120".

**The third is the same shape as rounds 45-46**, where switching packages and
the alternatives list judged "does this model go in this slot" with two pieces
of code that disagreed (D20). That time the rule was written down — the next
change joins them rather than adding a third — and it was met again anyway,
in a different part of the code. **The general form: a rule checked in two
places sooner or later disagrees with itself — in its tolerance, its step, or
its rounding — and the disagreement shows up as a refusal nobody can explain.**
So the fix is never to make the two copies agree for now (an `1e-6` added to
the one that lacked it would have done that); it is to have one copy.
`sinkFromWindow` in `windows.ts` is now the only place the six inches are
judged, and both callers ask it.

**Every place this shape has turned up so far** *(Leo, round 66; rounds as the
repository has them)* — one rule, written more than once:

| Found | The rule | Copies | Now | When it bites |
|---|---|---|---|---|
| rounds 45-46 | does this model go in this slot | `suitsPackageSlot` (switching packages) and `offeredFor` + width (the list) | **still two**, recorded in D20 as deliberate for now | **the day a third judgement of the same question is written** — a new place that asks "can this model go here" and writes its own answer instead of calling one of these. Join the two then, rather than adding the third. |
| round 62 | the sink within six inches of its window | `fitWindow` and `windowRefusals`, with different tolerances | one, `sinkFromWindow` (round 63) | — |
| round 65 | makeup air above 400 CFM | the rule's condition, `thresholds.makeupAirCfm`, `needsMakeupAir()`, the importer's flag — only the first read | one, the rule's condition (round 65) | — |
| round 65 | a gas pipe upsized above 65,000 BTU | the `gas-pipe-size` rule's condition and `thresholds.gasPipeUpsizeBTU` — only the first read | **still two**, in Open items | **the day somebody changes the figure** and edits `thresholds`, the copy that is named like the setting: nothing changes on screen, because the rule reads its own. |
| round 70 | which side of its box a rough-in figure is measured from, and which side a neighbouring cabinet is on | the point's position (`resolveRoughIn`) and its sentence (`roughInSentence`), each worked out from the data on its own | one: `resolveRoughIn` decides `sides` through `frame.ts`'s `alongIsToTheRight`, places the point by it, and the sentence reads it (round 70) | **it had bitten, on the live site, both ways.** The drawing took "further along the run" for right, which on the left run is the installer's left: A's refrigerator socket was drawn 6" from the cabinet's right side under a line saying left, and a sink moved to the left leg had all four dishwasher points mirrored. The sentence wrote "from the left side" beside every tower, where B's, D's and E's cabinets stand on the tower's left and the drawing measured from its right. A quote sends an electrician to the wrong side of a cabinet. |
| round 70 | a var whose name ends in `Key` is itself a message key, and fills the placeholder without `Key` | written twice — `useRefusalText` (the checklist) and the toast in `SceneControls` — and **missing** in the spec card and in `buildQuote` | one, `sayWith` in `src/i18n/index.ts`, used by all four (round 70) | **it had bitten, on the live site.** Package A (or B, C, D) with no island and a left wall long enough to take the microwave drawer and the wine cabinet prints "on the {microwaveLeg} leg … the {wineLeg} leg" on the spec card and the quote, while the checklist beside them says "left". Found only because the rough-in words moved onto keys and had to go through all four. |

Round 60's quarter-inch window step is a near relative rather than a member:
one rule, but its search and its judgement worked to different resolutions,
and it is counted with them (the fifth time, as Leo numbers them).

**The sixth, round 70, is the same shape with a fact in place of a
threshold** *(Leo)*. The data records one thing — how far from which side —
and two derivations read it: one placed the point, one wrote its sentence. They
went wrong separately, one on the left run and one beside a tower, and each
looked right on its own. It is held now by `roughInSides.test.ts`, which checks
for every package in every arrangement it builds that the sentence the quote
prints and the point the room draws agree, working out left and right without
asking the code.

**The seventh, the same round, is the convention that says how a line's
words are looked up** *(Leo)*: two copies and two places with none. The
copies agreed; the places without one printed the placeholder.

⚠️ **A script that looked, fooled; the test that replaced it, not.** *(Round
70, Leo.)* The first script written to find the left-and-right fault judged
four of package D's arrangements right — "5 of 9 correct" — because there the
cabinet beside the oven tower is 6" wide and 3" from its left is 3" from its
right. All nine were wrong. The permanent test, `roughInSides.test.ts`, does
not ask how far a point is from a side; it asks which side meets the machine,
and it found all nine. **That is the worth of turning a probe into a test:**
the probe answered the question it was written with, once, on the data it
happened to meet; the test states the rule, and a coincidence in the data
cannot pass it.

Two of the seven are still open. The table is here so that the next one found
is added to it rather than rediscovered.

**An exception written into a test is broken on purpose before it is
trusted.** *(Leo, round 70.)* An exception is the easiest thing in a test to
write too wide, and a test that lets through more than it says still passes.
So whenever one goes in, something the exception must *not* cover is changed
to see the test go red. Round 70: `roughInChinese.test.ts` lets "air gap",
"anti-tip" and "service channel" stay English on the Chinese page; with 电源
changed to "power" it failed in all fifteen of its cases, which is what proves
the hole is only three words wide. The same as the rule above for detectors —
a thing that says "no problem" first shows it can find one — applied to the
part of a test that says "except".

**A whole population is checked by a script, not sampled by eye.** *(Leo,
round 63.)* Round 62 looked at a sample of the 14,135 package switches that are
refused and saw real geometry. After three precision faults in the same code a
sample is not enough, so every one of them was classified automatically: from
each refused switch, the room is stepped an eighth at a time along each wall,
and the refused run it sits in is measured. A run that ends within an inch
both ways, on either wall, is an isolated refusal — the signature of a
precision fault; a longer one is a real limit. **All 14,135 are continuous.**
And the detector was checked before it was believed: run on the code before
the fix, with the fallback taken out so that its rescues show as refusals, it
flagged exactly the nineteen known cases — each a single eighth — and nothing
else. A check that finds nothing only means something once it has been seen to
find what it is for.

*(Leo, round 64, the general form.)* **A detector that says "nothing wrong"
has to be shown catching something known to be wrong first, or it may simply
catch nothing.** It is "a test must be able to fail" applied to the tools that
check the tests. This project has been misled by the opposite more than once
— a sample of three groups out of 14,135 that looked fine, an `it()` that
stopped at its first failing assertion three times — and every one was a
check trusted before it had been seen to fail. Round 64 did it again on
purpose: the comparison that proved deleting the fallback changed nothing was
first run against round 62's code, where it found exactly the nineteen
switches it should.

**Words a customer reads need a source as much as a figure does.** *(Leo,
round 65.)* The project's first rule is that a rule has a source — a drawing,
or Leo's site practice, and which. From the project's first day (2026-09-05) to round
65 a sentence stood on the quote, the install checklist and the hood's spec card, in every package as
it opens, naming a code ("California Title 24") and a certainty ("requires")
that nothing in the repository supports; the only sources, two hood guides,
say "may", give no figure and name no code. **Source checks had only ever
been run on geometry — never on the text put in front of the customer**, which
is the part a customer takes away and the part the salesperson is answerable
for. From here, any sentence that goes on a quote or a checklist is held to
the same rule as a dimension: where it comes from is written down, and where
nothing supports it, it says no more than the sources do.

**Find the pattern with a sweep, then look in the code for why.** *(Leo, round
60.)* What settled the window was not reading `fitWindow` but a sweep: package
A in D's room, the left wall held, the back wall stepped a quarter inch at a
time from 216" to 232". **Every whole and half inch built; every 1/4 and 3/4
was refused.** That pattern is the answer on its own — a step that cannot land
on odd quarters — before a line of the code is read. Narrowing the window from
36" to 30" at D's walls was refused at every width, which ruled out "the window
is too wide". Only then was the code read, and it said the same: a quarter-inch
slide against an eighth-inch tolerance. Keep that order. A sweep over the input
that shows a clean pattern names the kind of fault; the code then has one
question to answer instead of many.

**A large change that "should be expected" is proved, not explained.** *(Leo,
round 61.)* Moving package D's default left wall an eighth of an inch changed
6.8%, 5.4% and 9.4% of D's three shots. "The room shifted under a camera that
frames it" was a good explanation — and this was the round whose lesson is that
good explanations outlive the bugs under them. So it was proved instead: the
new build, asked by URL for the old wall (`?left=178.875`), drew D against the
live site at **0 pixels** in the overview and the install view. The whole
difference was the wall, and nothing else had moved with it. **The method:
put the one thing that was meant to change back to its old value, run the new
code, and see whether the diff goes to zero.** If it does, the change is what
was meant; if it does not, what is left over is the thing nobody meant. Use it
whenever a diff is big and the reason for it sounds right. `?back=`, `?left=`,
`?island=` and the rest of `readParams` in `room.ts` are there for exactly
this.

**The second way to zero it: shoot the same build twice.** *(Leo, round 70.)*
Where nothing can be put back — the difference is not a parameter anybody set
— take the pair again from one build, changing nothing between the two runs.
**If one build against itself differs by the same amount as the comparison
did — the same pixel count, the same number over the threshold, the same box —
the difference belongs to the machine, not to the change.** Round 70: package
A's install view differed between the live site and the local build by 2,851
pixels, 166 of them by more than 32 levels, on the pin labels inside the room.
Two runs of the same local build differed by exactly 2,851 and 166, in the same
box, with every label's `transform` identical in both: what moves is which
frame of the labels' fade the shot catches, not where they are.

⚠️ **A difference inside the room is not waved away with an account of what it
is made of.** "Those are HTML labels, not geometry" is an explanation, and the
lesson of round 61 is that explanations outlive the bugs under them. Zero it
one of the two ways — put the changed value back, or shoot the same build
twice — or report it and stop.

**What not to run at the same time.** *(Round 69.)*
- **Tests and screenshots, not together.** A set of thirty shots is past ten
  minutes on its own, and a machine busy with both makes each one's timing
  worse and its failures about the machine.
- **No build while the smoke suite runs.** The suite serves `dist/`, and a
  build rewrites it underneath: round 68 built a prototype while the suite
  was half way, so that run tested some mix of two builds and was thrown
  away. It was run again on a clean build. The same kind of mistake as the
  first — two jobs that share something, run as if they did not.

⚠️ **Vitest's exit code goes into a file of its own, and nothing runs after it
that could overwrite it.** *(Leo, round 70.)* The same trap has now been met
in three forms, each time reading the exit code of something that was not
vitest:
- **Round 37:** output piped through `grep` — a pipe's status is its last
  command's. Every test had been skipped and the run read as passed.
- **Round 69:** output piped through `tail`. One smoke test of 28 failed, the
  run read as passed, and which test it was is lost for good (Open items).
- **Round 70:** output written to a file, no pipe — and `; echo "smoke=$?"` at
  the end of a command run in the background. The background task reported the
  `echo`'s exit code, 0, over a suite that had failed. It was caught only
  because the result was read from the file and not from the task's status.

A reminder did not hold twice, so this is a rule: `npx vitest run ... >
out.txt 2>&1; echo $? > exit.txt`, with `exit.txt` read as the result — the
`echo` there writes vitest's code and nothing comes after it. No pipe, no
`&&`/`;` tail whose own status could be taken for the suite's, and a task's
"exit code 0" is not read as the suite passing.

Two more things that look like a change and are not, both met in round 53:

- **The mode toast.** "White model · Read cabinet volumes and rough openings"
  fades on its own, so a shot taken 2s after the click has it and one taken 5s
  after does not — 1% of the frame, at the bottom, nowhere near the scene.
  Wait it out rather than masking it.
- **Read the amplitude, not just the count.** A diff of a real change is a
  small number of pixels differing by a lot; a diff of a tier or a fade is a
  huge number differing by one or two levels. Bucketing the differences by
  size separates them in one pass, and it is what turned "13% changed, cause
  unknown" into a settled answer.

⚠️ **Build at the commit you pushed, or one chunk will never match.** The
footer's commit is a `define` (`__COMMIT__` in `vite.config.ts`), so it is
compiled into the main chunk and changes its hash. Round 52 ran its build
*before* committing, and three of four files matched while `index-*.js` did
not — which looks exactly like a deploy that did not land. Rebuilding at `HEAD`
after the push made all four identical. So: push, wait for the run, `npm run
build` again, then compare. The vendor chunks (`react-*`, `three-*`) and the CSS
do not carry the commit and match either way, which is what makes the odd one
out readable rather than alarming.

⚠️ **A click from script is not a click.** *(Leo, round 59.)* `button.click()`,
`$eval(..., b => b.click())` and a dispatched click event go down a different
path through the page from a mouse, a tap or a key press, and **what one of
them shows says nothing about the other**. Round 58 reported "switching from A
to D throws, on the live site" from a script click. Measured in round 59, on
the live site before the fix: a mouse click, a tap and a key press, three times
each, **no error at all**, and none with the CPU slowed six times either; a
script click, **nine times out of nine**. So what round 58 found was an edge
case that the test tooling triggers, not a bug a customer can meet. Why the two
paths differ is not established.
- **The irony is where the script click came from.** It was adopted as a
  workaround, because Playwright's own click hangs on its stability check while
  a WebGL page draws slowly. The workaround brought in a class of false
  positives of its own.
- **From here: a problem that only reproduces under a script click gets one
  question before anything else — can a real person's input cause it?**
  Repeat it with a mouse click, a tap and a key press, and report what the
  customer sees from those, not from the script.
- It cuts both ways, and round 59 met both: a test that clicks with the mouse
  can pass over a fault a script click shows, and a fix can change what a
  script-clicked screenshot looks like while leaving a mouse-clicked one
  untouched (D22, round 59). Say which input a result came from.

**What this forbids:** reporting a push as finished work; a local suite that is
a subset of CI's without saying so; a build that cannot be identified from the
page it serves; stating what a customer sees from a result only a script click
produced.

## D18 · A switch never refuses for want of wall

**Decided:** 2026-09-13 (round 34), Leo.

Turning on a return wall in package D asked for 178-3/4" of left wall in a room
that had 175-1/4", and the answer was a refusal and a button to lengthen the
wall. In front of a customer that is an interruption in the middle of the
explanation, for a change the room could simply have made.

**So a switch that needs more wall gets it.** Any control that changes what the
kitchen is — the return wall, the tower's side, the sink's leg, the refrigerator's
leg, the coffee cabinet's leg, the corner, the housing, the island and which way
it runs, the window, the package — is built at once if it fits. If it does not
fit only because a wall is short, that wall grows to the shortest length that
takes the change, and the room is built. A toast says which wall, from what to
what and why — "左墙已从 175¼″ 加长到 178¾″，以容纳返墙间隙" — with an Undo that
puts back the package, the switches, the walls and the choices exactly as they
were. The toast stays up for twenty seconds (round 35: nine was shorter than a
sentence of explanation), and Undo goes with it. A wall only ever grows here;
nothing shrinks a room.

**It still refuses when growing is not the answer**, with the reasons it always
gave: when a wall would have to pass the slider's top, or when something other
than length is in the way. The top was 204" and refused three of package D's
switches — its columns or its coffee cabinet on the back wall need 207-1/2" and
224-1/4" — until round 35 raised it to 240" (D13). A window that will not sit
evenly in its wall counts as length since round 35 too: the two banks each side
of it finish on what the wall leaves, and that wall grows an eighth of an inch
at a time until they match (D's left wall builds at 178-7/8" where 178-3/4"
would not).

⚠️ **Amended 2026-09-17 (round 60): the eighth of an inch was a bug.** The
window slid a quarter inch at a time looking for two gaps within an eighth of
each other. Each slide moves the two gaps' difference by half an inch, so a
wall that starts the difference at an odd number of quarters can never come
within the eighth, and the room was refused — or, here, grown an eighth so the
difference became even. **"D's left wall builds at 178-7/8" where 178-3/4"
would not" was that fault, not a fact about the room.** With an eighth-inch
step (D11 rule 13, round 60) 178-3/4" builds, the columns go onto the back leg
growing only the back wall, and the customer is no longer told "Left wall
lengthened from 178¾″ to 178⅞″ to fit the refrigerator on that leg" — a figure
and a reason that were both wrong. The test that held the eighth
(`autoGrow.test.ts`, round 35) now holds 178-3/4".
- **Package D's default left wall is back to 178-3/4"** *(Leo, round 61)*, the
  return wall's own figure. It was 178-7/8" from round 35 to round 60 for a
  reason that turned out not to exist, and **a number left standing after its
  reason is struck out reads as though it had another one**. The eighth is
  history now rather than a live figure with a crossed-out explanation. Its
  cost was D's own screenshots moving an eighth of an inch, which is the round
  that changed it saying so.
- **The same fault shrank rooms.** Package D's 224-1/4" back wall refused A's
  and C's window, and the last fallback in `setActivePackage` sized both walls
  to those packages' bare minimum instead: D to A gave 147" x 105", D to C 141"
  x 105", against this entry's own rule that choosing a package never shortens
  a room. With the eighth-inch step, D to A, B and C all keep D's room. The
  fallback itself was deleted in round 64 (Open items): nothing it did was
  ever right.

**Package E has one switch without slack, by name.** *(Leo, round 69.)* Its
room is 180" x 168"; moving its coffee cabinet to the left leg asks 176-1/8"
and grows the wall, rather than every E room opening eight inches deeper for one
rare switch (D20, round 69). And E refuses a room with no island whatever the
walls — its cooktop is in the island — which is a refusal by design, not for
want of wall. `autoGrow.test.ts` names both, with the reasons.

**The wall sliders are not switches.** Dragging one is asking for that length,
and a length the room will not build at is refused on its own terms, as before.

**A package's own room has slack.** Its default walls are at least the largest
wall any single switch needs from that room, extreme combinations aside, so the
switches a salesperson actually flips never make it grow. Checked over every
switch in every package: A 168" x 144" (the largest need is 159" x 126"), B
202-3/8" x 144" (199-3/8" x 126"), C 168" x 144" (153" x 126"), all unchanged;
D 201-3/4" x 178-3/4" in round 34, its left wall up from 175-1/4" for the return
wall's clearance, and 224-1/4" x 178-7/8" from round 35, when every switch
became buildable: the coffee cabinet on the back wall needs the 224-1/4", and
the columns on the back leg were held to need the eighth of an inch. **The
eighth was the window bug, and the left wall is 178-3/4" again since round
61.** The spare inches are handed to the landings in the reverse of the
shrink order, as D13 already does. A package's default walls are a floor:
choosing it never shortens a room somebody has made bigger.

**What this forbids:** refusing a switch that a longer wall within the slider's
range would build; growing a wall further than the change needs; growing a wall
without saying so and offering to undo it; growing a wall behind a slider the
customer is dragging.

## D19 · The ceiling is 108-1/2"

**Decided:** 2026-09-13 (round 36), Leo.

Every kitchen in the app stands under a ceiling 108-1/2" off the floor —
9'-0-1/2". It is a global default, not a parameter: no control changes it, and
no package has its own.

**Why it is a decision now.** Package E's island hood hangs from the ceiling,
so where its canopy can be depends on how high the ceiling is. Every hood,
bridge and housing that already runs to the ceiling depends on it too.

**Built in round 37, as scheme A (Leo).** Everything that finished at 96"
still finishes there, and a 12" box is stacked on it. That covers every tall
cabinet, tower, column bridge and oven bridge, the cabinet over a freestanding
refrigerator, the finished boards beside them, and every wall cabinet. The
joinery then tops out at 108" (`ROOM.stackTop`). The 1/2" left to the ceiling
is the closing scribe D13 has always allowed, so the six-inch rule is not
touched: D13 gains an entry in its height list (`stack: 12`), not an
exception. There is a door seam at 96", and that is accepted — it is what a
stacked cabinet is.

What it changed:
- A stack has the footprint of the box under it: 12" deep over a wall
  cabinet, 24" over a tower, and off the wall where the box under it is.
  Under 9" wide it is not a cabinet but the same board carried on up.
- The bridge over an under-cabinet hood is made to the 96" line exactly —
  11-1/4" over package A's 84-3/4" canopy top — rather than ordered to the
  whole inch with a scribe over it. That keeps its stack level with the
  stacks beside it; the scribe is over the stacks now.
- The crown runs along the top of the stacks, and an insert hood's housing
  runs up beside them. *Amended round 39, Leo:* both go to the ceiling, not
  to 108". A crown is what covers the half-inch scribe over the stacks; with
  the grille as the steam oven's outlet, that gap has no job to do.
- Package C's chimney hood, HMCB30WS, is rated 30"-42" from the underside of its
  canopy to the top of its chimney. On the 30" minimum over its 36" cooking
  surface it would reach 108", half an inch short, so its canopy goes up to
  66-1/2": 30-1/2" of clearance, inside D13's 30"-40". A, B and D hang
  where they did.
- The box over a hung oven stands off the wall with an open back (D11 rule 12,
  round 37), and the stack on it stands off with it, so the gap behind runs up
  to the scribe at the ceiling.
- The window check compares a window's head with the 108-1/2" ceiling.

**What this forbids:** a ceiling height per package or per room; 96 or 108.5
written into geometry instead of read from `ROOM`.

## D20 · Package E: island cooking — registered, not built

**Registered:** 2026-09-13 (round 36), Leo's answers before any of it is built.

- **The column group** is a freezer column and a refrigerator column, **left to
  right as you face them: freezer, then refrigerator.** 18 + 5/8 + 30 + 3/4 +
  3/4 = 50-1/8". In the data, `columnOrder: ["slot-freezer", "slot-fridge"]`,
  which says exactly that.
  - **The order is absolute, and it is Leo's site practice.** *(Leo, round 57.)*
    Across every package: **a freezer column always stands to the left of the
    refrigerator column, and a wine column always to its right** — package D is
    freezer, refrigerator, wine. It is the same whichever leg the refrigerator
    is on, because it is how it is said on site: an installer is told "the wine
    goes to the right of the fridge", never "the wine goes at the end furthest
    from the landing".
  - ⚠️ **This entry used to state it the other way**, by what each column stood
    next to — "the refrigerator next to the landing, the freezer at the outer
    end of the wall" — and claimed that made it hold on either leg. It did the
    opposite: on the left leg the outer end is on your left and the sentence
    agreed with the rule, but with the refrigerator switched to the back leg the
    outer end is on your right, and the sentence read the freezer to the wrong
    side. **That was a fault in the wording, not in the rule or in the code**:
    measured in round 57, the freezer stands to the left of the refrigerator on
    both legs, in E's shape and in package D, and D's wine to its right. Round
    56 had carried the sentence's reading into an open item and a test; both are
    corrected.
  - **What the wall has to be is not this figure.** The bank is 50-1/8" and the
    whole leg's cabinetry — corner, landing, panels, kit, both columns — comes
    to **107-1/8"**. But the wall itself is settled by the island standing
    across it: at least **157"** — this entry's own figure below, 25 + 48 + 40
    + 44. *(Leo, round 55: the earlier estimate of "125-140 inches of tall wall"
    folded those two into one figure. They are two. The cabinetry is 107-1/8";
    the wall length is the island's, and is worked out separately.)* The other
    leg, carrying the sink, needs **168"**.
    - ⚠️ **Round 55 wrote 163" here, and it was wrong.** Round 54's prototype
      built E's island out of A-D's 36" default cabinets and the ordinary 42"
      aisle, and 163" is what that island needs. This entry says E's is **24"
      of cabinet and 40" of counter**, and round 56 gave a cooktop island its
      48" aisle; with both, the generator refuses 156" and builds 157", which is
      D20's own arithmetic. Corrected in round 56.
- **Landings on the island** are D11 rule 4's island branch: 15" and 12" along
  the island's length.
- **Aisles:** 48" on the cooking side, between the perimeter run and the
  island, because somebody is working at the cooktop and standing under the
  hood; 44" behind the seating. Package E does not use rule 7's single 42".
- **The seating overhang is 15"**, which needs steel support brackets, and the
  install list says so. 12" is the alternative.
  - ⚠️ **In the prototype it looks perfectly fine, and that is the problem.**
    *(Leo, round 55.)* Fifteen inches of 1-1/2" top with nothing under it reads
    as an ordinary breakfast bar — nobody looking at it thinks a part is
    missing. So the picture is quietly telling a customer that it installs like
    that, while 3cm quartz is good for about 10"-12" unsupported. **The picture
    and the list may not both be silent**: either the brackets are drawn, or the
    line is on the install list. Drawing nothing and listing nothing is the one
    combination that misleads.
  - **Built in round 68: concealed steel plate, and a line on the list.**
    *(Leo: the support is concealed steel plate — his site practice.)*
    - **The list says it.** Any island top reaching more than 10" past its
      cabinets on the seating side gets a warning on the install checklist
      and the quote: stone is commonly taken to carry about 10"-12"
      unsupported, so this top needs concealed steel support plates — a line
      on the quote. It is filed under a machine that stands in the island (the
      cooktop in E), never the hood hung over it, because a line has to name a
      slot the room has (round 55). `overhang.ts`, `useChecklist.ts`.
    - **The finished room shows nothing, because nothing shows.** Concealed
      plate is under the stone; drawing it in the finished room would be
      drawing something a customer will never see. The install view draws
      the part of the top that needs carrying — the whole length of the top,
      from the cabinets' seating face out to the edge, on the stone's underside
      — dashed grey, D21's reviewed-but-not-a-drawing tier. **The plates
      themselves are not drawn**: how many, how wide and how far under the
      cabinets they run has no source here, and a part drawn to invented
      figures is the trim ring of round 58 again.
    - **Sources, kept apart.** 10"-12" for 3cm quartz: secondary trade
      experience (this entry), not a fabricator's figure. Concealed plate:
      Leo's site practice.
    - **Why the lower end, 10".** *(Leo, round 69.)* The line is "to
      check", not a refusal. A line raised that turns out unneeded costs one
      conversation; a line missed costs an item missing from the quote. So
      10"-12" itself asks.
    - **The words follow the top; the judgement does not.** *(Leo, round
      69.)* Round 68's line named stone and quoted 10"-12" whatever the top
      was, so a customer who picked oak read about stone. 15" of any top
      wants carrying, so the line is raised the same; but for quartz and
      marble it says stone, 10"-12" and concealed steel plate, and for oak
      only that the top needs support under it — nothing here says what wood
      carries (D17: words a customer reads say no more than is known).
- **The island hood's height is worked out, never a constant.** The underside
  is at max(the cooking surface plus the manual's minimum clearance, 66") off
  the floor. The HMIB42WS manual gives 30" over the cooking surface for gas and
  for electric/induction alike, and no lower figure at 600 CFM, so the lower
  end is 66". Its duct cover spans 30"-45-1/16" from the bottom of the hood to
  its top, which under the 108-1/2" ceiling puts the underside at most 78-1/2".
  That figure is the cover fully collapsed with no adjustment left, so it is
  not a usable top. **The usable range is 66"-76".** *(Leo, round 37.)*
- **The underside is at 72"**, 36" over the cooking surface: an induction plume
  is weak, and a clear line of sight across the island matters more. *(Leo,
  round 37.)*
- **The standard duct covers are enough.** At 72" the hood is 36-1/2" from its
  bottom to the ceiling, inside the drawing's 30"-45-1/16". The manual's text
  also says the supplied covers fill an 8' ceiling and the CHXTHMIB telescopic
  kit reaches 9'-12', and 108-1/2" is half an inch over 9'. So **CHXTHMIB stays
  on the quote as a conditional line, marked "to confirm with Thermador"**. The
  importer skips anything named a kit, so that line comes from a rule, not from
  the catalogue.
- **The canopy is 27" deep**, from the drawing on page 8 of the manual. The same
  page's text says 23-3/16", and that figure is not used. *(Round 37; confirmed
  by Leo, round 40.)*
- **The catalogue's Height of 30" is not the height to draw.** 30" is the duct
  cover fully collapsed: the bottom of the drawing's 30"-45-1/16" span from the
  underside of the hood to the top of the cover. Installed, the hood is the
  ceiling less its underside, 108-1/2" - 72" = 36-1/2", which leaves 6-1/2" of
  adjustment down and 8-9/16" up. The island hood is drawn to that worked-out
  figure, never to `heightIn`: drawn at 30" its top would hang 6-1/2" short of
  the ceiling. *(Leo, round 40.)* Today the island branch in
  `ApplianceModel.tsx` draws the body at `heightIn` with a thin drop to the
  ceiling, so that changes when E is built.
- **E's first job: a hood hung from the ceiling has heights that start from
  where it hangs.** *(Leo, round 45.)* Round 44's prototype hung HMIB42WS over
  package D's island with its underside at 72" and drew what the code draws: a
  30" solid wedge from `heightIn` (72"-102"), and a stem from the wedge's top
  78-1/2" long — the ceiling less the wedge, as if the hood stood on the floor —
  so the stem reached 180-1/2", 72" through the ceiling, while the canopy top was
  6-1/2" short of it. The three are one mistake: nothing in the code knows the
  hood is hung. Fix them as one, not as three patches:
  - overall height = ceiling - underside = 108-1/2" - 72" = 36-1/2";
  - the canopy body is 2-3/4", its thickness on the drawing;
  - the duct cover is the rest, 33-3/4", and must fall inside the drawing's
    30"-45-1/16";
  - the duct cover runs from the canopy's top up to the ceiling, never from the
    floor.

  *Done in round 46.* `islandHoodParts` in `hood.ts` works the heights out from
  the underside, with HMIB42WS's page-8 figures in `ISLAND_HOOD`, and the island
  branch in `ApplianceModel.tsx` draws the 2-3/4" canopy and a 13-1/4" x
  14-7/8" duct cover from its top to the ceiling. The drawing's 30"-45-1/16" is
  measured from the bottom of the hood to the top of the cover, so it is checked
  against the overall 36-1/2" (the 33-3/4" cover alone is also inside it).
  Checked by hanging it over package D's island in a prototype that was then
  removed. Not yet done: the install view's outline round an appliance is still
  a box `heightIn` tall, so round an island hood it is a 30" box.
- **The 66"-76" range belongs to the 108-1/2" ceiling.** *(Leo, round 47.)* The
  drawing's 30"-45-1/16" is the bottom of the hood to the top of its cover, so
  under a 108-1/2" ceiling the underside can be anywhere from 63-7/16" to
  78-1/2". Headroom takes it to 66" at the bottom, because people walk under an
  island hood, and the telescoping cover's last 2-1/2" of travel is left alone
  at the top, which is 66"-76"; 72" is in the middle. If the ceiling ever becomes
  a parameter this range has to be worked out again, and a low ceiling reaches
  the headroom line first: under an 8' ceiling (96") the shortest overall height,
  30", puts the underside at 66" at most — exactly the headroom line, with
  nothing to spare. If E is to support an 8' ceiling, that is the first thing
  that stops it.
- **What the cooktop prototype found.** *(Round 47; a temporary prototype put
  CIT367YG on package D's island with HMIB42WS over it, then was removed. None
  of this is built.)*
  - The guide's two figures under the cooktop agree if read one way. Page 7
    (ventilation) asks for at least 3-3/4" (95 mm) from the counter's surface to
    the top of the drawer and 13/16" (20 mm) at the back of the cabinet. The
    diagram on page 8 gives at most 2-3/4" of cooktop below the counter, a 1"
    conduit fitting and at least 1" of air. 2-3/4" + 1" of air is 3-3/4"; with
    the fitting as well it is 4-3/4". The reading that agrees is that the 1" of
    air is under the body and the fitting stands clear of the drawer. That is an
    inference: the guide does not say it.
  - The island has no drawer cabinet to measure against. Its base is plain
    boxes either side of and behind the two openings, and its top is one solid
    box with nothing cut out of it. A cutout, a drawer base and its clearances
    are all new for E.
  - Package D's island is too short for a 36" cooktop and its microwave drawer:
    set halfway along it, the cooktop runs over the drawer's opening. This is
    D20's "a 72" island that takes the cooktop has no room for a 24" machine" in
    practice.
  - The check that a hood is centred over its cooking surface
    (`layoutRules.ts`, `d11-4`) compares the x coordinate only. On a wall, and
    on an island laid parallel to the back wall, x is along the run and the
    check is right. On an island turned across the room, x is across it, and a
    hood slid along the island would pass. It has to compare along the island
    when the cooking surface is on one. *Fixed in round 48, before `slot-cooktop`
    (Leo): E's point is the cooktop and hood on the island, and a check that
    misses there leaves the main scene without a guard. Over an island the hood
    is now held centred along the island and across it, the axes taken from the
    way the island is turned; against a wall the check is unchanged. The case
    in `layout.test.ts` — an island 72" along z, a hood 6" off along it — found
    nothing wrong on the old check and fails on the new one.*
  - An island machine's floor riser (`UtilityLayer.tsx`) is offset 6" behind the
    machine by `z - cos(rotationY) * 6"` only. Turned a quarter, cos is 0, so the
    riser sits under the middle of the machine instead of behind it. Seen in the
    code; the riser is too faint to read in the screenshots. *To be fixed with
    `slot-cooktop`, not before. (Leo, round 48.)* *Fixed in round 49
    (`islandRiser.ts`): behind the machine on both axes, and the box turned
    with it.*

  Sight lines need no picture: a standing eye is about 64" and a seated one about
  45", both under a 72" underside, so the hood does not block the view. What is
  left to look at is how a 27"-deep canopy sits over the island, once it is drawn
  right. *(Leo, round 45.)*
- **Under the cooktop: 3-3/4" on the drawing, 4-3/4" on site.** *(Leo, round
  48.)* The reading in round 47 that makes the guide's two figures agree may be
  right, but it is not a source. A figure the guide states is taken over one
  made by adding figures up, as everywhere else in this file.
  - The top of the drawer is at least 3-3/4" below the counter's surface:
    CIT367YG guide, page 7, stated.
  - At least 13/16" at the back of the cabinet: page 7, stated.
  - The diagram on page 8, 2-3/4" + 1" + 1" = 4-3/4", does not agree with page
    7. The stated 3-3/4" is taken; where the extra inch comes from is not known.
    **A known ambiguity.**
  - *Site practice (Leo), not the guide:* the drawing is labelled 3-3/4", and on
    site 4-3/4" is left. An inch in a drawer base costs nothing; a cooktop that
    will not go in is the problem.
- **E's island is 72" long and carries only the cooktop.** *(Leo, round 48.)* No
  microwave drawer and no wine cabinet. The arithmetic was done in round 36 —
  36" of cooktop + 15" + 12" of landing is 63", which leaves no room for a 24"
  machine — and round 47's prototype made it visible. 72" is the 36" cooktop
  with 18" of landing each side, and seats three at 24" each. Rule 4 asks for
  15" and 12"; 18" and 18" is past both minimums, so it conforms. **Screenshots
  label the landings as built, 18" and 18", not as the rule's 15" and 12".**
- **Rule 7 does nothing on E, and has to be rewritten.** It says which way the
  island faces from its microwave drawer and wine cabinet, and E's island has
  neither. *(Leo says this was registered in round 36; this file had no entry
  for it until round 48.)* *Rewritten in round 69 (D11 rule 7).* Measured
  first, it did nothing wrong on E — the facing check skips an island without
  both machines, and both aisles hold at E's figures — so the rewrite is its
  text and its codes. What *did* fail on E was **rule 4**, below.
- **Package E, configured in round 69.** In `data/packages.json`, with D20's
  figures: an 18" freezer and a 30" refrigerator column, freezer on the left,
  as one 50-1/8" bank; a 30" combination oven and the coffee cabinet each
  standing on its own on the back leg; a 24" dishwasher by the sink; a 36"
  induction cooktop in a 72" x 24" island with a 15" seating overhang and a 48"
  aisle; a 42" island hood hung at 72".
  - **Its room: 180" x 168".** *(Leo, round 69.)* D18 asks a package's own room
    to take every single switch without growing; D20 set E's room 168" deep.
    The two disagree on two switches: a lazy susan asks 180" of back wall, and
    the coffee cabinet moved to the left leg — taking the combination oven with
    it, since both towers stand on one leg (round 55) — asks 176-1/8" of left
    wall. The back wall is 180", so the corner switch has its slack; the left
    wall stays at D20's 168", and that one switch grows it, with its toast and
    its Undo. `autoGrow.test.ts` names it, with this reason.
  - **No separate blower.** HMIB42WS carries its own (integrated, 600 CFM).
    Every hand-built E before this — five, in five test files — had carried
    package D's VTN2FZ along from the package it was copied from, which would
    have put a blower E does not take on its quote. There is one E now, in the
    data, and the tests take it from there (D17: one rule, one copy).
  - **The 18" freezer column is the package's slot width.** Its door is drawn
    from the 18" wine column's panel drawing, which is closer than D's 24" but
    is still an inference (the T18IF900SP panel drawing is not in
    `docs/reference/`).
  - **Rule 4 held a hood over an island to a range.** Its island branch looked
    for `slot-range` standing on the island — an early prototype's shape — and
    otherwise failed "no range on any run". So E failed rule 4 outright, and its
    hood was never checked for centring. It now asks the island's cooktop, where
    there is no range on a run: the same order the template hangs a hood in.
    Round 48's four centring cases, which stood the cooktop in `slot-range`
    because `slot-cooktop` did not exist yet, were moved onto a room that cooks
    in the island (`islandRule4.test.ts`).
  - **CHXTHMIB, decided in round 37 and built in round 69.** The conditional
    line this entry has carried since round 37 was not in the code. It is now:
    a line under the hood, to confirm with Thermador, wherever HMIB42WS hangs
    under a ceiling over 8'.
  - **Not done, and not needed to go live** *(Leo)*: HMIB42WS's and CIT367YG's
    rough-in points. Without them the install view draws the island's services
    in the not-yet-reviewed tier, which is the true state.
- **`slot-cooktop`, built in round 49.** *(Scope from Leo, round 48.)* No
  package has one yet; it was looked at by putting CIT367YG in place of package
  D's island microwave drawer in a prototype that was then removed.
  - **The slot.** Category `cooktop`, in the island on its working side,
    centred along it, so a 72" island is 18" + 36" + 18". A package names
    `slot-range` or `slot-cooktop` (`COOKING_SLOTS` in schema.ts); before, it
    had to name `slot-range`. A package with a cooktop is refused a room with
    no island, and a package that puts a cooktop and an island microwave drawer
    or wine cabinet in the island together fails loudly in the template.
    240V / 50A on the slot.
  - **The cutout.** Where the island has a cooktop its top is one slab with the
    machine's own published cutout in it — 34-3/4" x 19-7/8" for CIT367YG, its
    width along the island — centred on the drawer base (`islandCooktopHole`,
    counter.ts). The test also holds it to the guide's page 6: at least 2" to
    the counter's rear edge, which on an island is the seating side, and 2-1/4"
    to its sides.
  - **The drawer base.** Its top is 3-3/4" below the counter and it stops 13/16"
    short of the carcass behind it (page 7, stated; `COOKTOP_CABINET` in
    cooktop.ts). The band between the drawer top and the counter is drawn
    open: whether a cabinet has a rail across it is not in the guide. Its door
    is on the working face (`CabinetBox.front`).
  - **The cooktop.** Glass 37" x 21-1/4", about 1/4" proud of the counter — an
    inference, the 4" body less the 3-3/4" cutout depth. Under the counter a
    chassis the size of the cutout, 2-3/4" deep, and the 1" conduit fitting
    under that (page 8). Where the fitting is under the cooktop is not on the
    drawing; it is drawn in the middle and only its height is the guide's.
  - **The data.** CIT367YG now imports: read 33 / exported 33 / skipped 0, and
    its cells match the sheet (37 / 21-1/4 / 4; cutout 34-3/4 / 3-3/4 / 19-7/8;
    induction; 240V 50A). Its Feature cell is blank, so its install type came
    in as the importer's default, `freestanding`. Nothing is drawn from that —
    a cooktop is recognised by its category — but the cell is wrong, and it is
    the sheet's to fix.
  - **The fit panel** said "0.6" filler each side" for it. A cooktop drops into
    the stone as a rangetop does, so it quotes no filler now.
  - **The riser.** Its test failed on the old formula for the four islands laid
    across the room, and passes on the new one.
- **E is also stopped by `CORE_SLOTS`.** *(Found round 49, not changed.)* Every
  available package still has to name `slot-microwave` and `slot-wine`, and E's
  island has neither, so E's package entry will not load until that changes.
  Its configuration round has to take it up. *Changed in round 50 (D22): there
  is no list of core slots; a package declares its own.*
- **Until E, nobody can pick the island hood.** *(Round 45.)* HMIB42WS could be
  picked from the hood alternatives in packages B and D on the live site: the
  list offered every hood and refused only on width, and both slots are 42".
  Round 40's report that it could be picked in no package was wrong — it read
  the rule that migrates a selection between packages, not the list. The list
  now leaves out a model that hangs differently from its slot
  (`offeredFor` in `catalogue.ts`): no hood hung from the ceiling for a wall
  slot, no wall hood for a slot over an island. HMIB42WS is the only model this
  removes from any list today.
- **One judgement, one implementation.** *(Leo, round 46.)* The root of that
  bug: switching packages and the alternatives list judged the same question —
  does this model go in this slot — with two different pieces of code, and they
  disagreed. The junction box drawn behind the oven and the island points drawn
  on a wall had the same shape: one fact decided in two places. So a new
  judgement about a slot has one implementation, or its callers share the one
  function. As it stands they still do not: switching packages carries a model
  across only if `suitsPackageSlot` passes (category, install type and width),
  and the list offers what `offeredFor` passes (how it hangs) and refuses on
  width in the row. That is deliberate for now and recorded here so the next
  change joins them rather than adds a third.
- **What the list leaves out: what cannot be built, not what is built
  differently.** *(Leo, round 46.)* An island hood in a wall slot cannot be drawn
  or installed there, so it is left out. A freestanding refrigerator in package
  A's built-in slot can: D11 rule 11 already draws its surround and return wall,
  and a customer trading down to a freestanding model is a real conversation.
  So the list does not filter refrigerators, or anything else, on install type.
  Do not "complete" the filter.
- **The cooktop is in the island and the hood hangs straight over it.** The
  induction cooktop is set into the island's counter on its working side, not
  against a wall, and the hood hangs from the ceiling directly over it with no
  cabinetry between them. *(Leo, round 40. Thermador's own rendering of an
  island kitchen shows the same arrangement; it is a sales illustration, so it
  confirms the direction and is the source of no figure.)*
- **Sheet cells not yet checked by rendering.** *(Round 40.)*
  - CIT367YG: Leo filled Depth (21-1/4") and Height (4"), and its
    `cutoutHeightIn` is to be 3-3/4" from the manual (at most 2-3/4" under the
    counter plus the 1" connection). The export read in round 40 still had
    3-7/8"; Leo is re-entering it. The row is skipped as `no slot: cooktop`, so
    none of its cells reach `appliances.json` until `slot-cooktop` exists;
    verify them then.
  - HMIB42WS: its cutout cells are its outline on purpose (D4, round 40). In
    the export read in round 40 the body is 42 / 27 / 30 in the sheet's order
    Width / Depth / Height, and the cutout cells are 42 / 27 / 30 in the sheet's
    order cutoutWidth / cutoutHeight / cutoutDepth. So height and depth are
    crossed — `cutoutHeightIn` 27 and `cutoutDepthIn` 30 against a body 30 high
    and 27 deep — and that import is not committed.
- **Every aisle is measured counter edge to counter edge.** *(Leo, round 38.)*
  The island is described in three figures, and every aisle check uses the
  last of them:
  - `islandCabinetDepth` — the cabinets, which is what the island depth slider
    sets today (24"-42");
  - `islandOverhangIn` — the counter past the cabinets on the seating side, a
    new parameter for E: 15";
  - `islandCounterDepth` — the whole top: cabinets + seating overhang + the 1"
    lap at the front.

  For E that is a 24" cabinet and 40" of counter. For A-D, which have no
  seating overhang, it is the cabinets plus 1" each side. Leo's round-38 note
  gives A-D as 42" and 44"; the default the app opens with is 36", so 38".
  Across the room for E it is 25 + 48 + 40 + 44 = **157"**, and the default
  depth stays 168" *(Leo, round 37)*.

  *Found in round 38, changed in round 39 (Leo).* The app used to measure its
  aisle between cabinet faces, from the perimeter run's 24" carcass to the
  island's, and its room-depth check added the cabinet depth, not the top.
  Both counters lap 1" into that aisle, so an aisle A-D reported as 42" was 40"
  counter edge to counter edge. Now the island stands the aisle plus both laps
  off the run, the aisle figure on the drawing is drawn between the counter
  edges, the checks that refuse an island or grow a wall count the whole top,
  and there is a check behind the seating that passes wherever there is no
  overhang. **None of A-D's default rooms had to change:** every package's own
  room still takes every single switch without growing a wall. That is the test
  that holds D18's slack, and it passed as it stands.

## D21 · A line says where its figure comes from

**Decided:** 2026-09-14 (round 41), Leo.

In the install view every line is drawn in one of three looks, and each look
has one meaning:
- **Solid, in the service's colour — confirmed.** The figure is off the
  manufacturer's drawing.
- **Grey dashed — reviewed, not confirmed.** Site practice, an inference, or a
  figure the drawing leaves unclear. Clicking one says which: "site practice,
  not a drawing — to confirm", "inferred, not on any drawing — to confirm",
  "the drawing is unclear here — to confirm".
- **Faint thin grey — not yet reviewed.** The default. Nobody has classified
  it, so it is drawn weaker than a dashed line and never looks more certain than
  one. Clicking a point in this tier says "not yet reviewed".

**Amended 2026-09-23 (round 71), Leo: a point placed because the room left no
choice is dashed, whatever its drawing says.** Where no side of a machine has a
real cabinet, the point goes where the model's `whenNoCabinet` says (D22) — and
that is drawn grey dashed even when the sheet itself gives the alternative, as
T36BT120NS's socket behind the appliance does. A fallback taken because the
room would not allow the recommendation is exactly "reviewed, to confirm": the
figure is sound and whether it is what this kitchen should do is a conversation.
`tierOf` in `roughIn.ts` decides it; `lineTier` still answers for the point's
own provenance.

*Amended the same round, Leo: three looks, not two.* The first version had two,
and solid meant "from a drawing, or not yet reviewed" — one look with two
opposite meanings. In the dishwasher's install view a solid generic trunk ran
into a dashed sink-base connection, which read as a certain pipe ending in an
uncertain fitting. A third, weaker look for what nobody has reviewed removes
that reading without recolouring any one run by hand.

**Why.** In front of a customer a dashed line is one the salesperson can point
at and say they will confirm, which is better than a line that looks certain
and is wrong. An installer who sees one goes to the manual.

**How it is recorded.** Each point in `data/rough-in.json` carries `provenance`
— `drawing`, `site`, `inferred` or `uncertain` — and `basis`, which says which
of its figures come from where when they are not all one. A point takes its
weakest figure.

**First batch, round 41. No position changed.**
- Bosch SHV78CM3N. Power and water in the sink base: `site` (Leo). The drain in
  the sink base is site practice too, but its 38" high-loop apex is on no
  drawing and nobody knows where 38 came from: `inferred`, to confirm. The air
  gap: `inferred`; it is an inspection item in California and Leo is checking
  the local code.
- MD24BS. The outlet's 4" and 14-5/8" are on the drawing, but whether it is on
  the rear wall or the side panel cannot be read from the isometric: `uncertain`,
  and Leo is reading the manual's text. The anti-tip block, top rear,
  6" x 3-1/2" x 1-1/2": `drawing`.
- T36BT120NS. The receptacle and the water in an adjacent cabinet are on the
  drawing; 6" in and 6" up are not: `inferred`. The service channel is up to
  7-1/4" tall on the drawing, but running the whole 36" of the opening is not:
  `inferred`.

**Not yet reviewed, and drawn faint.** Every other model's points — PH36HWS,
PCG366W, MEM301WS, PODS302B, T18IW100SP, VCIN36WS — have `provenance: null`.
So does everything the utility layer draws along the walls: the gas, water,
drain and power trunks with their risers, elbows and boxes, the service panel,
and the duct with its damper and blower. Those runs come from room-wide heights
and routes, not from any model's figures, so they are this tier as a whole,
whatever their service. The service colours remain on confirmed points and in
the utility legend.

Not covered by the three tiers yet: the vent plane in the top of a hung oven's
opening and the duct hole in the floor of the cabinet over a hood are still
drawn as flat duct-grey planes.

**What this forbids:** one look standing for two meanings; drawing an
unreviewed line as strongly as a reviewed one; changing a position to move a
line up a tier.

**Reaching a point. Amended 2026-09-14 (round 42), Leo.** The install view
exists to explain the services to a customer, and a point that cannot be
reached explains nothing. Most points stand inside or behind an appliance, and
a click on them landed on the appliance. Two changes:
- **The panel lists every rough-in point in the package**, grouped by tier,
  under a legend drawn the way each tier is drawn. Picking one switches to the
  install view, marks the point with a sphere drawn over whatever is in front
  of it, and shows the callout a click on it would. It does not depend on the
  point being clickable, and it is the table of contents of what the package
  roughs in. The utility switches lost their service colours: the runs they
  switch are faint grey (`src/ui/RoughInList.tsx`, `src/data/roughInList.ts`).
- **In the install view the appliances step back and take no clicks.** Their
  materials, already transparent in that mode, drop to 12%, and a click passes
  through them to the service behind. This extends `OcclusionFade`, which
  already faded what stands between the camera and an appliance; it writes
  opacity only on materials that are already transparent and never flips
  `transparent`, so no shader is rebuilt. An appliance is picked from the list
  while in the install view.

**Island points, and misspelt keys. Amended 2026-09-14 (round 43), Leo.** The
list's first use highlighted MD24BS's anti-tip block on the left wall beside
the refrigerator, not in the island. A slot on no wall run had borrowed the
first wall run to place its points, so every point of an island machine was
drawn on that wall — MD24BS's outlet and anti-tip block in packages A and D.
The existing test missed it because it asked whether a point sat inside the
host box that the same fallback had produced: test and code shared the wrong
premise. An island opening is now measured in its own frame, across its face
and back from it, turned with the slot. `islandRoughIn.test.ts` checks the
points against the island's own plan extents, with the island laid both ways,
and it failed on the old code before the fix went in.

Separately, `data/rough-in.json` now refuses to load with a key the catalogue
does not have. Package B's insert hood was entered as `thermador-vcin36ws`
against the catalogue's `thermador-vcin36gws`, so it drew no point at all. It
is corrected, and it was the only key that did not match.

**Clicks, still not fixed.** A click on a point beside the refrigerator lands
on the refrigerator: its install-view outline is line segments, which still take
clicks, and round 42 stopped only meshes. That ray also passed through no
rough-in point, so part of "it cannot be clicked" was clicking where the point
is not. The list is the way in until this is taken up.

**Clicks, fixed. Amended 2026-09-14 (round 44), Leo.** Two changes:
- In the install view an appliance's outline takes no click either. It is line
  segments, which round 42's change passed over — a variant of "hidden geometry
  still takes a raycast".
- Every point has an invisible 7" box round it that takes the click, only in the
  install view. Outside it the layer is hidden but would still take a raycast,
  so neither the box nor the fitting is clickable there, and a click in the
  finished room still selects the appliance.

A click on the refrigerator's water point beside it now shows its callout. The
dashed box that had been clicked beside the refrigerator in earlier rounds was
MD24BS's outlet, drawn there by the island fallback; after round 43 it is in the
island, and there is nothing at that spot to click. `islandRoughIn.test.ts` now
covers package C's island too.

## D22 · Which way a thing faces is recorded, and written in one place

**Decided:** 2026-09-14 (round 50), Leo.

**What the round-49 sweep actually found.** Sixteen places got an island, or an
island turned across the room, wrong. Five of them did the right turn, written
out again. **The other eleven did no turn at all:** they guessed which way a thing
faced from its proportions or from how big its turn was, or they assumed the back
wall. So it is not only a missing shared function. The cabinet boxes and the
slots had no notion of "which way I face", and the island had only ever been
right where it happened to lie the way the runs do. Both are needed: one place
that turns a point, which fixes the five, and a facing recorded where a thing is
made, which fixes the eleven.

**Fixing without that makes more.** Round 49 fixed the floor riser and added two
new copies of the turn, and the three places fixed by then — the hood centring,
the island rough-in points, the riser — used three different spellings. So the
shared representation comes first, or every round of fixes adds two.

**The order.** One step a round:
1. **The frame module, and every box recording its facing** — behaviour
   unchanged, no screenshots. Every place that turned a point by hand moves onto
   it, the three already-fixed ones included; a guard test fails on any new one;
   and a package's slots become the ones it declares.
2. **What is wrong today:**
   - the plan thumbnail's width and depth;
   - the install view's leader lines;
   - the island's doors;
   - the wall-anchor of the utility runs;
   - the island aisle dimension;
   - the island branch of rule 4's landing check;
   - the fly-in angle.
3. **The hood over the island:** its duct outlet and duct run, the service trunks,
   hanging it over an island cooktop at all, and the rough-in hosts an island slot
   cannot find today. This is `slot-hood` hung from the ceiling, done here because
   this step has the frame module to do it with.

Then package E's configuration. *(Leo: E before these would be a package that
generates and is drawn wrong everywhere, found one at a time in the full scene —
the most expensive way this project has worked.)*

**A fly-in is stored relative to the machine's front.** *(Leo.)* `bestView`
means "from a little off the machine's face". An absolute azimuth only means
that while everything faces the back wall. Round 49's cooktop took the
microwave's 210°, was blocked, and was hand-set to 240° — that hand-setting was
this turn done by hand. In step 2 every slot's angle is worked out again as the
front plus an offset, so a new machine takes the offset. **Acceptance for it is
separate:** a fly-in screenshot of every slot in every package, reported apart
from the other step-2 fixes.

**Step 1, done in round 50.**
- `src/data/frame.ts`. A run and the island are strips laid along an axis:
  `onAxis`, `alongOf`/`acrossOf`, `sizeOnAxis`, `stripFacing`, `faceRotation`,
  `alongIsToTheRight`. A machine is turned by `rotationY`: `toPlan`/`toWorld`,
  `toLocal`, `outward`, `facingOf`, `sizeOnPlan`. One turn formula, held to
  three.js's own by `frame.test.ts`.
- Moved onto it, with nothing drawn differently:
  - the cabinet boxes, the island boxes and their tops (`cabinets.ts`,
    `counter.ts`);
  - the placements and `islandPoint`/`islandAcross` (`layoutTemplate.ts`);
  - the hood centring and the island's facing and aisle checks
    (`layoutRules.ts`);
  - the hinge, trim-kit and return-wall code (`room.ts`);
  - the rough-in points, run and island alike (`roughIn.ts`);
  - the tower vent, the floor riser, the refrigerator clearance dimension;
  - the pin anchors, the label keep-outs and the fly-in target.
- Every `CabinetBox` has `facing`, set where the box is made. A run's boxes face
  the room. An island's face the cook's side, except the carcass behind an
  opening that faces the seats. Doors still guess until step 2.
- `orientationGuard.test.ts` scans `src` for a turn written by hand, a branch on
  an axis, a turn through three.js, a turn read by its size, and a facing guessed
  from proportions.
  - Run first against the code before migration, it failed on fourteen files.
  - That run also showed two holes in its own patterns, both closed: a turn with
    brackets inside its arguments, and a bare `axis === "x"`.
  - What is left is listed exactly: four files and eight hits for step 2, and
    `islandFor`'s two, where the orientation parameter becomes an axis. A count
    that is off either way fails, so a site moved without its entry being cut
    fails too.
  - **It cannot see an assumed back wall** — `hoodOutlet`'s `backZ`, the duct
    run's `-ROOM.halfZ`, the island aisle dimension, the hood placed on the
    range's run. Those are named for steps 2 and 3, not detected. **Nothing
    guards them.** Once fixed, a new position written against the back wall
    would raise nothing. *(Leo, round 50: after step 3, see whether the guard
    can take a rule that reading a back-wall constant outside `frame.ts` fails.
    Not now.)*
  - **Nor can it see "further along the run is to the right".** *(Round 70,
    Leo.)* It recognises a hand-written sine and cosine and a branch on an
    axis; it does not recognise code that simply adds a distance to a run's
    lower end and calls that end the left. That is true on the back run and
    backwards on the left run, and `roughIn.ts` did exactly that for every
    rough-in figure and every "cabinet to the left/right" from the day the left
    run existed until round 70 — while `alongIsToTheRight` sat in `frame.ts`,
    tested and unused. The guard passed it throughout. **What catches this is
    a test that states the answer from outside the code** (here
    `roughInSides.test.ts`) **or a review that asks what a line gives on the
    other run.**
- **A package's slots are the ones it declares.** The schema's list of core
  slots is gone. What the L template cannot build without is the template's to
  say, by name: `TEMPLATE_NEEDS`, today the range, the hood and the dishwasher.
  Step 3 turns the first two into "a cooking surface, and a hood over it".
  Package D with no microwave drawer and no wine column loads, builds and passes
  every rule.

**Step 2, report one, round 50.** *(The fly-in angle and its per-slot
acceptance are report two, next round.)*
- **Four places that guessed, now reading `facing`.** Each was pulled out into a
  plain function with its old logic, held to a test that reads only the
  island's extents and which run carries a machine, run red on the old logic,
  and then fixed. `orientationGuard.test.ts` has nothing pending.
  - Doors (`doorFace`): the box's own facing. On the island the working side's
    doors were inside the island; on the wall runs anything narrower than it is
    deep had its door on its side — the 21" drawer base beside package A's
    range, the 3" and 1/2" fillers, the side boards of the tall units.
  - The plan thumbnail (`planFootprint`): width across the face, turned with
    the machine. Every island opening in A, C and D is 24" by 24", so the swap
    could not show and the first run of the test passed on the old code for
    that reason. It is held on a cooktop island, whose 36" by 24" shows it.
    **The lesson (Leo): symmetry in the data hides errors in the logic.** A
    square opening, a box as wide as it is deep, a turn of zero — a case like
    that passes whether the code is right or not. A test case is picked for
    being lopsided, or it proves nothing.
    **The same trap one level up: the packages that ship.** *(Leo, round 55.)*
    A test run over "every package" is only as good as the coincidences those
    packages happen not to have. All four contain every slot their rules name,
    so a rule that files a line under `slot-wine` whatever the room holds passed
    over all four, every run. Round 55's checklist test built a package to
    E's shape — two columns, no wine, no range — and it failed at once. **The
    square openings were a coincidence in the dimensions; this was a
    coincidence in the catalogue.** When a rule names a slot, a feature or a
    count, build the package that lacks it rather than trusting that one of the
    real ones will.
    **And check the assertion ran (Leo).** A test that looks as if it covers a
    case and a test that got as far as checking it are two different things.
    The toe-kick test put its three facts in one loop over the runs. Run against
    the old code, it failed on the left run — the far end — and the loop
    stopped there, so the back run's two assertions that the kick breaks exactly
    at the range never executed against the old code. They ran and passed only
    after the fix. A red result says the first failing assertion failed; it
    says nothing about the ones after it. Same kind of trap as the square
    openings: something that reads as coverage and is not.
    **Round 52 hit it again** — `backWall.test.ts`'s "ends on the left wall"
    failed on its first line, the duct's end, so the two lines after it, about
    where a blower in that run sits, never ran against the old code. Twice in
    three rounds, so it is not bad luck: **it is what a multi-assertion `it()`
    does.** *(Leo, round 52.)* The rule from here: **an `it()` with several
    assertions only ever proves its first failing one.** Where more than one of
    them is the point, either split them into separate `it()`s — which is the
    default, and what the toe-kick test should have been — or say explicitly,
    when reporting the red run, which assertions were reached and which were
    not. Never report "this case failed on the old code" as though the whole
    case had been exercised.

    **And ask the assertion about the thing under test, not about its side
    effects.** *(Leo, round 53.)* Round 53's rule was "two machines set into one
    run get a board between them", and the first draft of its lopsided case
    asserted "no 3/4" panel stands against the lone microwave drawer". That
    failed — correctly — because package D's coffee cabinet has a 3/4" side of
    its own and it does stand there. **The room was right and the test was wrong
    about the room.** What says the thing meant is "no `spare-divider` part was
    ordered": it names what the rule makes, and nothing else in the kitchen can
    satisfy it or break it. A test written against a side effect fails when
    something unrelated produces the same effect — and, worse the other way
    round, passes when the part is missing and something else supplies the look
    of it.

    *Round 69, twice.* A test that a hood slid 6" along E's island fails as
    `d11-4` passed on the old code — because the old code failed every E room
    as `d11-4`, "no range on any run", and the check under test was never
    reached. Asked by its message, "off centre along the island", it went red.
    And a test that two island openings facing the same way fail as
    `d11-7-facing` went red on the old code for a different reason than the
    code's name: the old check returned nothing at all, because it read the
    room's own slots and ignored the ones it was given. A red run is worth
    reading for *why* it is red.

    **A test can guard the bug instead of stopping it.** *(Leo, round 61.)*
    `autoGrow.test.ts` held package D's left wall growing from 178-3/4" to
    178-7/8" when its columns went onto the back leg — `toBe(178.875)` — from
    round 35. That growth was the window bug (D18, rounds 60 and 61). For
    twenty-six rounds the test did not stop the bug; **it protected it**, and
    the fix was the first thing to turn it red. **A test locks in the behaviour
    of the day, not the right behaviour.** An expected value that came from
    "that is what it ran as" rather than "that is what it has to be" becomes
    the bug's bodyguard. So, when writing one: can the figure be given a
    reason? If it can, write the reason next to it. If it cannot, say so in the
    comment — **"source: measured, reason unknown"** — so that whoever turns it
    red knows it was never a requirement. The same rule as a figure in this
    file with no reason behind it (D17, round 61).

    **And the same assertion can give the opposite answer with a different
    input.** *(Leo, round 59.)* The round-59 smoke test "throws nothing going
    from A to D" was first written the way every other smoke test clicks, with
    Playwright's mouse, and run against the old code as this entry asks. **It
    was green** — on the code with the bug in it. Only after measuring that a
    mouse never triggers the throw and a script click always does was it
    rewritten to click from script, and then it was red on the old code with
    the very error, `setting 'dotX'`. Nothing in the assertion changed; the
    click did. So "run it on the old code first" is necessary and is not enough
    on its own: when a green run on the old code is a surprise, ask what the
    test does differently from the thing that showed the fault, before
    believing the fault is not there. It is also why the five older smoke
    tests that switch into D and assert no errors never caught it (D17, round
    59).
  - Rough-in leader lines (`leaderEnd`): out of the face the host opens by.
  - The wall anchor (`wallAnchor`): none for an island slot. Gas and water to an
    island slot are not drawn — no island slot has either yet; step 3.
- **Rule 4 on the island.** `cooktopLandingsIn` is the one figure: 15" one side
  and 12" the other, along the island, to its end or the next opening. The rule
  holds a room to it, and the generator refuses an island that falls short,
  offering the shortest island on the slider's step that has it — 66" for a 36"
  cooktop, since it is centred. `checkLayout` is not called by the app, so the
  rule alone would have let a customer drag the island to 60"; the refusal is
  what stops it.
- **CIT367YG is `drop-in`**, in `PUBLISHED_SPECS` from its guide's pages 6-8
  (Leo: how a machine installs is the manual's, as D4 says, the same road as
  PCG366W's `rangetop`). The sheet's Feature cell stays blank.
- **What the screenshots show, measured rather than eyeballed.** Before (the
  live site) and after, pixel by pixel. The plan thumbnails did not change at
  all in A to D, as the square openings predict. Elsewhere under 0.6% changed:
  the doors on an island turned across the room appear on its working side, and
  the edges of the tall units' side boards and the fillers change.
- **A dark band showed at the foot of an exposed run end, and is fixed in the
  same report** *(Leo: fix it before pushing — a customer would take it for a
  new bug)*. It showed at the side of package A's refrigerator tower, the end
  panel past the sink, and both ends of D's column group. The toe kick ran to
  the very end of the run, flush with the side of the last cabinet. The door
  wrongly on that side had stood 3/4" proud and covered the kick's end, so the
  band had always been there. A finished end goes to the floor, and the toe
  recess shows only at the front. The kick now stops 1-1/2" short of each run's
  far end — `TOE_SETBACK`, the same figure it is set back at the front and the
  island's is set in by all round.
  - Its break at a freestanding range, or a freestanding refrigerator, is still
    exactly at the machine's side, and the run's start still meets the wall or
    the corner cabinet.
  - `layout.test.ts` now states those three facts separately. It used to say
    the kick ran the whole leg less the range, which at the far end held the
    mistake in place; correcting it is the fix, not a concession.
  - Last round's report said three tests stood on the old length. Only that
    one did; the toe-kick checks in `packageLayouts` and `packageD` are about
    the refrigerator and the oven tower and pass unchanged.
- **Fillers and finished boards have no door** *(Leo)*. With doors on the face a
  box records, a 3", 2" or 1/2" filler, a tall unit's side board and the boards
  stacked on them got a door-board on their fronts. It was too narrow for a
  frame or a panel, so it looked like a strip, but it came from the door code
  with a door's reveal each side. The box now records `face: "strip"` where it
  is made, from what it is ordered as — a filler or panel module, or a tall
  unit's two side boards — and it is drawn as one flush strip with no reveal.
  `cabinetFronts.test.ts` failed on all four packages before the change.
- **Measured again after both.** The dark band is gone, and so is the door on
  the side of the wall run's end fillers. The plan thumbnails are still 0
  pixels changed. Under 0.6% changed elsewhere, at the board edges and the
  island's doors. The red over "Drag to rotate" in the diff is the hint text
  fading at a different moment, not the scene.

**Step 2, report two, round 51: a fly-in is relative to the machine's front.**
- **What the stored figure means now.** `bestView.azimuth` is how many degrees
  off the machine's front the camera comes in. Positive leans toward the far
  end of what the machine stands on — the run or the island — which is away
  from the room's inside corner, +x along the back run and +z along the left
  one. Negative leans toward that corner. The machine's own turn is added in
  `flyInAzimuth` (`src/data/flyIn.ts`). Pitch is unchanged.
- **The default offset is 45°, toward the far end** (`FLY_IN_OFFSET_DEG`; a slot
  that leaves the azimuth out gets it). A new machine takes it and is only set by
  hand if its screenshot shows a reason.
  - 45° is the default overview's own angle, 45° round from the back wall, so a
    fly-in at 45° off a back-wall machine is the overview turned to face it.
  - Seven of the eleven angles hand-set before this were 40° to 55° off their
    machine's front.
  - Toward the far end because that is where the room is open. Toward the
    inside corner the camera looks across the tall units that finish the other
    run.
- **When the rule and the picture disagree, the rule does not move.** *(Leo,
  round 52.)* A uniform rule will one day produce a view somebody does not
  want — a camera that arrives looking through a bank of wall cabinets, a
  window blowing out the exposure behind the machine. What happens then is
  **that slot gets a hand-set azimuth of its own, and the reason is written
  next to it**: "the wall cabinets by the window block the 45°", not a bare
  number. The rule stays the default; the hand-set value is the exception; and
  **an exception has a source, the same as every other figure in this
  project**. What must not happen is the default being changed
  to suit one slot — that moves every other machine to fix one picture, and the
  reason is then recorded nowhere at all.
  ⚠️ **This is written down precisely because it has never been used.** Round
  51 looked at all thirty slots and hand-set none of them, so there is no
  worked example to copy and nothing in the code that shows the shape of an
  exception. **A rule is at its weakest before its first use:** the next person
  to meet a slot that needs a different angle will be looking at one hand-set
  value against a rule that has never had to bend, and the natural move is to
  change the rule. It is the wrong one.
- **This round named a rule that was already being followed.** *(Leo.)* Read
  against the machine's front and the far end of its run, the angles hand-set
  over a dozen rounds turn out to be the same judgement each time: 45 degrees
  for a refrigerator whether it stands on the left wall or the back one, 40 for
  the range, 55 for the dishwasher. They were set by eye, one at a time, with no
  words for what they had in common, so each new machine was tuned from scratch.
  Only two figures were a compromise rather than a judgement — package B's
  dishwasher and package D's wine column — and only because one absolute number
  had to serve two orientations at once. So this is not twenty-odd angles
  re-decided; it is a name for what was there.
- **The rule does not depend on which way the room faces.** "Off the machine's
  front, positive toward the far end of what it stands on" is written in the
  machine's own terms and the strip's, never in the room's compass. It holds
  when the L is mirrored, when the island turns across the room, and it will
  hold for the U-shaped and galley templates without being defined again.
  - ⚠️ **"Relative is sturdier than absolute" is not a rule to apply
    everywhere.** *(Leo, round 57.)* It was right here because a fly-in angle
    is the code's own representation of a view, and nobody outside the code
    says it in any terms at all. Round 56 nearly applied it to the order of a
    column bank — "state it from the landing outward, so it holds on either
    leg" — and that would have been wrong: the order of a bank is a site
    practice, it is absolute, and making it relative would have put into the
    data a notion that does not exist on site. **The test is how the thing is
    said where it is done.** An installer is told "the wine goes to the right
    of the fridge", not "the wine goes at the end furthest from the landing".
    Where a rule is somebody's practice, write it the way they say it; where it
    is the code's own device, choose whatever holds up best.
- **Nearly every hand-set angle was this rule already.** Read against the
  machine's front and the far end of its run, a back-wall and a left-wall
  refrigerator stored as 45 are both 45° toward the far end. So is the range's
  40, the dishwasher's 55 on the back run, the island wine cabinet's 20. Those
  figures did not change, and neither did the view in the package that set
  them.
- **Recomputed to a new figure, same view where it was set:** the island
  microwave drawer, 210 → -30 (30° toward the inside corner, as it was with the
  island along the back wall); the second dishwasher, 55 → 35 (package D's left
  run, as it was); the cooktop, 240 → -60 (no package has one; round 49's
  prototype angle with the island along the back wall).
- **Views that change**, because one absolute number had served two
  orientations:
  - package A's island microwave drawer and wine cabinet with the island turned
    across the room — before, 60° and 70° off their fronts; now 30° and 20°, as
    along the back wall;
  - package B's dishwasher on the left run, 35° → 55° off, as on the back run;
  - package D's wine column on the left run, 70° → 20° off, the wine slot's own
    figure.
- `flyIn.test.ts` ran red on the old absolute angle for the island pair and the
  dishwasher; the refrigerator and "the camera is in front of every machine"
  passed on it as well, as they should. Each red test failed on its first
  assertion, the angle off the front, so its second — the side it leans to —
  did not run against the old code.

**Step 3, round 52: the hood over the island, and the wall that was assumed.**
- **`src/data/roomWalls.ts`, where a facing becomes a wall.** `wallBehind` takes
  the way a thing faces and gives the wall it backs onto; `againstWall` gives
  the point on that wall, level with the thing and standing off it. Written in
  the facing's terms and not the room's, so a machine facing -z backs onto
  +halfZ and the U-shaped and galley templates need no new rule.
  - A module of its own rather than the bottom of `frame.ts`, and the reason is
    a load-time cycle: `frame.ts` → `roomShell` → `layoutPolicy` → the rules
    parser → `frame.ts`, which leaves the parser undefined and takes twenty test
    files down. Everything about *which way* stays in `frame.ts`; this is the
    one module that also knows how big the room is.
- **The four sites, each with a case that fails on the old code first.** All
  four are on a wall the app cannot put a machine on today, so none of them
  could show in a screenshot; `backWall.test.ts` states them as the room and the
  machine, never read back from the code.
  - `hoodOutlet`: six inches out of *the canopy's own back face*, not six inches
    off the back wall. A hood on the left run had its duct hole on the wrong
    axis, half a foot out.
  - `ductRoute` (lifted out of `UtilityLayer`): a `back-wall` duct goes through
    the wall that hood is against. It used to go to `-ROOM.halfZ` whatever the
    hood hung on, which for a hood on the left run is a duct across the kitchen.
    And **a hood over an island runs up whatever its route says** — there is no
    wall behind it, so the alternative is a duct into thin air.
  - `wallAnchor`: the facing was already right after step 2; the wall was still
    `-ROOM.halfX` or `-ROOM.halfZ` written out here.
  - The hood is placed over **the cooking surface**, which is a range on a run
    or the island's cooktop, and `TEMPLATE_NEEDS` now asks for "a range or a
    cooktop, a hood, a dishwasher". A package with no range used to throw on its
    way out of the generator, so package E's shape could not be declared at all.
- **A hung hood's own figures.** Over the island it hangs at `undersideIn`, the
  72" D20 settled, not at a clearance over a cooking surface three feet away;
  and it is centred on the cooktop rather than offset to sit flush with a
  cabinet face it is nowhere near. The second was the prototype's, not a test's.
- **An island machine's services come up through the floor — all of them.**
  `serviceRoute` is one answer for gas, water and power: a wall anchor, or the
  riser. Power already asked `islandRiser`; gas and water asked `wallAnchor`,
  got nothing and **drew nothing**, so an island slot with a gas cooktop or a
  prep sink would have been a machine with no services at all in the view that
  exists to explain services.
  - **Nothing showed because nothing asked.** The island's three machines are a
    microwave drawer, a wine cabinet and an induction cooktop, and not one of
    them takes gas or water — so the layer drew its `null` and no screenshot
    could ever have caught it. **After E it stops being hypothetical:** a gas
    cooktop in an island and a prep sink in an island are both ordinary, and the
    first one specified would have been a machine with no services drawn. Worth
    recording as the shape of the bug rather than as a line of code: *a branch
    that returns nothing is invisible until the case that needs it exists*, and
    those are found by asking what a package could ask for, not by looking at
    what it does ask for. *(Leo, round 52.)*
- **The new guard, and what it still cannot see.** *(Leo: confirm it is red
  before listing the exceptions.)* Every read of `ROOM.halfX`/`halfZ` outside
  `roomWalls.ts` fails, and the reads that are genuinely about the room's *size*
  are listed by file with an exact count, both ways, like the first guard's. Run
  against the code before this round it fails on `wallAnchor.ts` and on
  `UtilityLayer.tsx` at five where one is allowed.
  - It catches two of this round's four. **`hoodOutlet`'s was written as the
    machine's own coordinate — `slot.position[2] - depth/2` — and no pattern
    over spelling would have found it.** This narrows the hole; it does not
    close it.
  - **And that kind cannot be tested for at all.** *(Leo, round 52.)* A line
    that reads as the machine's own frame — its position, its depth, its own
    half — and quietly means the room's, because the machine has only ever
    faced one way, is indistinguishable from a correct line by any rule over
    the text. **It is found by reading the code and by prototyping, and by
    nothing else.** So do not look for a cleverer pattern when one of these
    turns up: look at what the line would give for a machine turned a quarter,
    and build the case that shows it. Both guards are floors under the review,
    not substitutes for it.
- **Nothing in packages A to D moved.** The overview and the install view of all
  four, live against local, pixel by pixel: **zero pixels changed in all eight**.
  That is the expected answer and not a weak one — every site fixed is on a wall
  or an island the app cannot reach yet, so a change in those pictures would
  have meant a change nobody asked for.
- **What the prototype showed that the tests did not** (`?islandCookProto=1`,
  package A with its cooking moved to the island; not committed).
  - The page **crashed**: `dimensions.ts` set its whole chain out from the range
    segment on the back run, and there was no range. It now sets out from
    whichever cooking surface the package has, in that machine's own frame when
    it is in the island — which made the overlay draw, hanging in the middle of
    the room, and was never an answer to where it belongs.
  - **Where an island's chain goes, settled.** *(Leo, round 52.)* **Against the
    island's working-side edge**, not floating in the room. The reason is what
    the lines are for: rule 4's island landings are 18" and 18", a figure
    settled on purpose, and when a customer asks whether there is room either
    side of the burners these lines are the answer. Drawn against the edge they
    mean what they mean against a wall, so nobody has to learn a second reading.
    ⚠️ **And they turn with the island** — through `frame.ts`, not a second
    copy of the turn. Not yet built.
  - **Two figures in that chain are wrong over an island. They are known, and
    they are deliberately left for E** *(Leo)* — **not a new bug for the next
    person to chase**: the cooking-surface height reads 4" instead of the glass
    at 36-1/4", so the clearance under the canopy reads 68" instead of 35-3/4",
    and the note beside it still quotes the gas minimum (30"-40") at an
    induction hob. Nothing ships with them: no package has an island cooktop, so
    A to D take the range branch unchanged, which the zero-pixel diff shows.
    *Fixed in round 69, before E went live* (Leo: a customer would see a gas
    figure over an induction hob at once). The chain chose its cooking surface
    by `SLOT_BY_ID["slot-range"] ?? ...`, and `SLOT_BY_ID` holds every slot
    whether the package has it or not, so E's cooktop was measured against a
    range that was not in the room. It now takes a range on a run first and the
    island's cooktop otherwise; the glass reads 36-1/4" and the clearance
    35-3/4"; and the note is the island hood's own — 30" minimum, gas or
    induction, HMIB42WS's guide page 9 — with no maximum, because the guide
    gives none.
  - The hood's callout still hangs at the island counter, 5' under the hood, as
    §"package E" already records. *Fixed in round 68*: the island's anchor —
    0.7' over the counter, which keeps a machine set in the island readable
    from both sides — is for machines in the island. A hood hung over it
    takes the top corners of its own canopy like any wall machine
    (`pinAnchor.ts`, through `applianceBox` and `toPlan`), and `applianceBox`
    already has the canopy at 2-3/4" rather than the catalogue's 30"
    (round 55).

**Round 55, the first of four before package E is configured.** Three things
that had to be fixed before E could even be looked at without a patch, all three
found by the round-54 prototype rather than by any test.

- **A rule does not report against a slot the package has not declared.** The
  install checklist groups its lines by slot and looks each one up by name, so a
  line filed under a machine the room does not contain is `undefined.labelKey`
  — **the whole right-hand column, gone**. The line was the COMBIKIT between two
  refrigeration columns, filed under `slot-wine` outright because package D's
  bank happens to end with a wine column; E's bank is a freezer and a
  refrigerator. It is now filed under a column the kit is actually between.
  `checklistSlots.test.ts` holds every package to it, E's shape included,
  because the four that ship all happen to contain the slots their rules name
  and would never show it. `useChecklist` grew a plain `checklistFor` so the
  test can ask without React.
- **A hung hood's body is its canopy, and three things stop disagreeing about
  it.** HMIB42WS's catalogue `heightIn` is 30", the assembly collapsed for
  shipping; the canopy is 2-3/4" of that (D20). `hoodBodyHeightFt` says so once,
  and the duct outlet (was 102", now 74-3/4", the canopy's actual top), the
  damper (was 110-3/8" — *through* a 108-1/2" ceiling — now inside the room) and
  the install outline (was a 30" box round a 2-3/4" canopy) all follow it.
  **One cause, one fix, three symptoms**, and the third had been carried as its
  own open item since round 47.
  - ⚠️ The first draft dropped the middle term of the height fall-back and
    `applianceBox.test.ts` caught it on AK7136AS-BF, an under-cabinet hood that
    publishes a cutout height and no body height. The existing suite earning its
    keep on a change that never looked near it.
- **The sight-line fade reaches the appliances.** It was written for joinery,
  because in A to D nothing but joinery ever stands between the camera and a
  machine. E hangs a 42" hood in the middle of the room, and flying to the
  combination oven behind it put the hood flat across the oven's face, solid, in
  the shot that sells the oven.
  - ⚠️ **Not in install mode**, where the whole appliance layer has already
    stepped back and taken no clicks: the two writes would each restore what the
    other saved.
  - ⚠️ **And "in the way" is measured in the machine's own frame, not along the
    camera's axis.** The first draft used the distance along the ray and it was
    not enough — the view is a 45-degree isometric, so a column two feet to one
    side is already a foot and a half nearer the camera, and package D's freezer
    went to glass beside its refrigerator. **How far in front one machine stands
    of another is a fact about the room; how far along a ray it lies is a fact
    about where the camera happens to be.** A machine is in the way when it
    stands further out of the selected machine's face than that machine is deep:
    the hood five feet in front of the oven fades, the column flush beside
    another does not.
  - Measured after: **all twenty shots of packages A to D unchanged, to the
    pixel** — the three fly-ins per package included, which are the shots that
    could have moved. In the prototype, flying to the combination oven now fades
    `hood-island` and flying to the hood fades neither it nor anything of its
    own.

**Whose fact is it — the room's, or the camera's?** *(Leo, round 55, and wider
than the fade.)* The rule that fixed it — **how far in front one machine stands
of another is a fact about the room; how far along a ray it lies is a fact about
where the camera happens to be** — is the same disease `frame.ts` was built to
cure: a question that belongs in the machine's own frame, answered in the
room's axes or the camera's. The sixteen places in round 49 answered "which way
does this face" in the room's axes; the first draft of this fade answered "is
this in the way" in the camera's. **Before any judgement of the kind — is it in
the way, is it near, does it face — ask first whose fact it is.** If the answer
would change when the camera moves, it was measured in the wrong place.

**And a limitation of the template, recorded so it is not mistaken for a
design.** `inRunGroup` puts **every** tower marked `beside: "run"` on the one
leg `coffeeLeg` names. Packages A to D have at most one such tower, so it never
showed; package E has two — a 30" combination oven and the coffee cabinet — and
they are welded to the same leg. With both on the left leg, together with the
column bank, E asks for 176-1/8" of wall and is refused (the refusal does offer
the fix, `coffeeLeg: "back"`). **E therefore puts both on the back leg, and that
is a constraint it is working around, not a decision about where they belong.**
*(Leo, round 55: splitting them across two legs is not being built now.)*

**Round 56, the second of four: the configuration layer.** No package E in
`packages.json` yet — only what its configuration will need.

- **A package can say what its island is.** `defaultLayout` gains
  `islandLengthIn`, `islandDepthIn`, `islandOverhangIn` and `aisleIn`. The
  state layer already spread whatever `defaultLayout` held; what was missing was
  the schema, and zod drops a key it does not name, so writing E's island into
  the file would have been thrown away without a word.
  - **The island figures belong to the package that names them.** Leaving a
    package that named one for a package that does not puts the ordinary figure
    back, so E's 15" overhang and 48" aisle do not follow the customer into
    package A. Between two packages that name nothing — every switch among A to
    D — the customer's island is left exactly as it was, as before.
  - A to D name none of the four, and the twenty shots of them are unchanged
    (below).
- **The aisle in front of a cooktop is 48".** `LAYOUT_LIMITS.cooktopAisleIn`,
  from this entry's D20. Held by the rule and by a refusal that offers 48" —
  the refusal because the app never calls the rule, which is round 50's lesson
  about the island landings.
  - ⚠️ **And a hole in the rule, found on the way.** The aisle check sat inside
    rule 7's block about the microwave drawer and the wine cabinet, which runs
    only when the island carries both. Package B's prep island — its wine is a
    column — never had its aisle checked, and an island with a cooktop and
    nothing else would not have either. It now runs for every island. Every
    package that ships passes it as built.
- **Thirty-six older tests went red, and the cause was proved before a line of
  them was touched.** Every one built a cooktop island at the ordinary 42". An
  A/B with the new figure set back to 42 turned all thirty-six green and only
  the four tests asserting 48 red, so the refusal was the whole of it. The
  fixtures now declare their aisle.
  - Five were not that simple, and it was the test harness. Tests reset the room
    by *switching* to package A, and a switch can be refused — a room a previous
    test had grown for a turned island would not take A's window evenly — and a
    refused switch correctly stays where it was. The next line then set A's
    parameters on the cooktop package, and the next "switch" to it did nothing.
    It never mattered until a package's own defaults had to be re-applied.
    `testRoom.ts`'s `resetRoom` is a reset nobody can refuse; the island tests
    use it.
- **Which way round a two-column bank stands**, and the two free-standing
  towers pinned on one leg, so lifting either is a change somebody makes on
  purpose. *(Round 57: the bank test was written against D20's old "next to
  the landing" wording and only on the left leg; it now states the order left
  to right, as the rule is, on both legs and for package D as well.)*
- **Corrections to rounds 54 and 55.**
  - E's island cabinets are **24"**, as this entry says. The round-54 prototype
    used A to D's 36", and the 163" of wall it reported was that island's. With
    D20's island and the 48" aisle the figure is **157"**, D20's own, and it is
    corrected where round 55 wrote it.
  - Round 55's report gave the prototype's cooking aisle as 43". It was 42", the
    ordinary default: the arithmetic took one 1" lap off instead of two. The
    rule itself measures it correctly.

**Round 58, the third of four: a duct that goes through the ceiling says so.**

- **Look in the manual for the part before proposing it.** *(Leo, round 58.)*
  The first idea for an island hood's duct cover was a trim ring where it meets
  the ceiling — "there is usually one there". HMIB42WS's guide has no such part:
  a template on the ceiling, a support structure screwed to it, and the upper
  duct cover slid up that structure and fixed to it, so the cover meets the
  ceiling directly. The ring would have been a part invented from general
  building sense and drawn as though it came with the machine. **Knowing what
  is usually at a place is not knowing what this model puts there.** Before
  proposing a part, find it in the model's own documents; if it is not there,
  say so and draw nothing for it.
  - And it would not have worked either: the view looks down on the room, so a
    ring at the top of the cover reads as a slightly wider cap, which does not
    say "ceiling" any more than the bare cover does.
- **`through-ceiling` is a route.** The geometry did not need it — an island
  hood's duct already ran up whatever it was told (round 52) — but three pieces
  of text were driven by the route and all three were wrong:
  - **the spec card** said "Up through cabinet". Package C's said so on the live
    site, looked at in round 58: HMCB30WS, a chimney hood with its cover running
    to the ceiling and no cabinet anywhere over it. It now says "Up through the
    ceiling";
  - **the duct's callout** said "cabinet floor needs a cutout; the duct passes
    through the cabinet". Over an island it now says through the ceiling to the
    roof, 8" round, a metal vent cover where it leaves the house, and cites
    HMIB42WS's guide, page 12. For C it says the duct rises inside the chimney
    cover to the ceiling and there is no cabinet to cut — and cites nothing
    further, see below;
  - **the outlet size** over an island was the wall canopy's rectangular collar.
    HMIB42WS's guide gives an 8" round transition, and that is what it says now.
- **Package C's value is `through-ceiling`, and its source is thinner than the
  island hood's.** HMCB30WS's sheet (the only HMCB30WS document in the repo,
  page 2 of 3) draws the chimney cover to the ceiling — 30"-42" from the
  canopy's underside to the top of the chimney, an extension kit for ceilings to
  12' — and it has no cabinet over it. It does not state a duct route. The
  generic Thermador ducting sheet shows a wall hood ducted straight up through
  the ceiling as a configuration. A chimney hood could also turn its duct out
  through the wall inside its cover, and nothing in the repo rules that out; if
  HMCB30WS's installation guide says so, this is a value to change, not a third
  route to add.
- **The foot of duct past the ceiling is drawn for a hood over an island only.**
  Dashed grey, D21's reviewed-but-inferred tier: the configuration is in the
  guide, and that the duct rises from the middle of the canopy follows from the
  cover being centred rather than being drawn there. C's duct stops at the
  ceiling as before, because the one document that would show where it goes
  next is not in the repo — and so package C's install view did not change.
- **A hood over an island declared up through a cabinet or out through a wall is
  thrown where it is placed** (`assertHoodRoute`). Round 52 had sent such a duct
  up anyway, silently. Eighteen existing tests were refused by it at once, every
  one with the check's own message: island hoods built from package A's hood
  slot, which is `up-through-cabinet`. They now declare the route their guide
  shows.
- **Materials mode draws nothing new**, as settled.
- **Measured.** Twenty shots of A to D, live against local, `?quality=high` on
  both sides: nineteen unchanged to the pixel, and package C's install view off
  by **3 pixels, none by more than 32 levels**, on the anti-aliased edge of the
  Materials button — an HTML control over the canvas, not the room. Two local
  runs of identical code differ by 3 pixels in the same band of that button, so
  it is the button's edge and not this change. C's spec card, read on the local
  build: "8\" · Up through the ceiling · 600 CFM". In the prototype, E's card
  says the same and its install view shows the dashed foot of duct above the
  cover.

**A rough-in point's left and right are the installer's, and are worked out
once.** *(Round 70, Leo.)* Left and right are said standing in the room facing
the cabinet, because that is how they are said on site (round 57's test: how
is this order spoken where it is built?) — not "the tower side", not "further
along the run".
- `resolveRoughIn` decides a point's `sides` — the side its figure is measured
  from, and for a neighbour's cabinet which side of the machine that cabinet is
  on — through `alongIsToTheRight`, places the point by them, and hands them on.
  `roughInSentence` reads them and never works them out again. Round 70 found
  the two had been separate derivations, each wrong in its own place (D17's
  table, sixth row).
- **Measured from:** in the machine's own opening and in the sink base, the
  left side panel, as a manual dimensions it. **In a neighbour's cabinet** —
  `adjacent-cabinet-left/right` and `beside-tower` — **the side that meets the
  machine.** Beside a tower that was already the rule and only the sentence was
  wrong. For the other neighbour's cabinets it is new, and inferred: of the
  three points that use one (T36BT120NS's socket and water, PCG366W's socket,
  T18IW100SP's socket), none has a drawing that says which side the figure is
  from. T36BT120NS's drawing has "in an adjacent cabinet" and sketches the
  socket just past the opening's side wall; near the machine is what adjacent
  is for; and it keeps the point by the machine when the cabinet on the other
  side is the one taken, which package A does with its refrigerator on the back
  run. The provenance stays `inferred`, with the reason in the point's `basis`.
- **A neighbour on the wrong side is said as it is.** Where the side the data
  names has no cabinet, `pickNeighbour` takes the other side's, and the
  sentence now names the side it took.

**And the cabinet has to be a cabinet.** *(Leo, round 71, from site:)*

> 如果条件允许，插座和进水口都是安装在靠近机器的、有橱柜的一侧。

Two layers, and the code does both. **(a) The box picked is a real cabinet** —
one with a door or drawers: `base`, `drawer-base`, `sink-base`, `corner`, or a
`tall` one that holds no machine. A 5/8" column spacer (the COMBIKIT between
two refrigeration columns), a 3" finished end panel and a filler are joinery,
and `pickNeighbour` passes over them; a segment holding a machine stops the
search, because past it is another machine's business. Until round 71 anything
that was not an appliance would do, and package B's refrigerator had its socket
drawn 6" past a 3" board — outside any box at all — on the live site.
**(b) In that cabinet, the figure is from the side that meets the machine**
(round 70, above).

**Where neither side has one, the model's own data says what is done instead.**
`whenNoCabinet` on the point (`schema.ts`): where it goes, its figures, its
provenance, and a `conditionKey` for anything that has to hold. Two entries so
far, both from the models' sheets:
- **T36BT120NS**, package B's refrigerator, which stands in a column bank with
  a spacer one side and a board the other in every arrangement B builds: the
  socket goes **behind the appliance**, the sheet's own alternative (p. 4, B),
  with the checklist adding that it is permissible only where a breaker can
  switch the outlet off. The water goes behind it too — Leo's site practice,
  the sheet saying only that it must be reachable afterwards.
- **PODS302B**, package D's oven where the coffee cabinet is on the back leg
  and the only thing beside the tower is a 6" filler: the junction box goes in
  **the drawer under the opening**, which the sheet allows (p. 2: above,
  beneath, left or right). Not above: the cabinet over a steam oven stands off
  the wall with an open back, and that gap is the steam's way out (D11 rule 12).
- ⚠️ **It is the way out, not the machine's address.** The code asks the room,
  every time: a real cabinet on either side and the point goes in it. B's
  refrigerator in an arrangement that gives it a cabinet would take the
  cabinet. Written as "B's refrigerator goes behind itself" it would be wrong
  the moment the customer moves something.
- **A point placed this way is drawn in the reviewed-to-confirm tier** — grey
  dashed — whatever its own provenance, and says so on the list: "No cabinet on
  either side, so this connection goes behind the appliance." *(Leo, round 71.)*
  T36BT120NS's socket is on its sheet and still dashed: what the drawing
  allows in a room that does not allow the recommendation is a fallback, and
  the install view should not show it as settled. `tierOf` in `roughIn.ts`.
- **And nothing may quietly fall through.** `roughInCabinet.test.ts` holds every
  package in every arrangement: a point in a neighbour's cabinet is in a real
  cabinet, or it is one of these recorded ways out. A model that one day has
  neither turns the suite red rather than losing its line.

**A machine on the island keeps its points, including the ones above it.**
*(Round 72.)* `hostFor` looks a machine up among the wall runs; an island
machine is in none of them, and every location but `in-cutout` returned null —
silently, so the line was simply absent. Round 49's sweep found it and round 52
set the order: the data first, then the fix, so that the fix has something to
be held to. Package E's island hood supplied it.
- **`at-ceiling`**, new this round: what has to be in place before the ceiling
  closes, for something that hangs from it. The box is the machine's own
  footprint, as deep as the 2x4 cross framing the hood's guide asks for between
  the joists (HMIB42WS p. 13), turned with the machine on the island. The hood's
  8" duct hole and its supply are both roughed in there — the guide's own
  template marks the duct hole and the screw holes on the ceiling before
  anything goes up (p. 14).
- **`yFrom: "top"`**, also new: a height the manual gives downward stays
  downward. CIT367YG's junction box is "approx. 12in" below the cooktop
  (pp. 8-9); as a height off the cabinet floor it would have been a figure
  nobody could check against the guide, and the sentence says "12" below the
  top" so nobody measures from the wrong end.
- **`z: "center"`**: the middle of a box's depth, which is where an island
  hood's duct leaves it. Rear and front could not say it.
- `islandRoughInHost.test.ts` holds E's hood at the ceiling and over the island,
  its duct hole centred on it, E's cooktop's junction box 12" under the
  countertop, and **every package drawing as many points as its models record**.
- Held by `roughInSides.test.ts`: every package, every arrangement it builds
  (sink leg, refrigerator end, coffee leg, island orientation), every point —
  the side the sentence measures from is the side the point is that far from;
  the cabinet it names is on that side; a neighbour's figure is from the side
  that meets the machine; and the point is inside its box. It works out left
  and right from the run's wall, not from the code. On round 69's code it
  failed 64 of its checks, each for a reason read and accounted for.
  - ⚠️ **Symmetry hid half of it once already.** The first script written to
    look for this judged four of D's arrangements right, because there the
    cabinet beside the tower is 6" wide and 3" from either side is the same
    point. The test does not ask how far; it asks which side meets the machine.

## Open items

Registered, not scheduled. None of these is a round of its own.

- **GitHub Actions on Node 20.** Since round 35's deploy the Pages workflow
  warns that `actions/checkout@v4`, `actions/setup-node@v4` and
  `actions/upload-artifact@v4` target Node 20, which GitHub is retiring, and
  are being forced onto Node 24. Nothing fails yet. Move them to releases that
  target Node 24 alongside some other change to the workflow. *(Noted
  2026-09-13, round 36, Leo: not urgent.)*
- **Smoke results before round 38 are of doubtful weight.** In round 37 the
  first full smoke run had its setup fall over and all twenty-five tests were
  skipped. The run was reported as exit code 0 because the command piped
  vitest's output through `grep`, and a pipe returns the last command's
  status, not vitest's. Vitest itself had failed. Every earlier smoke result
  that was read through a pipe could have hidden the same thing, so the
  history before round 38 — when the suite started asserting that all 25
  tests ran — is not proof they passed. Read the exit code from vitest itself.
  *(Noted 2026-09-13, round 39, Leo.)*
- ~~**D11 rule 9 is `d11-8` in the code.**~~ **Renumbered in round 69**, with
  rule 7's rewrite, as this item asked. The rule that a dishwasher's power,
  water and drain land in the sink base is number 9 in this file and fails as
  `d11-8` in `layoutRules.ts`, where the comment calls it rule 8. The numbering
  here is the authority; the code has not been renumbered, so a finding shown
  as `d11-8` means rule 9. Renumber with some other change to the checker.
  *(Noted 2026-09-14, round 41, Leo: not this round.)*
- **Two install-view planes are outside D21's three tiers.** The vent in the
  top of a hung oven's opening (`towerVents`, drawn in `RoughInLayer`) and the
  duct hole in the floor of the cabinet over a hood (`DuctRuns` in
  `UtilityLayer`) are still flat duct-grey planes. Both are figures from site
  practice or a generic route, not from a drawing, so they belong in a tier and
  in the rough-in list. *(Noted 2026-09-14, round 42, Leo: not this round.)*
- **Package C's rough-in is mostly unrecorded, and some of it can be.** Of C's
  six machines only MD24BS has an entry in `data/rough-in.json`. T36FT820NS,
  MFGS4030RS, HMCB30WS, SHX78CM5N and PRW24C01CG have none: they are not yet
  reviewed, not "the sheet has nothing". Three of them already have a drawing in
  `docs/reference/` — `t36ft820ns-spec.png`, `hmcb30ws-spec.png`,
  `mfgs4030rs-front.png`. This is work to do, not where it ends. *(Noted
  2026-09-14, round 43, Leo: not this round.)*
  - ⚠️ **Read in round 72: those three drawings carry no connection at all.**
    T36FT820NS's is page 3 of a 4-page sheet — overall dimensions, the door
    swing and the accessory list, and nothing electrical or plumbed.
    MFGS4030RS's is a photograph with three overall figures on it.
    HMCB30WS's gives the hood's dimensions and its chimney's, and the one
    figure that might be a service — a 5" from the hood's left edge to a dot on
    the back — is unlabelled, so it cannot be read as the duct or the supply
    without guessing. **What C needs is the four installation manuals, which
    are not in the repository** (the 43rd round's "their points can be read off"
    was written from the file names, not from the drawings). Until then C's
    five machines keep the generic runs, which say they are not reviewed.
- **One click, two outcomes.** In round 44 a click at the same screen point on
  the refrigerator's water point, with the same fly-in, showed no callout in one
  run and the callout in the next. The cause was not found. Clicks work and the
  rough-in list reaches every point, so it is not chased now. *(Noted
  2026-09-14, round 45, Leo.)*
- **A React style warning from the wall sliders.** `Slider` in
  `src/ui/primitives.tsx` sets `background` and `backgroundSize` on the same
  input, and React warns about mixing a shorthand with one of its parts on
  every rerender. It came in on 2026-09-06 (`db0c9a8`, the feasible band under a
  wall slider), well before rounds 40-45, so it was not touched. The fix is to
  set `backgroundImage` instead of `background`. *(Noted 2026-09-14, round 45,
  Leo.)*
- **Is a freestanding refrigerator in package A's slot drawn right?** The list
  offers one (D20, round 46), and D11 rule 11 was written for package C, where
  the refrigerator stands at the end of a run with nothing built round it. A's
  slot is at the end of a tall bank with cabinets round it, which is not the
  same case. It deserves a test of its own. *(Noted 2026-09-14, round 46, Leo:
  not now.)*
- ~~**The install view's outline round an island hood is a 30" box.** The
  outline round every appliance is a box its catalogue `heightIn` tall, and
  HMIB42WS's is the collapsed 30", so in the view that exists to explain
  installation the outline is ten times the 2-3/4" canopy it surrounds.~~
  **Fixed in round 55, and it was never its own bug** *(Leo)*: it is the third
  symptom of one cause. Three things read "the top of the hood" off that 30" —
  the duct outlet, the damper above it, and this outline — and all three were
  27-1/4" out. `hoodBodyHeightFt` answers it once. *(Noted 2026-09-14, round 47;
  closed 2026-09-16, round 55.)*
- ~~**Two rule numbers do not say which rule failed.**~~ **Done in round 69**:
  `d11-7-facing`, `d11-7-aisle`, `d11-7-seating`, `d11-9` (D11 rule 7). Rule 7's facing check and
  both aisle checks all fail as `d11-7`, and rule 9 fails as `d11-8` (above).
  Sort both out when rule 7 is rewritten for E, when it may become four checks.
  *(Noted 2026-09-14, round 48, Leo: not a round of its own.)*
- **A hood over an island is held exactly centred.** The check allows no offset
  on either axis, so an island hood moved a little for its duct would be
  refused. Recorded, not changed. *(Round 48, Leo.)*
- **One axis written in, found in round 49 and not fixed.** A sweep for
  positions and checks that assume one axis or the back wall, done with the
  riser fix. Real now *(checked against the code and the tests in round 70,
  item by item; four of the five were fixed in rounds 50-51 and this entry was
  never updated)*:
  - ~~`PlanThumbnail.tsx` swaps width and depth for any turned slot, so the
    parallel island's microwave drawer is drawn sideways on the plan.~~
    **Fixed in round 50** (`89237c3`): `planFootprint` turns the size with
    `sizeOnPlan`. Held by `islandFacing.test.ts` — "draws the 36 inch cooktop
    36 inches along the island, not across it" (the cooktop, because every
    other island opening is square and passes either way) and "draws each
    machine on the plan with its width along the run or the island it is on",
    both with the island laid either way.
  - **The island aisle dimension (`dimensions.ts`) is drawn from the back run
    even when the island is turned and its aisle is to the left run. Still
    open.** Checked in round 70 on package A with the island perpendicular:
    the line runs from the back run's counter edge to the island's *end*
    (z −47" to −5", at x −4"), not across the working aisle to the left run.
    Its figure reads 42", and the aisle to the left run is 42" too — **by
    coincidence**: both are the generator's one `clear`, so the number is right
    and the line is drawn in the wrong place. No test turns the island for
    this dimension.
  - ~~Rough-in leader lines (`RoughInLayer.tsx`) run toward +x or +z, which for
    an island opening is through the island.~~ **Fixed in round 50**
    (`89237c3`): `leaderEnd` (`roughIn.ts`) runs out of the host's `facing`
    face. Held by `islandFacing.test.ts` — "runs every island rough-in leader
    out of the island on the side its machine opens to", A, C and D with the
    island either way.
  - ~~Island cabinet doors are drawn on the +x or +z face (`CabinetLayer.tsx`),
    so a working-side door faces into the island; `front` fixes it only for the
    cooktop's drawer base.~~ **Fixed in round 50** (`89237c3`): `doorFace`
    reads the box's recorded `facing`, and the `front` stopgap went. Held by
    `islandFacing.test.ts` — "draws every door on a face somebody can see", A,
    C and D with the island either way.
  - ~~A fly-in's azimuth is not turned with the island, so on an island laid
    across the room the camera arrives at the microwave drawer and the wine
    cabinet well off their fronts. The cooktop's 240 degrees was chosen because
    it happens to face the working side both ways.~~ **Fixed in round 51**
    (`a2d1e3f`): `bestView.azimuth` is an offset from the machine's front,
    turned with it (`flyInAzimuth`). Held by `flyIn.test.ts` — "flies in on
    package A's island … the same way with the island along the back wall or
    across the room" (microwave and wine) and "puts the camera in front of
    every machine", A with the island either way.

  ~~Waiting for a hood on an island: the duct outlet and duct run assume the
  back wall (`hoodOutlet`, `DuctRuns`); gas and water trunks to an island slot
  go to a wall point (`wallAnchor`); and the hood is placed on the range's run
  (`placements`).~~ **All four done in round 52, D22 step 3.** *(Noted
  2026-09-14, round 49; closed 2026-09-15, round 52.)*

  ~~Still open from that sweep: **a rough-in point that is not in its cutout is
  dropped for an island slot** (`roughIn.ts`).~~ **Fixed in round 72, in the
  order round 52 set:** HMIB42WS's and CIT367YG's points went in first, and
  the island hood's two are `at-ceiling` — not its own opening — so the fix had
  something to be held to. `islandRoughInHost.test.ts` was red on round 71's
  code with "slot-hood: 0 of 2 points", which is what the fault looked like:
  silence. It now also holds every package to drawing as many points as its
  models record, so nothing can vanish again. *(Leo, round 52; done round 72.)*
- ~~**Does the island hood still cover the combination oven in the install
  view?** *(Leo, round 55.)* The sight-line fade leaves install mode alone,
  because there the whole appliance layer has already stepped back to 0.12 —
  but install mode is exactly where E's oven tower has its services explained.
  Once E generates with its own figures, take one install-view shot of the
  combination oven and look before deciding whether install mode needs the fade
  as well. At 0.12 the hood may already be see-through enough.~~
  - **Looked at in round 56** (prototype, E at D20's figures): the hood is
    ghosted at 0.12 along with every other machine, and the combination oven's
    outline and the faces inside it read straight through it. It does not look
    covered.
  - **Closed in round 59: install mode does not get the fade.** *(Leo.)* Round
    56's prototype is the reason: with the hood stepped back to 0.12, the
    combination oven's outline and doors read through it.
- ~~**A column bank's order does not hold on both legs.**~~ **Closed in round
  57: there was no inconsistency.** *(Leo.)* The order is absolute — freezer
  left of the refrigerator, wine right of it, as you face them — and
  `columnOrder` says exactly that on either leg. What disagreed was D20's old
  sentence, which described the order by what each column stood next to; it has
  been rewritten. No code changed. *(Noted round 56; closed 2026-09-17, round
  57.)*
- ~~**Switching to a package with more machines throws, on the live site.**
  *(Found in round 58; pre-existing, not fixed in it.)* `PinProjector` builds
  its per-slot layout array once, sized to the package the page opened on —
  `useMemo(() => SLOT_ORDER.map(...), [])` — and a later package with more slots
  writes past its end: `Cannot set properties of undefined (setting 'dotX')`.
  Reproduced on the production site by switching from package A (six machines)
  to D (ten). It is thrown inside the frame loop, so what it does to D's later
  pins needs looking at before it is fixed; the fix itself is to size the array
  to the package the room is built to.~~ **Fixed in round 59**: the boxes are
  sized with the anchors they belong to (`[anchors.length]`).
  - **What it did, measured on the live site before the fix.** Once per switch
    into D, never on a switch out of it or among A, B and C. For under a
    second — the room rebuilding — D's last four labels were not yet placed and
    not shown; then all ten were placed, shown, and followed the camera. The
    projector sits under the room's `key`, so the switch remounts it with boxes
    of the right length; the throw is in the old instance, which re-renders
    with D's slots in between.
  - ⚠️ **A person could not cause it: an edge case the test tooling
    triggers, not a product bug.** *(Leo, round 59; the general rule is in
    D17.)* A mouse click, a tap and a key press on the package switch, three
    times each, never threw — and not with the CPU slowed six times either. A
    click fired from script inside the page (`element.click()`, a dispatched
    click event, from a timer too) threw nine times out of nine. Round 58's
    reproduction was a script click. **Why the two inputs differ is not
    established.** The five older smoke tests that switch into D and assert no
    errors all click with Playwright's mouse, which is why none caught it; the
    new one clicks from script (D22, round 59).
  - ⚠️ **The throw was hiding a second race, and it was real: fixed in the same
    round.** The shadow map is refreshed once per room. The refresh used to be
    asked for by `StaticShadowMap` with `layoutVersion` in its dependencies,
    read from the store *outside* the room's `key`. A store update reaches that
    component first; the room under the key is swapped only when `Scene`
    re-renders and hands the Canvas its new children. **A frame drawn between
    the two spent the one refresh before the new room was mounted**, and the
    new room kept those shadows. On a script-clicked switch the throwing frame
    had been skipping that draw, so it never showed; with the throw gone, D kept
    641 pixels of stale shadow edge (the tap's shadow on the counter, a strip on
    the floor, a knob on the rangetop), up to 55 levels, the same on three runs
    out of three. A mouse click leaves no such frame and was never affected.
    - **Why it had to be fixed and not left** *(Leo)*: every screenshot script
      here switches packages from script, so a fixed 641-pixel difference would
      have sat in every later diff of D and had to be explained each round.
    - **The fix:** the room's refresh is asked for by `RoomShadowRefresh`,
      mounted *inside* the key, so its effect runs when the new room mounts and
      not before (`Scene.tsx`). A lighting change still refreshes it from
      `StaticShadowMap`. The smoke test "draws the same room whether the switch
      was clicked with the mouse or from script" was red on the code between
      the two fixes — 641 pixels, its one assertion — and passes with both.
  - Nothing else is sized to the package the page opened on: every other
    `useMemo`/`useRef` with no dependencies was read, and everything else that
    walks `SLOT_ORDER` does so on each render.
- ~~**A package switch that moved no wall says the room grew.**~~ **Fixed in
  round 60**: `setActivePackage` returns the walls that actually grew (`grown`)
  apart from everything else it adjusted, and only those raise the toast. A
  switch that grows nothing also takes down an earlier growth toast, whose Undo
  would otherwise have gone back past the package now on screen. *(Found round
  59; Leo: fix next round, not after E.)* Switching from D to B shows "Package B
  needs a longer run: the room is now 224.3″ across the back and 178.9″ down
  the left", with Undo, and not an inch of wall has changed — those are D's
  walls. The customer reads a sentence that is not true, on one of the most
  frequent things they do. The cause: `setActivePackage` returns `adjusted`
  whenever any of the package's `defaultLayout` fields differs from the room
  (B moves the sink and the refrigerator to the other legs), and the store turns
  any `adjusted` into `toast.roomGrew`. The fix is to tell a change of
  arrangement from a change of wall length and only call the second one
  growing. For the record, the first switch to B from A's default room does
  grow the back wall to 202-3/8″, and that toast is true; switching back to B
  from A or from C after that said nothing, because a room is never shrunk.
- ~~**The last fallback in `setActivePackage` shortens walls.**~~ **Deleted in
  round 64.** It was a plaster put on in the round that laid package D out
  (2026-09-12), for a refusal on a 175-1/4" wall that "was not length at all".
  **Every room it ever rescued was a precision fault** — the quarter-inch window
  step (round 60) and the sink-to-window tolerance written twice (round 63) —
  and once both were fixed it rescued none, while each rescue had shortened a
  room against D18. **Proved by outcome, not by count:** 142,494 package
  switches from 47,498 rooms were run through the real `setActivePackage`
  before and after, recording built or refused and every parameter of the room
  it ended in; the two records are identical byte for byte. The same
  comparison run against round 62's code finds exactly the nineteen switches
  that changed in round 63, so it can see a difference when there is one.
  *(Found round 60. Round 62 looked for a room that reaches it; round 63 fixed
  what it found. Leo, round 63: delete, do not rewrite.)* Over
  142,494 package switches from 47,498 rooms, it rescued nineteen, all of them
  the sink-to-window tolerance fault fixed in round 63; after that fix it
  rescues none, and every switch that reaches it is refused anyway. Its whole
  record of success is two precision faults (rounds 60 and 63). The deletion is
  to be proved by running the same switches again and finding every outcome
  unchanged. What follows is the entry as it stood: When a package refuses a room for a reason that is not
  length, it sets both walls to what the package's legs need at their bare
  minimum — A's 147" x 105" from D's 224-1/4" x 178-7/8" — ignoring the room on
  screen, resetting a wall that had nothing wrong with it, and never checking
  the result against the room it replaces. That breaks D18: choosing a package
  never shortens a room. It was put in to get round the window fault fixed in
  round 60, so nothing known reaches it now. **The fix, Leo:** never shorten a
  wall; take the feasible room nearest the one on screen and no shorter on
  either wall; where there is none, refuse and stay on the package, which is
  the refusal path that already exists.
  - ⚠️ **With nothing reaching it, a change there cannot be checked.** So that
    round first builds a room that really does reach the fallback, confirms
    what the new code does in it, and only then changes it. If no such room
    can be built, it says so, and this stays recorded and unchanged.
- ~~**Makeup air: the code and the figure are Leo's to check.**~~ **Checked by
  Leo in round 66** and written into D6: CMC §505 for the 400 CFM, Title 24's
  floor-area requirement beside it, from secondary sources. The threshold did
  not move. *(Round 65.)*
- **The gas pipe threshold is written twice, the same way makeup air was.**
  *(Found round 65, not changed.)* The `gas-pipe-size` rule's own condition
  holds 65,000 BTU, and `thresholds.gasPipeUpsizeBTU` holds it again, read by
  nothing. One copy, when somebody next touches it.
- **Day after a round trip through night is not the day the page opened on.**
  *(Found round 60; Leo: not urgent, but record what it costs.)* Package A,
  mouse clicks, `?quality=high`: the room as it opens in day and the same room
  after Night then Day differ by 134,558 pixels — 118,000 of them by 8 levels
  or less, 3,536 by more than 32 — along every edge and over the grain of the
  floor and the steel. The same after 4 seconds and after 15, so it is not the
  fade still running; the canvas is 1144 x 844 throughout; and the code before
  round 59 does exactly the same, so it is not the shadow refresh. The cause
  was not found. By its look it is antialiasing or texture sampling, not a
  shadow.
  - ⚠️ **What it costs.** Any screenshot taken after the page has been through
    night — a set that shoots night and then carries on in day, or compares a
    day shot taken after a night one with a fresh page — carries 134,558 pixels
    of difference that no change made. **Whoever meets it first will read it
    as something they broke.** Until it is fixed: shoot day before night, or
    compare day with day on pages that have both been through night.
- **The smoke suite's `-t` exemption does not take effect.** *(Found round 59;
  Leo: not urgent.)* `filtered` looks for `-t` in `process.argv`, and every
  filtered run in round 59 still ended with "N of 27 smoke tests actually ran"
  and exit code 1 however its tests went — most likely because the file runs in
  a vitest worker whose `argv` does not carry the flag, which was not checked. A fault in a guard of our own; a full run is unaffected.
- ~~**Every rough-in sentence is English in Chinese.**~~ **Fixed in round 70**:
  `roughInWords` names the words — `typeKey`, `whereKey`, `atKey` and the inch
  figures — and each page says them in its own language through `sayWith`. Where
  in the box is one whole phrase per combination of side and height, so Chinese
  has its own order ("距右侧 3"、靠顶部") rather than English words in English
  order. `roughInChinese.test.ts` holds every Chinese rough-in line on the
  checklist, the quote and the callouts to no Latin letter, per package, and was
  red on the round-70 geometry code in all fifteen. ⚠️ **One exception, and only
  one:** "air gap", "anti-tip" and "service channel" stay English on the Chinese
  page. Installers say them in English, and a customer showing the quote to one
  has to be able to point at the same words *(Leo, from site)*; the test takes
  out exactly those three and fails on any other Latin letter; `roughInEnglish.test.ts`
  holds the English, word for word, to what round 69 printed, but for the 38
  lines the geometry fix changed on purpose, each listed with its reason.
  - **The checklist and the quote now say which way left is** *(Leo)*: a line
    at the top of both, "Left and right are as you face the cabinet." /
    "左右均以面对柜子为准。" The whole of round 70's geometry fault was which
    side left is seen from, and the reader of a quote was never told. It is a
    new line; no existing English sentence changed for it.
  - Leo's changes to the Chinese, round 70 — to go into `reviewed.json` once he
    has confirmed the table: "距底" kept (a height is from the floor of its box, not
    the room's), "上方柜内" rather than "上方吊柜内" (the English says only
    "cabinet above", and over B's and D's hoods it is the hood housing), and a
    colon in the checklist line to match the callouts.
  - **Also fixed by it, and visible:** the `Key` convention for a line's vars
    was written twice (checklist, toast) and not followed at all by the spec
    card and the quote. `sayWith` is now the one copy, and all four use it. So
    the one other line with keyed vars, "no island" (`rule.noIslandFallback`),
    no longer prints `{microwaveLeg}` and `{wineLeg}` on the spec card and the
    quote.

  What follows is the entry as it stood: *(Found round 69, in E's
  Chinese screenshots; not changed.)* `roughInSentence` (`roughIn.ts`) writes
  where a connection is and how far along — "in the base cabinet beside the
  tower — open its door to see it", "3" from the left side, at the top" — as
  English strings, and the install checklist, the rough-in list and the
  callouts all pass them straight into Chinese lines. Not E's: every package's
  Chinese install view has done it since the rough-in points were drawn, and
  it is on the live site now. It wants i18n keys for the locations and the
  measurement phrases, and a test that no Chinese line carries them in English.
- **A round-69 smoke failure whose cause is lost.** *(Round 69; recorded round
  70, Leo.)* One smoke run in round 69 ended 27 passed, 1 failed. Its output
  was piped to `tail`, so the exit code read 0 and which test failed was not
  kept; the rerun passed 28 of 28. The failure is not known and cannot now be
  found. This is the pipe of round 37 again (above): since round 70 test
  output goes to a file, never through a pipe, and the exit code is read from
  vitest itself (D17: the exit code goes into a file of its own).
  - **Very likely the mouse-and-script smoke test, the next entry.** *(Leo,
    round 70.)*
- **"Draws the same room whether the switch was clicked with the mouse or from
  script" goes red now and then.** *(Round 70, Leo.)* The smoke test holds a
  mouse-clicked and a script-clicked switch into package D to the same picture,
  to the pixel. In round 70's five full runs it was red twice — by 1,147 and by
  63 pixels, both on the geometry fix's code and neither with anything kept to
  look at — and green three times: round 69's code once, the geometry fix once,
  the geometry fix with the translation once. Code with the fix in it went
  2 red, 2 green; round 69's, 1 green; too few runs to tell them apart. Run on
  its own, step for step, nine pairs on the geometry fix gave three that
  differed by 40 pixels each, one level at most, all on the edges of the
  bottom toolbar and the compass button — a translucent, blurred HTML bar over
  the canvas — and three pairs on round 69's code none.
  - **It now keeps the evidence.** A red saves the mouse picture, the script
    picture and the difference in `test-results/mouse-script/`, and its message
    says by how many levels at most and within what box. Proved on a forced
    failure (the script side sent to C) before it was trusted.
  - **The next time it is red, look at the pictures before deciding anything.**
    If every differing pixel is on the toolbar, take the toolbar out of the
    screenshot — that is not loosening the test: it holds the room, and the
    toolbar is HTML laid over the canvas. If any is in the room, stop and
    report.
  - Round 69's red whose cause was lost (above) was very likely this test.
- ~~**Package B's neighbouring-cabinet points are drawn outside the cabinet.**~~
  **Fixed in round 71**: only a real cabinet counts as one, and where neither
  side has one the point goes where the model's `whenNoCabinet` says — B's
  refrigerator behind the appliance (D22). The test's known exception was
  deleted with the fix, as it was written to be. *(Found round 70 by
  `roughInSides.test.ts`; Leo: fix next round — it is the live default.)*
  On B as it opens, the refrigerator's socket and water are said to be "in the
  cabinet to the right" and drawn 3" and 9" past a 3" tall board
  (`back-tall-outer`), and the wine column's socket 3" past another
  (`back-tall-inner`); with the refrigerator on the left leg they land past a
  5/8" spacer. `pickNeighbour` takes the nearest segment that is not an
  appliance, and a board or a spacer is not an appliance. **Not the left-and-
  right fault fixed in the same round:** it happens on the back run, where left
  and right were already right, and it stayed after that fix. It is on the live
  site, and on B's quote the refrigerator's two lines name a cabinet that is a
  3" board. The test carries the three points as a known exception, and fails
  the day they are inside their box, so the exception goes with the fix.
  - **The rule for the fix, Leo's site practice:** *"如果条件允许，插座和进水口都是
    安装在靠近机器的、有橱柜的一侧。"* — where there is a cabinet, the socket
    and the water go on the side of the machine that has one, near the
    machine. Two layers: (a) the cabinet must be a real one — a column spacer
    (COMBIKIT), a tall board or a filler is not; (b) in it, the figure is from
    the side that meets the machine (already so since round 70).
  - **Where there is none — B's refrigerator.** Checked in round 70 over every
    arrangement: on either leg, one side is a 5/8" spacer and then the wine
    column, the other a 3" board and the end of the run. No real cabinet, so
    "if conditions allow" does not hold. *(Leo, round 70:)* the socket goes
    behind the refrigerator, T36BT120NS sheet p. 4's alternative (B), with a
    checklist line that it must be switchable at a breaker (source: the sheet);
    the water goes behind it too (source: Leo's site practice). Both marked as
    what is done when conditions do not allow, in the grey dashed tier.
  - ⚠️ **Behind the machine is the way out, not B's refrigerator's address.**
    *(Leo, round 70.)* The code has to tell the two states apart and say which
    it is in: a real cabinet on a side → the point goes in it, measured from
    the side that meets the machine; none on either side → behind the machine,
    with the checklist saying why. Written as "B's refrigerator goes behind it"
    it would stay behind the machine in an arrangement that does have a
    cabinet, and the customer changes arrangements.
  - ⚠️ **Order: fix `pickNeighbour` first, then look again.** *(Leo, round
    70.)* B's points land outside their box because a 5/8" spacer was taken
    for a cabinet; once only real cabinets count, B's refrigerator may turn
    out to have none on either side — which is this case — or the picture may
    change. Fix the cause, then see which of the two states each machine is
    really in, rather than writing a special case for a situation that the
    first fix may remove.
  - Next round, with the D oven below.
- ~~**In some arrangements the "base cabinet beside the tower" is 6" wide.**~~
  **Fixed in round 71**: a 6" filler is not a cabinet, so D's oven box goes in
  the drawer under its opening there (D22). *(Noticed round 70.)* D with its coffee cabinet on the back leg (four
  arrangements) puts the oven's junction box in `back-tower-clearance-0`, a
  6" filler between the range and the tower: there is no real cabinet on
  either side of the oven. *(Leo, round 70:)* it goes at the back of the
  drawer under the oven's opening. PODS302B's sheet, p. 2, allows the box
  above, beneath, left or right of the unit — "beneath" is the source; and not
  above, because the cabinet over a steam oven has an open back and the gap
  behind it is where the steam goes up (Leo's judgement; D11 rule 12). Next
  round. (Round 70's first report of this cited the MEM301WS manual; D's oven
  is PODS302B.)
  - **The four together, in this order** *(Leo, round 70)*: `pickNeighbour`
    takes only real cabinets; then B's refrigerator, in whichever of the two
    states it is left in; then this; then the neighbour's measuring rule
    written down with Leo's words as its source. All four move points on
    screen, so the pixel diff goes over B as it opens — the refrigerator's and
    the wine column's points — D's four coffee-on-the-back arrangements, and
    one machine that does have a real cabinet either side, to see that both
    states take the branch they should.
- **The layout checker's failure messages are English strings built in code.**
  *(Round 70, Leo: record, do not change.)* Every `fail(code, message)` in
  `layoutRules.ts` builds its message as an English template ("sink has only
  …, needs …"). None reaches the page today — `checkLayout` is called only
  from tests (checked round 70) — so a Chinese customer never sees one. If any is ever shown, it needs keys first.
