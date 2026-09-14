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
7. **The island's two openings face opposite ways**: the microwave drawer to the
   working side, the wine cabinet to the seating side (already D5), with a 42"
   aisle to the perimeter run.
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
   calls this rule `d11-8`.

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

**What this forbids:** reporting a push as finished work; a local suite that is
a subset of CI's without saying so; a build that cannot be identified from the
page it serves.

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

**The wall sliders are not switches.** Dragging one is asking for that length,
and a length the room will not build at is refused on its own terms, as before.

**A package's own room has slack.** Its default walls are at least the largest
wall any single switch needs from that room, extreme combinations aside, so the
switches a salesperson actually flips never make it grow. Checked over every
switch in every package: A 168" x 144" (the largest need is 159" x 126"), B
202-3/8" x 144" (199-3/8" x 126"), C 168" x 144" (153" x 126"), all unchanged;
D 201-3/4" x 178-3/4" in round 34, its left wall up from 175-1/4" for the return
wall's clearance, and 224-1/4" x 178-7/8" since round 35, when every switch
became buildable: the coffee cabinet on the back wall needs the 224-1/4", and
the columns on the back leg the eighth of an inch. The spare inches are handed to the landings in the reverse of the
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

- **The column group** is a refrigerator column and a freezer column. The
  refrigerator column stands next to the landing and the freezer column at the
  outer end of the wall. The order is stated by what each column is next to,
  never as left and right, so it holds on either leg: 18 + 5/8 + 30 + 3/4 +
  3/4 = 50-1/8".
- **Landings on the island** are D11 rule 4's island branch: 15" and 12" along
  the island's length.
- **Aisles:** 48" on the cooking side, between the perimeter run and the
  island, because somebody is working at the cooktop and standing under the
  hood; 44" behind the seating. Package E does not use rule 7's single 42".
- **The seating overhang is 15"**, which needs steel support brackets, and the
  install list says so. 12" is the alternative.
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
  for it until round 48.)* Not rewritten yet.
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
- **D11 rule 9 is `d11-8` in the code.** The rule that a dishwasher's power,
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
  `mfgs4030rs-front.png` — so their points can be read off and added. This is
  work to do, not where it ends. *(Noted 2026-09-14, round 43, Leo: not this
  round.)*
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
- **The install view's outline round an island hood is a 30" box.** The outline
  round every appliance is a box its catalogue `heightIn` tall, and HMIB42WS's is
  the collapsed 30", so in the view that exists to explain installation the
  outline is ten times the 2-3/4" canopy it surrounds. Round 46 drew the hood
  itself right and left this. *(Noted 2026-09-14, round 47, Leo: the next round
  or the one after.)*
- **Two rule numbers do not say which rule failed.** Rule 7's facing check and
  both aisle checks all fail as `d11-7`, and rule 9 fails as `d11-8` (above).
  Sort both out when rule 7 is rewritten for E, when it may become four checks.
  *(Noted 2026-09-14, round 48, Leo: not a round of its own.)*
- **A hood over an island is held exactly centred.** The check allows no offset
  on either axis, so an island hood moved a little for its duct would be
  refused. Recorded, not changed. *(Round 48, Leo.)*
- **One axis written in, found in round 49 and not fixed.** A sweep for
  positions and checks that assume one axis or the back wall, done with the
  riser fix. Real now:
  - `PlanThumbnail.tsx` swaps width and depth for any turned slot, so the
    parallel island's microwave drawer is drawn sideways on the plan.
  - The island aisle dimension (`dimensions.ts`) is drawn from the back run
    even when the island is turned and its aisle is to the left run.
  - Rough-in leader lines (`RoughInLayer.tsx`) run toward +x or +z, which for
    an island opening is through the island.
  - Island cabinet doors are drawn on the +x or +z face (`CabinetLayer.tsx`),
    so a working-side door faces into the island; `front` fixes it only for the
    cooktop's drawer base.
  - A fly-in's azimuth is not turned with the island, so on an island laid
    across the room the camera arrives at the microwave drawer and the wine
    cabinet well off their fronts. The cooktop's 240 degrees was chosen because
    it happens to face the working side both ways.

  Waiting for a hood on an island: the duct outlet and duct run assume the back
  wall (`hoodOutlet`, `DuctRuns`); gas and water trunks to an island slot go to
  a wall point (`wallAnchor`); a rough-in point that is not in its cutout is
  dropped for an island slot (`roughIn.ts`); and the hood is placed on the
  range's run (`placements`). *(Noted 2026-09-14, round 49.)*
