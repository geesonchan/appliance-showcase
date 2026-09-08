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
4. **The range is centred on a straight run with at least 12" of counter each
   side**, and the hood over it is at least as wide and centred on it. Twelve
   inches is where you put a hot pan down.
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
   cabinet its three connections are in, and the checker reads the model's own
   installation drawing to say so rather than taking it on trust.

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

**One datum for what sticks out.** A protrusion is measured from the cabinet
face, everywhere a customer can see it — the front of the run is the line their
eye follows along a kitchen and the thing a machine visibly stands out from. The
carcass front and the published cutout are draughtsman's datums an inch apart,
and printing whichever the calling code had to hand is how one refrigerator got
two figures for the same fact: 4-3/4" past the cabinets, 3-3/4" past the carcass
line. `protrusionDatum` in `data/rules.json` names it. And what is measured is
the machine rather than the hole it needs — a cutout depth includes service
space behind, so measuring against it reported a built-in as standing proud of
cabinets it is defined by finishing flush with.

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
- An L wants a short leg of at least 8ft and a long leg of 10–12ft, each
  measured from the inside corner outward. A tall cabinet is finished off with a
  24–48" return rather than left as a cliff at the end of a wall.

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
