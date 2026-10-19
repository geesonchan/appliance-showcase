# Handoff

The first thing to read when picking this project up. It is an **index**: what
this is, where everything lives, and which section of `docs/decisions.md` holds
each decision. It does not repeat those decisions, and it does not copy the
open items — a second copy of anything here goes stale the week after it is
written (D17, "one rule written twice").

Written in the repository, while reading it. Earlier briefs were assembled in
conversation by someone who had not opened the files, and said more than once
that a decision was "written into D20" when nothing in the file said so. If
this file and `docs/decisions.md` disagree, **decisions.md is right** and this
file has a bug — say so in your first reply.

Covers the repository up to **round 96** (`docs/decisions.md` is the record of
rounds; `git log` is the record of commits). It replaces the v1–v9 briefs that
were pasted into chat.

---

## 1. Six steps before you touch anything

1. **Read**, in this order: `docs/decisions.md` (all of it — it is long and it
   is the product), `docs/data-sheet-spec.md`, `docs/reference/README.md`,
   `docs/reference/cabinet-modules.md`. Then say back to Leo: the highest D
   number, the highest numbered rule in D11, and how many entries the Open
   items section has.
2. **Check the tree and the site agree.** `git status`, `git log --oneline -5`,
   and compare the live page's `assets/index-*.js` with a fresh local `npm run
   build` (D17: a push is not a deploy, and the footer's commit is compiled
   into that chunk).
3. **Run the tests before changing anything**, so a later red is yours:
   `npm run test:unit` (seconds) and `npm run build`. Write the output to a
   file and read vitest's own exit code from a file of its own — D17 spells out
   why, three times over.
4. **Read this file against the repository** and report anything it gets wrong.
5. **Read the Open items** at the end of `docs/decisions.md` and tell Leo which
   ones the work in front of you touches.
6. **Say what you are about to do, and wait.** Leo decides scope. He reads
   screenshots, not code; a report is what he acts on.

---

## 2. What this is

An interactive 3D web page a high-end kitchen appliance salesperson uses **in
front of a customer**, to explain a layout and how the machines are installed.
Not a configurator and not a quoting tool: prices live on a separate quote
sheet, and the room never shows a total (D12). English and Chinese; some of
Leo's customers read Chinese (D10).

- Live: <https://geesonchan.github.io/appliance-showcase/>
- Repository: `geesonchan/appliance-showcase`, public, deployed from `master`
  by `.github/workflows/pages.yml`.

Five packages are on the buttons — A, B, C, D and E. What each is made of, and
every figure of it, is `data/packages.json`; D16 and D20 say how a package is
put together and why E was built the way it was. **Do not copy those numbers
anywhere**: the file is the one source, and the tests read it.

### Where it stands (round 97)

- **All five packages are live.** Rounds 73–79, 81–90, 92, 92a, 92b, 92c, 93, 94, 95, 91, 96 and 97 each shipped
  (round 80 built nothing; 91 was built after 95, below), and each was checked against the live page's asset hashes
  after its workflow finished.
- **The live site counts visits, anonymously** (D24): page views and four events
  in GoatCounter's dashboard, nothing on the page; a lower bound, since a
  blocked or switched-off browser is never counted.
- **The project is in real use.** Rounds 73–77 all came from Leo using package
  E himself: a wine cooler under the coffee machine (73), E's combination oven
  hanging at 0" (74), the coffee machine at its manual's height (75), the
  height slider that could not find that height again (76), and bar stools at
  the seating overhang, which on a phone read as a top nothing carried (77,
  D20). Round 78 came from asking for a 30" option in A (paused): the reading
  for it found two faults on the live site, the cabinet over a hood that is not
  18" tall (D13) and two thresholds written more than once (D17's table).
  Round 79 came from Leo trying round 78 on a desktop: the strips beside a
  narrow hood, the list's width, and a line when a hood is narrower than the
  cooking surface (D12, D13). New
  work comes from what Leo and his colleagues meet in use, collected and sent a
  few at a time. **Do not start new features on your own initiative.**
- **Round 80 planned the interface round and built nothing.** It measured
  the hood-swap fade flash (Open items) and wrote the plan,
  `docs/plans/round-80-interface-plan.md` — a plan, not a decision record;
  Leo's decisions are its section 9. The interface work is three rounds, in
  Leo's order, in the Open items: 81 the fade flash (**done**, D1 round 81),
  82 the model card (**done**, D12 round 82); round 83 became the cooking slot
  following the range chosen (**done**, D16 round 83); round 84 became a range
  narrower than its opening closed in by the run (**done**, D16 round 84, from
  Leo using package B); round 85 the strips beside a hood and inside a tall
  unit's opening faced and shaded like the cabinets (**done**, D13 round 85);
  round 86 a machine that cannot physically go into an opening refused — a
  wine column under the island's top, from Leo using package A (**done**, D20
  round 86); round 87 an insert hood with its housing and every hood swap
  following the hood, B's and D's housing made 36" (**done**, D16 and D13
  round 87, from Leo using package A); 88 the model card at the left of the scene on a desktop (**done**, D12 round 88; the phone's later); 89 a refrigerator's surround following the model chosen (**done**, D16 round 89); 90 the 36" chimney hood HMCB36WS (**done**, D16 round 90); 92 every RAL
  Classic colour, built before 91 with its number kept, and the importer
  stopping when hand-filled cells come in blank (**done**, D15 and D4 round
  92); 92a the doors opening in RAL 5015 (D15 round 92a); 92b every base cabinet on a toe kick that shows (D22 and D13 round 92b); 92c every oven tower a standard install, its sides inside its 30", and beside it on the far side a board only under 9" (D11 rule 12 round 92c); 91 the right panel's tabs and the `Slider` warning, built after 95 (**done**,
  D12 round 91; the "MT" chip over "E" on a Chinese phone went into 94); 93 why a tap on
  the phone card now and then rebuilds nothing, and the mouse-or-script smoke
  test comparing the canvas by pixels and the HTML over it by position, and
  this machine and CI on one Node version (**done**, D17 round 93 and Open items: the tap not reproduced in 120 tries and its test keeping the evidence); 94 a
  share button, a plan first, and the phone's top bar holding every control
  (**done**, D23 round 94; D1 round 94); 95 a QR code for the link, in a box
  on the desktop (**done**, D23 round 95; how far a phone reads it is Leo's to
  measure in the shop, Open items); 96 the live site counting visits,
  anonymously (**done**, D24); 97 an over-the-range microwave, GE's
  JVM3160RFSS, in the hood's place, from Leo's shop — the microwave drawer
  leaving the room with it, its own rectangular outlet, 24" over the cooking
  surface (**done**, D16, D13 and D18 round 97); then a hood's
  own outlet, then 79a (the doors of the
  cabinet over the hood and the outlet shown in it), then 79b. The 30" option
  in A is paused.

---

## 3. Where things are

| Path | What it holds |
|---|---|
| `data/*.json` | The product data: appliances, packages, slots, fixtures, rules, rough-in points, colours. Validated on load by `src/data/schema.ts` (D3). |
| `docs/decisions.md` | Every decision, numbered D1–D23, and the Open items. The record. |
| `docs/data-sheet-spec.md` | Where each field of `appliances.json` comes from in Leo's inventory sheet, and what the importer does to it. |
| `docs/reference/` | Manufacturer drawings and manuals, with `README.md` listing every file and what it settles. A figure with no entry here is not a source (D21). |
| `src/data/` | The geometry and the rules: room and runs, cabinets, layout template, layout rules, rough-in, quote, checklist. |
| `src/three/` | The scene: cabinets, appliances, utilities, rough-in layer, camera. |
| `src/ui/` | Panels, install checklist, quote sheet, spec card, the model card (`ModelCard.tsx`) and the shared brand · model line (`ModelLine.tsx`). |
| `src/i18n/` | `en.json`, `zh.json`, `reviewed.json` (copy Leo has approved, locked to his words), `index.ts` (`translate`, `sayWith`). |
| `tests/smoke.test.ts` | The browser suite: a real build in a real browser. |
| `tests/fadeRebuild.test.ts` | A rebuilt room draws no faded cabinet solid, frame by frame (D1, round 81). |
| `tests/modelCard.test.ts`, `tests/modelLine.test.ts` | The model card against the list, and brand · model's layout rule (D12, round 82). |
| `tests/rangeSwap.test.ts` | What stands under the cooking surface follows the range chosen (D16, round 83), and a range narrower than its opening is closed in by the run's fillers (round 84). |
| `src/data/rangeFillers.test.ts` | The nine narrow-range swaps, the run's fillers, the stone and the kick to the machine, and what reads the cooking opening (D16, round 84). |
| `src/data/hoodSwap.test.ts`, `tests/hoodHousing.test.ts` | What is over a hood, where it hangs and its duct's route follow the hood chosen; an insert comes with its housing (D16, round 87). |
| `src/data/openingAbove.test.ts`, `tests/tooTall.test.ts` | What is above an opening, and a machine too tall for one, or of another kind than a tall unit is built for, refused with its reason (D20, round 86). |
| `tests/sideStrips.test.ts` | The strips a machine draws beside itself are faced in the doors' plane, take shadows, and have nothing of the machine in them (D13 and D11 rule 12, round 85). |
| `tests/modelCardSide.test.ts` | On a desktop the model card at the left of the scene, as tall as what it holds, gone while the list rail is open, clear of the machine (D12, round 88). |
| `src/data/fridgeSwap.test.ts`, `tests/fridgeSurround.test.ts` | What stands round a refrigerator follows the model chosen; a counter-depth one is refused in a bank of columns (D16, round 89). |
| `tests/previewServer.test.ts` | The browser suite's preview server leaves its port free when stopped (round 89). |
| `src/data/hmcb36ws.test.ts`, `tests/chimney36.test.ts` | The 36" chimney hood HMCB36WS in A's, B's and D's openings, and a chimney hood's cover its own model's (D16, round 90). |
| `src/data/ral.test.ts`, `tests/ralColours.test.ts` | Every RAL Classic code with its source and date, the special finishes, and what the RAL input says under it (D15, round 92). |
| `src/data/nodeVersion.test.ts` | One Node major, 24: `.nvmrc`, `package.json`'s engines, the workflow reading the file, and the Node the suite runs on (D17, rule 1, round 93). |
| `src/data/ovenTower.test.ts` | Every oven tower a standard install — 30" overall, its 3/4" sides inside, a 28-1/2" opening, from `ovenTower.ts` — and what stands beside it on the far side: a board under 9", counter with wall cabinets over it from 9" (D11 rule 12, round 92c). |
| `src/data/toeKick.test.ts`, `tests/toeKick.test.ts` | What stands on the toe kick and what goes to the floor, where the kick runs, the corner piece, the island's 3", a dishwasher's kick panel, and rough-in in a base cabinet read from `cabinets.ts` (D22, round 92b). |
| `src/store/defaultDoors.test.ts`, `tests/defaultDoors.test.ts` | Every package opens with its doors in RAL 5015; the interface green and the accent palette unchanged (D15, round 92a). |
| `src/store/shareLink.ts`, `src/store/openLink.ts` | The share link: one table every setting is written and read by, and the page opened from a link checked by what it already asks (D23, round 94). |
| `src/store/shareLink.test.ts`, `tests/shareLink.test.ts` | A kitchen shared and opened comes back the same, settings, room and pins; older links and their notice; the table's completeness (D23, round 94). |
| `src/ui/shareQr.ts`, `tests/shareQr.test.ts` | The share box's QR code — L, 4 CSS pixels a module, loaded only when the box opens — read back to the link character for character (D23, round 95). |
| `tests/rightTabs.test.ts`, `tests/sheetTabs.test.ts`, `src/store/rightTab.test.ts` | The right panel's four tabs and the phone sheet's five: Look first, Install mode there and back, the checklist folded by machine, the tab kept for the browser tab (D12, round 91). |
| `tests/sliderWarning.test.ts` | No React style warning from the wall sliders, on Vite's development server, which it starts and stops (D12, round 91). |
| `src/analytics.ts`, `src/analytics.test.ts`, `tests/analytics.test.ts` | The visit counter: its own requests to GoatCounter's `/count`, every field count.js sends but `q`; the four events, each in its one place; nothing off the live site (D24). |
| `tests/topBar.test.ts` | The phone's top bar: no control over another at 360–414px in both languages, and a share button (D23, round 94). |
| `scripts/handFilled.test.ts` | The import stops when a checked model's hand-filled cells come in blank, unless `--allow-empty=MODEL` names it (D4, round 92). |
| `scripts/screenshots.mjs` | Screenshot sets by round. |

Commands: `npm run dev`, `npm run build`, `npm run test:unit` (unit only,
`vitest.unit.config.ts`), `npm test` (build then the whole suite including the
browser smoke tests, `vitest.config.ts`), `npm run screenshots`.

---

## 4. The decisions, one line each

`docs/decisions.md` is the text. This is only the way in. (The file's own
order puts D15 before D14 — read by number, not by position.)

| # | What it settles |
|---|---|
| D1 | The camera moves for three reasons and no others. |
| D2 | Layers are mounted once and toggled by `visible`. |
| D3 | Product data is JSON, validated at load. |
| D4 | The inventory sheet is read-only; cleaning happens in code. |
| D5 | The kitchen is a rangetop, an island, and no wall oven. |
| D6 | A blower is a line on the quote, not a slot — and the makeup-air sentence, with where each part of it comes from. |
| D7 | Rules are data; availability is code. |
| D8 | A scheme is a preference; the catalogue is the truth. |
| D9 | A blower has no width and does not need one. |
| D10 | The quote is derived, never stored; machine translation is labelled; reviewed copy is locked to the words reviewed; a customer's line says what is, not what we changed. |
| D11 | The cabinet layout rules, numbered 1–15, with what each is for. |
| D12 | A tool for explaining a kitchen, not for selling one. |
| D13 | The dimensions a kitchen is actually built to. |
| D14 | The layout is a plain sequence, not a derived value. |
| D15 | A kitchen is finished by the run, not by the shelf. |
| D16 | A package is data, and it is the third half of a slot. |
| D17 | A push is not a deploy — and the method: sources, pixel diffs, fallbacks, one rule written once, script clicks, exit codes, what not to run together. |
| D18 | A switch never refuses for want of wall. |
| D19 | The ceiling is 108-1/2". |
| D20 | Package E: island cooking — what it is and every figure in it. |
| D21 | A line says where its figure comes from: the three install-view tiers. |
| D22 | Which way a thing faces is recorded, and written in one place — and the rough-in rules that follow from it. |
| D23 | A link rebuilds the same kitchen: one table, older links checked by what the page asks, the notice in Leo's words. |
| D24 | The live site counts visits, anonymously, and only there: GoatCounter, not its count.js; four events; a lower bound. |

---

## 5. How the work is done

All of this is written out in D17 and D22; these are the headlines, so you know
what to go and read.

- **Every rule has a source**, and says which kind: a drawing, or Leo's site
  practice. **So does every sentence a customer reads** — D17, learned the hard
  way on the makeup-air line.
- **A statement about what a document contains comes from having read it.**
  D17, round 72: three drawings were described from their file names for
  twenty-nine rounds.
- **A figure that cannot say exactly why it is that figure** may be working
  round a bug; record that it cannot. D17.
- **One rule is written once.** D17 carries the table of every time it was
  written twice: seventeen rows, for eighteen times it happened — round 60's
  quarter-inch window step is counted as a near relative, the fifth, and has
  no row of its own. Two are still open, both deliberate: the first, and the
  eighteenth (round 94, a layout figure in a page's address read by the
  screenshot parameters and by the share link's table); the twelfth (round 84,
  the half inch that is a scribe) was closed in round 85, and the thirteenth
  (round 87, how a hood hangs), the fourteenth (round 89, how a
  refrigerator is built in), the fifteenth (round 92b, where a base
  cabinet is, for its rough-in) and the sixteenth and seventeenth (round 92c,
  how an oven tower is installed, and what is filled beside it) were each
  found and closed together. The eighth (round 74, 54"
  and 52" for the same handle height) was stopped before the second copy was
  written; round 78 found a third copy of one already marked closed.
- **A figure from a script, a probe or a set of shots is quoted from the run
  that was checked, and says which run.** D17, round 85: a plan quoted the
  wrong run of a count and called C's 30" hood opening 36".
- **Visual changes are proved by pixel diff**, live against local, mouse
  clicks, `?quality=high` pinned. A difference is zeroed one of three ways
  (D17): put the changed value back (round 61), shoot the same build twice
  (round 70), or build the live page's own code locally and compare it with
  the new build, which leaves only the code's difference (round 75). **A
  difference inside the room is never waved away with an explanation.**
- **Package E was the first to reach branches A–D never did.** Four times now
  (D17, round 73: "Package E is the first to walk down branches nobody had
  taken"). Before adding a package or a new combination, list what it puts
  together that nothing before it did, read the code that answers each, and
  prototype what nothing handles.
- **Anything found along the way and meant for the report goes into the report
  or into Open items.** Before the report goes out, go back through the round
  and check every probe result and every "note this" against both. D17, round
  73.
- **Where a manual and Leo's site practice disagree, write both down as they
  are**, quoting the manual word for word and Leo in his own words, and say
  which is followed and why. D11 rule 14's round-73 and round-75 amendments
  are the worked examples: TCM24PS's "own cabinetry" against what goes under a
  coffee machine, and its 37-7/16" against the spec sheet's 37-1/2"-57".
- **A script click is not a click.** D17. Say which input a result came from.
- **Tests**: a new rule gets a case that goes red on the old code, and you read
  *why* it is red; one assertion per `it()`; an assertion about a filtered set
  says how many went into the filter; an exception in a test is broken on
  purpose before it is trusted; a detector proves it can find a known fault.
  D17 and D22.
- **Vitest's exit code goes into a file of its own**, with nothing after it.
  D17, three separate times it was read from the wrong thing.
- **Do not run the tests and the screenshots together**, and do not build while
  the smoke suite runs. D17.
- **Push, wait for the workflow, rebuild, compare the asset hashes.** D17.
  Rebuild **with the counter's address**, as the workflow builds:
  `VITE_GOATCOUNTER=https://geesonchan.goatcounter.com/count npm run build` —
  without it the main chunk never matches the live one (D17, amended for D24).
- **A round held for Leo's look says the live site does not have it**, names
  the live commit and bundle, gives a local preview to try, and labels every
  screenshot with its bundle; **a stopped preview server is checked to have
  stopped** (its port free, its Vite process gone). D17, round 87.
- Windows: PowerShell splits `"` in a commit message (`git commit -F`), and
  `\n` written through a shell or Python lands as a real newline — use the
  editor tools for i18n strings and scripts. Python writes CRLF here unless
  told `newline="\n"`; every text file is LF (`.gitattributes`), and
  `lineEndings.test.ts` goes red on CRLF (D17, round 97). Quote a diff's size
  from `git -c core.autocrlf=false diff --stat`.

---

## 6. Open items

**In `docs/decisions.md`, at the end, under "Open items".** Read them there.
They are not copied here on purpose: a second list would be wrong within a
round, and this file would then be the thing people believed.

---

## 7. Things the repository does not have

Each is recorded where it bites, so go to the section rather than trusting a
list here:

- **Package C's four installation manuals** — its five machines' rough-in
  cannot be recorded without them, and the three drawings that are in
  `docs/reference/` carry no connection at all (Open items; D17's round-72
  entry).
- **T36IT100NP's own sheet** — the 84" it is drawn to is an inference (D4,
  round 40).
- **The T18IF900SP door panel drawing** — the 18" freezer column's panel is
  drawn from the 18" wine column's (D20).
- **Thermador's column-spacing drawing** — the 1-3/16" clear between hot and
  cold is recorded and deliberately not implemented (D11, the round-53 note
  after rule 15).
- **The flush columns' own sheets** — T18IF900SP, T24IF905SP, T30IR905SP,
  T24IW905SP. That they stand on the floor of an 84" niche is inferred from
  their family's T18IW100SP sheet (`towerSill.test.ts`).
- **SHX78CM5N's opening height** — the 34" under D's coffee machine is the
  slot's own figure (D11 rule 14, round 75).
- **HMCB30WS's installation manual** — package C's duct route,
  `through-ceiling`, is an inference (D22, round 58).
- **PRG366WH's specification sheet and installation manual** — the range's
  figures are written out from a note (docs/reference/README.md, its last
  section), and the anti-tip bracket's position waits for the manual (Open
  items; D16, round 83).
- **PRG304WH's own document** — it carries PRG366WH's figures (Open items,
  the 30" option in A).
- **The 18" column's panel drawing, `t18iw905sp-panel.png`** — its figures
  are in `WINE_COLUMN`, and the README row says the file is not here.

What is inferred rather than read off a drawing is marked in the data itself:
every rough-in point carries a `provenance`, and the install view draws the
three tiers differently (D21). `rough-in.json`'s `basis` fields say which
figures in a point are the guide's and which are not.

---

## 8. What is registered and not started

Three things, each with its source:
- **A Run Composer** — registered in D14, before building it.
- **The two run towers on separate legs** — D22, round 55: "splitting them
  across two legs is not being built now".
- **U-shaped and galley layouts** — only mentioned, in D22 (the fly-in rule
  and `roomWalls.ts` are written so they would need no new rule). Never
  registered as work.

And the rounds Leo has queued, with what he decided for each: the last entry of
the Open items, "Registered rounds after 78".

**Do not start one without Leo.** Anything else that sounds planned and is not
in `docs/decisions.md` was not planned (D17, round 77).

---

## 9. Keeping this file honest

- It is an index. If you find yourself copying a figure, a rule or an open item
  into it, stop: link the section instead.
- `src/data/handoff.test.ts` checks that every `D<number>` this file mentions
  exists as a section in `docs/decisions.md`. A renumbered or deleted section
  turns the suite red here rather than misleading the next reader.
- When a round changes how the work is done, the rule goes in
  `docs/decisions.md` and at most one line goes here.
