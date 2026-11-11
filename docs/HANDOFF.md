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

Covers the repository up to **the ovens' round** (2026-11-10), `96cfaf9`, live,
and the handoff commit after it, which changes only `docs/` (written
2026-11-10 for the next session, which starts the U). `docs/decisions.md` is
the record of rounds; `git log` is the record of commits. It replaces the
v1–v9 briefs that were pasted into chat, and was first written on 2026-11-06
after the end-of-run round. **Section 6 is how Leo works, and is not written
anywhere else in one place.**

### Live, 2026-11-10

- **The handoff commit after `96cfaf9`** changes only `docs/`: every file the
  build makes is `96cfaf9`'s byte for byte but the main chunk, which differs
  only by the commit in the footer and so takes another name, and
  `index.html`, only by that name. Its check against the live site was
  reported to Leo in the conversation that wrote it; **the next session checks
  the live site again** (step 2 below) before anything else. That handoff
  commit is **`9b06f41`**: checked again on 2026-11-10 by the session that
  wrote the U's plan, built at `9b06f41` with the counter's address, twenty of
  twenty files the same byte for byte as the live site, the live main chunk
  **`assets/index-ByzCSeq-.js`** (711,964 bytes).
- **`96cfaf9`**, the ovens' control panels, checked file by file after its Pages run (42912454527, build and deploy each a success): twenty of twenty files the same byte for byte as a build at `96cfaf9` with the counter's address, each with its status and headers recorded; the live main chunk **`assets/index-DOZqAYgh.js`** (`docs/plans/ovens-control-panel-report-2026-11-09.md`, "发布").
- Before it, **`735bfbc`**, an alternative's main title and the desktop card kept to its height, checked file by file after its Pages run (42685806236, build and deploy each a success): twenty of twenty files the same byte for byte as a build at `735bfbc` with the counter's address, each with its status and headers recorded; the live main chunk **`assets/index-CWb90dQa.js`** (`docs/plans/alternative-title-card-height-report-2026-11-09.md`, "发布").
- Before it, **`a2a8646`**, E on one wall, checked file by file after its Pages run
  (42553787002, build and deploy each a success): twenty of twenty files the
  same byte for byte as a build at `a2a8646` with the counter's address, each
  with its status and headers recorded; the live main chunk
  **`assets/index-DzJ-Aufm.js`** (`docs/plans/e-one-wall-report-2026-11-08.md`,
  "发布").
- Before it, **`07cb903`**, the server-reset round closed with 丁 (the test
  environment and documents only, no page code), checked file by file after
  its Pages run (42446402554, build and deploy each a success): twenty of
  twenty files the same byte for byte as a build at `07cb903` with the
  counter's address, each with its status, `content-type` and
  `content-encoding` recorded; the live main chunk
  **`assets/index-D3Pvf11e.js`** (decisions.md, "A browser test that times
  out…", "Live: `07cb903`").
- Before it, **`d668c58`**, the server-reset round's 甲 (the test environment and
  documents only, no page code), checked file by file after its Pages run
  (42430127134, build and deploy each a success): twenty of twenty files
  the same byte for byte as a build at `d668c58` with the counter's
  address; the live main chunk **`assets/index-TlXvMvno.js`** (700,237
  bytes), six bytes from `664b570`'s — the commit in the footer — and
  `index.html` only by the chunk's name (decisions.md, Open items, "A
  browser test that times out…", "The commit of 甲" and "Live").
- Before it, **`664b570`**, the fonts round (the fonts the site's own, no request to
  Google), checked file by file after its Pages run (42317513405, build and
  deploy each a success): twenty of twenty files the same byte for byte as
  a build at `664b570` with the counter's address — `index.html`, the
  main chunk, the CSS, `react`, `three`, `shareQr`, twelve fonts and two
  licences; the live main chunk **`assets/index-Dz3iVQL4.js`** (700,237
  bytes). Every figure is in `docs/decisions.md`, Open items, "The page
  waits for Google Fonts…", items 10 and 11.
- Before it, **`476591c`**, the handoff commit (main chunk
  `index-nX_Uw6QU.js`, the end-of-run round's item 10), and **`05bb6e1`**,
  the end-of-run round (`index-NNDgg3WU.js`, its "Shipped"). The footer's commit is compiled into
  the main chunk, so a docs-only commit gives the main chunk another name
  while every other file stays the same. **The next session checks the live
  site again** (step 2 below) before anything else.

---

## 1. Six steps before you touch anything

1. **Read**, in this order: `docs/decisions.md` (all of it — it is long and it
   is the product), `docs/data-sheet-spec.md`, `docs/reference/README.md`,
   `docs/reference/cabinet-modules.md`. Then say back to Leo: the highest D
   number, the highest numbered rule in D11, and how many entries the Open
   items section has.
2. **Check the tree and the site agree.** `git status`, `git log --oneline -5`,
   then build at `HEAD`, the tree clean, with the counter's address —
   `VITE_GOATCOUNTER=https://geesonchan.goatcounter.com/count npm run build`
   — and compare every file the live site serves with `dist/`, byte for byte,
   listing each file's name, size and whether it is the same (D17: a push is
   not a deploy, and the footer's commit is compiled into the main chunk).
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

### Where it stands (2026-11-06, after the end-of-run round)

- **Since then, each live and each its entry in `docs/decisions.md`**: the
  fonts in the site's own files; the test environment answered from the build
  by Playwright (丁, "A browser test that times out…"); an induction cooktop in
  B's and D's rangetop choice, every cooking surface in the stone on a `B36`;
  E on one wall's dimension line, the hood hung off the cooking surface by the
  shop's installation distance; an alternative's main title, the desktop card
  kept to its height; the ovens' control panels and an oven tower's opening
  grown to the oven chosen. The live list above names each commit.
- **All five packages are live, as an L and on one wall.** Rounds 73–79, 81–90, 92, 92a, 92b, 92c, 93, 94, 95, 91, 96, 97, 98a, 98b-1, 98b-2, 99, 99a, 99b, 100, 99c and 99d each shipped
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
  surface (**done**, D16, D13 and D18 round 97); 98, a layout shape switch
  — one wall, U, galley — from a colleague's use, planned in four rounds
  (`docs/plans/round-98-layout-shape-plan.md`): 98a the preparation, nothing
  on the page changed — every run records which way it faces, the L written
  once as a shape, a share link `v=2` with the shape and `v=1` read as an L,
  the screenshot parameters read by the link's table (**done**, D22 and D23
  round 98a; D17's table, the eighteenth row, closed); then 98b one wall,
  in two steps (Leo, round 98b): 98b-1 the data and the template, the page
  unchanged — one wall as a shape, D's and E's one-wall packages, the rules
  reading a run's ends, the store's switch with no control yet, reached only
  by a link edited by hand (**done**, round 98b-1, after Leo's look at the
  local preview; Open items, round 98b), then 98b-2 the interface — the
  shape switch on the Layout tab, one wall showing only the controls it
  has, D's and E's notes, the switch's own message with Undo back to the L,
  every Undo button naming where it goes back to, all in Leo's words
  (**done**, round 98b-2, after Leo's look at the local preview; Open
  items, round 98b); then a galley, then a U; then
  a hood's own outlet, then 79a (the doors of the
  cabinet over the hood and the outlet shown in it), then 79b. The 30" option
  in A is paused. Round 99, the L's labels, words only: a machine is named by
  its category and how it installs, wherever the page names it, in Leo's
  words (**done**, round 99, after Leo's look at the local preview; D10,
  "A machine is called what it is"). Round 99a, from Leo using one wall: a
  narrow machine chosen in A, B or C is the one the room is built round on
  one wall too (`shapeOfChoice`), and the Layout tab's wall figures follow a
  model swap, worked out in idle time (**done**, round 99a, after Leo's look
  at the local preview, live at `102f05e`; Open items, round 99a).
  Round 99b: with the Layout tab open, a package tapped no longer blanks
  the page — the bill's words are worked out with its figures (**done**, round
  99b, after Leo's look at the local preview; Open items, the first).
  Round 100: the quality guard does not judge the two seconds after the
  scene is rebuilt or made heavier (**done**, round 100, after Leo's look at
  the local preview; Open items, "The quality guard misjudges the seconds
  after a package switch"). Round 99c, after 100: a part that fails is
  fenced off with Leo's message and Retry, a machine with no name found is
  called by its position's, and a share link cut short keeps the page
  (**done**, round 99c, after Leo's look at the local preview; Open items).
  Round 99d: an error in a frame reaches the scene's fence, the pins going
  with the scene, and a long link notice folds into one sentence with Details
  (**done**, round 99d, after Leo's second look; Open items). The geometries
  that climbed with every model swap freed by hand, 甲 (**done**, the
  geometries' round, after Leo's look at the local preview; Open items). A
  chimney hood narrower than its opening closed in each side by a filler in
  the wall cabinets, on no list, and the hood's canopy made before the
  insert's return (**done**, the chimney fillers' round, after Leo's look at
  the local preview; D16). A built-in refrigerator between its 3/4" side
  panel and its end, its doors flush with the cabinet doors (**done**, the
  fridge-front round, live at `ba94ef5`; D11 rule 11). Each built-in column
  two rows in Leo's sheet — its own number panel-ready, its number with -SS
  stainless — a pair as T36BT120NS and T36IT100NP are, with the switch on
  the model card; packages open on the -SS rows; links before `v=3` open a
  column's bare number as its -SS row (**done**, the columns' two rows
  round, imported from his export of 2026-11-04, live at `a46d2a9`; Open
  items, "Answered 2026-11-02" and "Built, 2026-11-02"). The quality lock's
  test, every frame held 30 ms by the test (**done**, `7d0b6f2`). Round 101,
  the L's D: the coffee machine's door behind a whole 15" cabinet, then
  every group of columns case against case (**done**, `2bb727c` and
  `408fe91`). Rule 12's counter beside an oven tower at least 9", with the
  page recorder and the probe (**done**, `28b8b18`). The end of a run: a
  tall unit's 3" at a wall one filler floor to top with no stone, an open
  end a 3/4" end panel under the stone, which stands 1" past it, the wall
  cabinets ending on a 3/4" board (**done**, `05bb6e1`, live; Open items,
  "The stone beside an oven tower that ends an L's leg at a wall", its
  items 5 to 9).

### History: earlier orders, every item below done (not an order)

Kept for where each finished round's plan and entry are. **Nothing here is
still to do, and nothing here says what comes next**; that is the next
section's one sentence. The list of 2026-10-24, amended 2026-11-05:

1. **The geometries that climb with every model swap**
   (`docs/plans/geometry-leak-plan.md`; 甲, freed by hand, Leo 2026-10-24;
   **done**, the geometries' round; Open items).
2. **The chimney hood's fillers** — in the wall cabinets' plane, on no list
   (D16, amended 2026-10-24; `docs/plans/chimney-fillers-plan.md`, confirmed;
   **done**, the chimney fillers' round, after Leo's look at the local
   preview, D16; with it the
   hood's canopy made before the insert's return, and the refrigerator in
   `swapMemory.mjs`'s fifty — Open items).
3. **The refrigerator's front** — a built-in against the cabinets beside it,
   3-1/2" at a wall, 3/4" at an open end, a plain 3/4" side panel toward the
   counter, faces flush with the cabinet doors, 35-3/4" doors with 1/8" each
   side on T36BT120NS and T36IT100NP (D11 rule 11, amended 2026-10-24; his
   answers of 2026-10-27); A's 42" segment becomes 37-1/2" at an open end and
   40-1/4" at a wall; a model swap that needs more wall grows it, on one wall
   too, with his words (`docs/plans/fridge-front-plan.md`, second final
   version, confirmed 2026-10-27 with both its last questions answered;
   built, looked at and confirmed by him 2026-10-28; **done**, live at
   `ba94ef5`). T36IT100NP's cutout depth 25", from its documents, came in
   with item 4's import.
4. **Stainless or panel-ready** — each built-in column two rows, the
   refrigerator pair as it was (`docs/plans/panel-ready-plan.md`, 第五版;
   Leo's 2026-11-02 rule; **done**, the columns' two rows round, live at
   `a46d2a9`).
4a. **The quality lock's test** — a small round before 101 (Leo,
   2026-11-04): only `tests/qualityLock.test.ts` changes, every frame held
   30 ms by a `requestAnimationFrame` wrapped in the test (乙); 50 runs,
   dropping every time, the locked page at 512 every time
   (`docs/plans/quality-lock-test-plan.md`; **done**, the quality lock's
   test round; decisions.md, Open items, "Amended 2026-11-04" and "Built
   2026-11-04").
5. **Round 101** — the L's D: the coffee machine's door, then every group of
   columns case against case (`docs/plans/round-101-plan.md`, final; Leo's
   answers A-1 to A-17 and to its section 3 in decisions.md, "Answered
   2026-11-04: round 101 and the open end"). **Step one, the coffee
   machine's door, done** (B15 after the corner; the blind corner with the
   tower left keeps its B9 and grows the wall; "Step one corrected").
   **Step two, the columns, done** (Leo's item 5, 2026-11-05: 「不用，照
   A-3」 — no COMBIKIT10, B's pair either; decisions.md, "Step two built"
   and "Shipped", `408fe91`, after a full suite green with no standby in
   it). **Round 101 is live.** Every full suite from now: no standby in
   it, Leo told before it starts.
5a. **Rule 12's counter at least 9"**: **done**, `28b8b18` (decisions.md,
   "Chosen 2026-11-05" and its "Shipped").
5b. **The page that now and then shows no canvas in 60 s**: the recorder
   (`scripts/pageWatch.mjs`) and the probe, shipped with `28b8b18`; what the
   probe and the full suites since found — the local preview server
   resetting the main chunk's first request — in decisions.md (Open items,
   "A browser test that times out…"). And the page waiting for Google
   Fonts, looked into, ways listed (Open items, "The page waits for Google
   Fonts…").
6. **The stone beside a tall unit at a wall, and the open end** — one round
   (Leo, 2026-11-05; `docs/plans/end-strip-open-end-plan.md`, his four
   answers in decisions.md): **done**, `05bb6e1`, live, after his look at
   the local preview (2026-11-06).

### History: the order of 2026-11-06, the items done (not an order)

What is still to do is in the place named above.

- **The fonts in the site's own files** — no request to Google, the system
   fonts shown until the files come. **Done**: the plan
   (`docs/plans/fonts-plan.md`), confirmed by Leo with his five answers,
   built, a full suite, committed and live as `664b570` (decisions.md,
   Open items, "The page waits for Google Fonts…", "Confirmed" and "Built
   2026-11-06"). Whether `geesonchan.github.io` opens in mainland China:
   待 Leo 报 — he has it tried on a phone there.
- **The test environment: the local server resetting the main chunk's
   first request** (`ERR_CONNECTION_RESET`), which has made several full
   suites run for nothing. **Done 2026-11-07 by 丁; 戊 not needed** (Leo:
   「这一项可以收尾」). A full suite red again: first check the places that
   still meet the local server — smoke's two opening checks, pageWatch's
   one real page, sliderWarning on the development server (decisions.md,
   "A browser test that times out…", "Closed"). The test environment only,
   never the page. **The
   plan**, `docs/plans/server-reset-plan.md`, confirmed by Leo: 甲 first.
   甲's code is written and its unit tests green (not committed); the night
   of 2026-11-06 ran the loop before (2,000 openings: 1 reset, 3 stalls,
   1 blank, every one a browser's first opening) and the full suite (164
   files, green); the next night group 甲 of the Norton experiment
   (`docs/plans/norton-experiment-plan.md`; 600 fresh openings, 9 stalls,
   every one near a whole multiple of 10 s). Group 乙 (2026-11-07 morning,
   Norton's whole Smart Firewall off): 600, 3 stalls, the same kind —
   between the plan's two answers. Leo: no 600 more ("not all of it is the
   Smart Firewall feature", not "not Norton"); next, a warm-up for every
   new browser (`docs/plans/warmup-plan.md`).
   The warm-up group (600, the firewall on): every warm-up arrived, the
   page still stalled 3 times — not enough; the waits are on later
   connections, not a browser's first. 丁, the last experiment
   (`docs/plans/route-plan.md`; the site's files answered from `dist/` by
   Playwright): 600, **0 stalls**, the server reached by the heartbeat only,
   and the heartbeat never held either — by Leo's judgement 丁 is the fix;
   next a plan of its own to wire it into the tests and the pixel scripts.
   甲 committed and live as `d668c58` (2026-11-07). The wiring plan,
   `docs/plans/route-wiring-plan.md`, confirmed by Leo with all five
   answers, is built (not committed): every browser test through 丁 but
   three real-server openings, a static and a run-time guard, a full suite
   green (4,673 s, 0 unrouted) and a pixel set the same as on the server;
   committed with Leo's look at the preview (decisions.md, Open items, "A
   browser test that times out…", "丁's wiring, built" and "Closed").
- **An induction cooktop in B's and D's rangetop choice** — registered
   2026-11-07; **the plan**, `docs/plans/induction-plan.md`, in its second
   draft with Leo's decisions of 2026-11-07 and 2026-11-08 (every cooking
   surface in the stone on a swing-door `B36`, a rangetop too; a pair of
   doors, a rangetop's starting below its control panel; 4-3/4" clear under
   the counter inside it); **done**, built 2026-11-08 and committed after
   Leo's look at the local preview, `index-C9kPU2y7.js` (Open items, "An
   induction cooktop in B and D"; the report,
   `docs/plans/induction-report-2026-11-08.md`).
- **E on one wall: the dimension line's "4"** (Leo, 2026-11-08): **done**, built 2026-11-08 and
  committed after Leo's look at the local preview (Open items, "An induction
  cooktop in B and D", "Found while building it";
  the plan, `docs/plans/e-one-wall-dimension-plan.md`; the report,
  `docs/plans/e-one-wall-report-2026-11-08.md`).

### What comes next

**Leo's order is written in one place only**: `docs/decisions.md`, Open items, "His order of 2026-11-06" and its "Amended 2026-11-07" (Leo, 2026-11-07: 「只写一处，别处引用」; 2026-11-08: 「HANDOFF 只留一句指向 decisions.md 的顺序」); every round a plan first, shown to Leo, built only once he confirms it.

### Registered, not in that order

One line each; the entry named in `docs/decisions.md`, Open items, holds its
figures, its sources and its latest status. Leo sets when any of them is
done. Made from the entries' headlines and their last dated notes on
2026-11-06; an entry not listed here is done, is a record of a past run, or
is one of the four above — and where this list and decisions.md disagree,
decisions.md is right.

- The copied textures, and the high tier's textures left on the graphics card after a drop to low — "The copied textures" (and its 2026-10-28 note).
- A pin label drawn before its font comes stays soft after the swap — on a slow network the self-hosted build's labels are the old build's, pixel for pixel; Leo, 2026-11-06: not in the order yet — "A pin label drawn before its font comes stays blurred after the swap".
- The full suite's time, and the 90 minutes a run is planned as, six ways to shorten it, none chosen — "The full suite takes 75 to 86 minutes".
- An alternative's main title: what the machine is, nominal size, fuel and kind, the model number under it; Leo has filled `webSize` (2026-11-08); the plan, third draft, `docs/plans/alternative-title-plan.md`, built, with the desktop card's height mended (`docs/plans/alternative-title-card-height-plan.md`), confirmed by him 2026-11-09. Its place in the order is in `docs/decisions.md` ("Amended 2026-11-07") — "An alternative's main title".
- A full suite's timeout, fadeRebuild's back wall slider on a slowed phone (2026-11-10, red once in three runs, green alone twice) — "A full suite's timeout".
- The phone's model card 18-20px taller than before the main title, `06 Dishwasher` moved up, nothing covered; Leo, 2026-11-09: shipped so, mended later in a round of its own — "The phone's model card".
- The import's `_meta` carries no day and no path: **done with 2026-11-08's import** — "The import's `_meta` is in the main chunk".
- A hood's own outlet first, then 79a (the cabinet over the hood opens) and 79b (the duct turning); the 30" option in A paused — "Registered rounds after 78".
- A Run Composer — D14; the two run towers on separate legs — D22, round 55.
- A flush install for an oven tower — "A flush install for an oven tower, as an option a package chooses".
- A model of another install type, for four more kinds of slot — the entry of that name.
- On a phone, the model card folding away once a model is chosen — the entry of that name.
- The model card over the render-mode switch on a narrow desktop — "On a narrow desktop the model card lies over…".
- A pin label under a full-height model card — the entry of that name.
- Where a desktop becomes a phone, 768 CSS pixels — the entry of that name.
- The camera staying where it was after a package switch — "After a package switch the camera stays where it was…".
- One Chinese word for two things, 清单 — the entry of that name.
- A dishwasher or a wine cooler under TCM24PS — "Is a dishwasher or a wine cooler under TCM24PS an approved combination?".
- A shallower drawer where the gas is at the back of a drawer base, Leo's site practice to confirm — the entry of that name.
- A hood at least as wide as the range under it, for the models — the entry of that name.
- A hood over an island held exactly centred — the entry of that name.
- A microwave drawer in a tall unit, once a manual allows it (MD24BS's alone) — the entry of that name.
- Three "taller than the opening" notes that mislead — the entry of that name.
- A 120V machine's generic power point at 42" — the entry of that name.
- A freestanding refrigerator in A's slot, and rule 7's check names — "Is a freestanding refrigerator in package A's slot drawn right?".
- Two install-view planes outside D21's three tiers — the entry of that name.
- The panels a machine draws above or below itself, with no face — the entry of that name.
- A filler's board coded by its width rounded to a sixteenth — the entry of that name.
- A package whose own range is missing from the catalogue — the entry of that name.
- HMCB36WS's chimney height that does not square — the entry of that name.
- What waits on documents: Package C's four installation manuals, PRG366WH's manual — their entries, and section 8 below ("Things the repository does not have").
- One axis written in: the one copy left — "One axis written in, found in round 49 and not fixed".
- Found in round 97 and not changed (a blower drawn in a hood that has its own; the workflow's actions on Node 20, among others) — "Found in round 97, not changed…".
- Day after a round trip through night — the entry of that name.
- A room rebuild's faint wash over the picture — the entry of that name.
- E's "07 Cooktop" label over a bar stool — the entry of that name.
- The layout checker's messages built in English — the entry of that name.
- The smoke suite's `-t` exemption, and the Chinese install lines that carry English — "The smoke suite's `-t` exemption does not take effect".
- Runs stopped part way with exit code 4 — the entry of that name.
- A fixed camera for screenshot diffs — the entry of that name.
- How far a phone reads the share box's code, Leo's to measure in the shop — the entry of that name.
- The scripts not wired to the page recorder (`screenshots.mjs`, `qualityDrop.mjs`, `swapMemory.mjs`, `analytics.test.ts`'s opening of the live site) stay unwired (Leo, 2026-11-05) — "A browser test that times out…", "Built 2026-11-05".

---

## 3. Where things are

| Path | What it holds |
|---|---|
| `data/*.json` | The product data: appliances, packages, slots, fixtures, rules, rough-in points, colours. Validated on load by `src/data/schema.ts` (D3). |
| `docs/decisions.md` | Every decision, numbered D1–D24, and the Open items. The record. |
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
| `src/data/fridgeFront.test.ts`, `src/store/fridgeModelGrew.test.ts`, `tests/fridgeFront.test.ts` | A built-in between its 3/4" side panel and its end, 35-3/4" doors with an eighth each side, flush with the cabinet doors; a model swap that needs more wall grows it and says so (D11 rule 11, the fridge-front round). |
| `tests/previewServer.test.ts` | The browser suite's preview server leaves its port free when stopped (round 89). |
| `src/data/hmcb36ws.test.ts`, `tests/chimney36.test.ts` | The 36" chimney hood HMCB36WS in A's, B's and D's openings, and a chimney hood's cover its own model's (D16, round 90). |
| `src/data/ral.test.ts`, `tests/ralColours.test.ts` | Every RAL Classic code with its source and date, the special finishes, and what the RAL input says under it (D15, round 92). |
| `src/data/nodeVersion.test.ts` | One Node major, 24: `.nvmrc`, `package.json`'s engines, the workflow reading the file, and the Node the suite runs on (D17, rule 1, round 93). |
| `src/data/ovenTower.test.ts` | Every oven tower a standard install — 30" overall, its 3/4" sides inside, a 28-1/2" opening, from `ovenTower.ts` — and what stands beside it on the far side: a board under 9", counter with wall cabinets over it from 9" (D11 rule 12, round 92c). |
| `src/data/toeKick.test.ts`, `tests/toeKick.test.ts` | What stands on the toe kick and what goes to the floor, where the kick runs, the corner piece, the island's 3", a dishwasher's kick panel, and rough-in in a base cabinet read from `cabinets.ts` (D22, round 92b). |
| `src/store/defaultDoors.test.ts`, `tests/defaultDoors.test.ts` | Every package opens with its doors in RAL 5015; the interface green and the accent palette unchanged (D15, round 92a). |
| `src/store/shareLink.ts`, `src/store/openLink.ts` | The share link: one table every setting is written and read by, and the page opened from a link checked by what it already asks (D23, round 94). |
| `src/data/layoutFields.ts`, `src/data/screenshotParams.test.ts` | The layout's half of that table, read by a link and by a screenshot address (`paramsFromQuery`, room.ts) alike; a field's `since` for links older than it, and the two old screenshot names as aliases (D23, round 98a). |
| `src/store/shareLinkV2.test.ts`, `src/store/shareLink.round97.json` | A link is `v=2` with the shape; five `v=1` links written by round 97's code open as an L, say nothing, and open round 97's room by its hash (D23, round 98a). |
| `src/data/layoutShape.ts`, `src/data/layoutShape.test.ts` | The layout's shape: the L's runs, the wall each is on, which way each faces, its ends, its corner; every run and box facing its run, left and right on four walls (D22, round 98a). |
| `src/store/shareLink.test.ts`, `tests/shareLink.test.ts` | A kitchen shared and opened comes back the same, settings, room and pins; older links and their notice; the table's completeness (D23, round 94). |
| `src/ui/shareQr.ts`, `tests/shareQr.test.ts` | The share box's QR code — L, 4 CSS pixels a module, loaded only when the box opens — read back to the link character for character (D23, round 95). |
| `tests/rightTabs.test.ts`, `tests/sheetTabs.test.ts`, `src/store/rightTab.test.ts` | The right panel's four tabs and the phone sheet's five: Look first, Install mode there and back, the checklist folded by machine, the tab kept for the browser tab (D12, round 91). |
| `tests/sliderWarning.test.ts` | No React style warning from the wall sliders, on Vite's development server, which it starts and stops (D12, round 91). |
| `src/analytics.ts`, `src/analytics.test.ts`, `tests/analytics.test.ts` | The visit counter: its own requests to GoatCounter's `/count`, every field count.js sends but `q`; the four events, each in its one place; nothing off the live site (D24). |
| `tests/topBar.test.ts` | The phone's top bar: no control over another at 360–414px in both languages, and a share button (D23, round 94). |
| `scripts/handFilled.test.ts` | The import stops when a checked model's hand-filled cells come in blank, unless `--allow-empty=MODEL` names it (D4, round 92). |
| `scripts/screenshots.mjs` | Screenshot sets by round. |
| `scripts/qualityDrop.mjs` | How often a build drops to the low quality tier on a 360 phone after tapping 中 then B, with fps each second; given two addresses, the old build and the new alternated run by run. Run it in any round that touches what the scene draws or how often it renders, against the build before the round (Leo, round 98b; D17). `VIEW=desktop TAB=layout`: a 1440 desktop by mouse, the Layout tab open, as the shop uses it (round 99a). `THROTTLE=<n>` slows the page's CPU n times over, and `ROUTE=` taps another path — `packages`, `shape`, `modes`, `e-onewall` (round 100). |
| `src/data/oneWall.test.ts`, `src/store/oneWallSwitch.test.ts` | One wall (round 98b): each package's run left to right, its wall, the rules, D's and E's one-wall packages; the shape switch putting the L back exactly, and a link to a one-wall kitchen; which model each opening keeps between the shapes, and every Undo button's words (round 98b-2). |
| `src/data/oneWallSwaps.test.ts`, `tests/rangeSwapBill.test.ts`, `tests/lightStrips.test.ts` | One wall builds its room round the range, hood and refrigerator chosen (`shapeOfChoice`, packages.ts); a range swapped shows on the wall's bill at once, in either shape; the under-cabinet strips follow the runs (round 99a). |
| `src/three/qualityRule.ts`, `src/three/qualityRule.test.ts` | When the quality guard drops a page to the low tier: two seconds under 55 fps, not counting the two seconds after the scene is rebuilt or made heavier — the room, a model or blower, the render mode, day or night, a finish that changes a texture, a side rail folded, the language, a tab opened (`sceneKey`; round 100, Leo). `QualityGuard.tsx` counts the frames and asks it. |
| `scripts/pixelShots.mjs`, `scripts/pixelCompare.mjs`, `scripts/pixelLinks.json` | The pixel proof (D17): 45 states shot whole and as the canvas alone, old build and new twice each, alternated, then compared state by state, each build also against itself. Shot at `?qualityLock=1` so the guard drops no page mid-shot (round 100; moved here from the rounds' scratch folders). Given the build's folder, it serves it itself through `scripts/previewServer.mjs`, the server's record in `<out>/server.jsonl` (the server-reset round). |
| `scripts/previewServer.mjs`, `scripts/previewServer.test.ts` | The test servers' launcher (the server-reset round, 甲; Leo, 2026-11-06): Vite's own `preview()` in a process of its own, recording every connection, request (status, bytes, ms, how it ended) and error, and its main thread's delay, to a file. `tests/globalSetup.ts` (into `test-results/preview-server/`) and `scripts/pixelShots.mjs` start their servers through it. |
| `scripts/serverResetLoop.mjs`, `scripts/resetLoopStats.mjs`, `scripts/heartbeat.mjs` | The server-reset loop (`docs/plans/server-reset-plan.md`): the page opened COUNT times as the pixel shots open it, with the server's record, a heartbeat every 250 ms, typeperf's CPU and disk each second and Chromium's network log; resets, stalls past 5 s and blank pages counted, each own file's median and slowest 1%. Not run yet — Leo sets when. |
| `tests/qualityLock.test.ts` | `?qualityLock=1` holds a page at its tier however slow it is; without it the guard still drops (round 100, for the pixel proofs only). Asked on a page every frame of which the test holds 30 ms; the CPU slowed sixteen times, as it was, failed about one run in fourteen, the room slow only in its first seconds (the quality lock's test round, 2026-11-04; item 4a above). |
| `scripts/finishImport.test.ts`, `src/store/panelReady.test.ts`, `tests/panelReady.test.ts` | webColor SS or Panel Ready and nothing else; a column's -SS row its pair's in every cell but Model, webColor, msrpUSD and pairModel, or the import stops; the two rows' rough-in, packages, links of every version, list lines and quote; the card's switch by mouse and by finger (the columns' two rows round). |
| `scripts/swapMemory.mjs` | The renderer's geometries and textures, and the heap, after each of fifty model swaps in a row (round 100, measured only). |
| `src/ui/PartFence.tsx`, `src/ui/fault.ts`, `tests/partFence.test.ts` | Five parts fenced off — the right panel, the 3D scene, the left panel, the quote page, the link's notice: a part that fails shows Leo's sentence and Retry, a package switch retries it, the visit counter records which part. `?fault=<part>` makes one fail, for the tests only (round 99c). |
| `src/three/useSceneFrame.ts`, `src/three/sceneFrame.test.ts` | Every frame's work in the 3D scene goes through one hook, which hands an error thrown in a frame to the scene's fence (`FrameFailureRelay`); no other file takes `useFrame` from fiber (round 99d). |
| `src/three/useDisposable.ts`, `tests/geometryReturn.test.ts` | A geometry a component makes in code and hands the scene (`<mesh geometry={made}>`, `<primitive>`) is freed when it is replaced or taken down — fiber frees only what is declared in JSX; sixteen places use it. A machine or package changed away and back brings the renderer's geometries back to the same number, on a 1440 desktop, a 768 tablet and a 390 phone, read at the default view (the geometries' round). |
| `src/data/chimneyFillers.test.ts`, `src/three/hoodHooks.test.ts`, `tests/hoodKinds.test.ts` | A chimney hood narrower than its opening has a filler each side in the wall cabinets, 54" to 108" under the crown, on no list, in the 31 rooms where one is and in none of the others, and comes and goes with the hood (D16, amended 2026-10-24). The hood's hooks all before its first `return`, read off the source; a hood swapped between an insert and every other kind, by mouse and by finger, with no error (the chimney fillers' round). |
| `tests/shareNotice.test.ts` | A link notice of more than three lines is one sentence with Details and Hide details; three or fewer listed (round 99d). |
| `src/data/nameFallback.test.ts` | A machine with no name found is called by its position's own name; `NAME_FALLBACKS` lists each fallback, which the words test asks to be empty (round 99c). |
| `tests/shareLinkCut.test.ts` | Every field of a share link left out in turn, at `v=1` and `v=2`: the page stands and the notice names what is missing (round 99c). |
| `tests/layoutTabSwitch.test.ts` | With the Layout tab open, every package tapped after every other keeps the page, in both shapes, on a 1440 desktop, a 768 tablet and a 390 phone (round 99b). |
| `src/data/roomSets.ts`, `scripts/lDump.ts`, `scripts/oneWallDump.ts` | The rooms every proof builds, listed once: the L's 1,045 (round 98a) and one wall's 91 (round 99a), 1,063 and 106 since the columns' two rows round (each column's own number a swap of its own). The two dumps write them out as geometry and words, one a line — run each on the commit before a round (`ROOT=<tree>`) and on the round, and compare; `machineLabel.test.ts` reads every word on their bills (round 99a). |
| `src/ui/useIdleValue.ts`, `src/store/staleBand.test.ts` | The Layout tab's wall figures and greyed band worked out in the page's idle time after a rebuild; a wall length asked for while the band is still the room's before is refused by the room (round 99a). |
| `src/data/machineLabel.ts`, `src/data/machineLabel.test.ts` | What a machine is called: `slotLabelKey` for every pin, card, list, quote line and share notice, `billLabelKey` for a wall's bill; every model each slot can hold named by what it is (D10, round 99). |
| `src/ui/shapeControls.ts`, `src/ui/shapeControls.test.ts` | Which Layout tab controls one wall shows, held to the settings one wall decides itself (round 98b-2). |
| `src/store/shareLinkRound98b1.test.ts`, `src/store/shareLink.round98b1.json` | Ten links written by 98b-1's code open the same room by its hash, but E on one wall, which opens at its own wall (round 98b-2). |
| `scripts/siteRoute.mjs`, `scripts/siteRoute.test.ts`, `tests/siteRoute.test.ts` | 丁: every browser test and pixel script has its page answered from `dist/` by Playwright, never through a connection on this machine; three openings kept on the real server and marked, a static and an end-of-suite guard (Open items, "A browser test that times out…", "丁's wiring" and "Closed"). |
| `src/data/hoodMount.ts`, `src/data/hood.ts`, `src/data/cookingSurface.ts`, `src/data/eOneWallHood.test.ts` | A hood's underside: the cooking surface plus **the shop's installation distance**, `SHOP_INSTALL_DISTANCE_IN` (微波炉式以外的油烟机 30"，微波炉式 24"), one rule, `hoodUndersideIn`; each hood's manual range apart, `HOOD_MANUALS`, a check and the words beside the line; `cooktopGlassIn` (Open items, "An induction cooktop in B and D", "Found while building it", and "E on one wall"). |
| `src/data/inductionRangetop.test.ts` | HIS8055U and CIT367YG in B's and D's rangetop choice; every cooking surface in the stone on a swing-door `B36`; nothing within 4-3/4" under the counter (Open items, "An induction cooktop in B and D"). |
| `src/data/machineLabel.ts` (`alternativeTitle`), `src/data/alternativeTitle.test.ts`, `tests/alternativeTitle.test.ts` | **An alternative's main title**: nominal size (`webSizeIn`, never the width), fuel, kind, and the look where the catalogue has a pair; brand · model under it; written once, on the model card and in the list (Open items, "An alternative's main title"). |
| `scripts/webSizeImport.test.ts` | `webSize` at the import: a number on every machine but a blower, or the run stops; `_meta` with no day and no path, the same bytes on another day. |
| `tests/desktopCardHeight.test.ts`, `tests/fixtures/desktopCardLive.json` | The desktop model card as tall as before the main title and the pin labels where they were, against the live layout read from `a2a8646`'s build; every title on one line at 1440 and 1280 (Leo, 2026-11-09, 乙). |
| `src/data/columnModel.ts` (`ovenFront`, `OVEN_PANELS`), `src/data/ovenFront.test.ts` | **Each oven's front from its own sheet**: doors and control panels, a single oven drawn as the others; panel heights measured off each sheet's photograph (no guide prints them; the method in "The ovens do not look like ovens", the script `docs/plans/ovens-control-panel-2026-11-09/measure.py`). |
| `src/data/ovenTrim.ts` | A hung oven's trim from its sheet (MEM301WS, PODS302B, ME301YP, PO302W): its front on the doors' plane; a machine shorter than the tower's hole laps its own cutout. |
| `src/data/towerOven.ts`, `src/store/ovenTowerOpening.test.ts` | **An oven tower's opening grows to the oven chosen** where its standard cutout is taller, never shrinks — B, D and E (Leo, 2026-11-10); there, back, and from a share link. |
| `src/data/layoutShape.ts` (`cornersOf`, `validateShape`), `src/data/uShapePrep.test.ts` | **U-0, the U's preparation** (2026-11-10, page unchanged): a corner eats either end of a run (`ShapeCorner.at`), a run named `right`; rule 1 at a corner a run's high end meets, rule 10 from the corner at either end, a hood centred along the run its range stands on, a corner end not a run's finish; a susan's door and toe kick at either back corner (`diagonalDoor`, `kickIntoCorners`, `cornerKick`) — on a U stood up by hand. |
| `src/data/layoutTemplate.ts` (`uLegs`, `uWantedIn`, `sparesRun`, `U_PANTRY`), `src/data/counter.ts` (`uPieces`, `firstSeam`, `SLAB_MAX_IN`), `src/data/room.ts` (`serviceEntry`), `src/data/uShape.test.ts` | **U-1, the U's data and generator** (2026-11-11, page unchanged; `shape=U` by a hand-edited link): the three legs, the walls, the stone in three slabs seamed at 120", a dishwasher 12" off a corner, the aisle between facing legs, the pantry cabinet `T1596` (a cabinet a neighbour's socket goes in, `roughIn.ts`); B's refrigerator against its counter in the U (Leo, 2026-11-11); 12 groups. |
| `scripts/uDump.ts`, `src/data/roomSets.ts` (`uRooms`) | The U's dump, one room a line, 112 rooms, all three legs' requirement and bill; from U-2 on run on the commit before a round and on the round, as the L's and one wall's are. |
| `src/three/ovenFrontMeasure.ts`, `src/three/ovenFrontMeasure.test.ts` | How smoke's "a hung oven's front" reads the front: only handles, and parts marked `knob` within the handle's printed 2-5/8", stand proud; an unmarked part counts (Leo, 2026-11-10). |

Commands: `npm run dev`, `npm run build`, `npm run test:unit` (unit only,
`vitest.unit.config.ts`), `npm test` (build then the whole suite including the
browser smoke tests, `vitest.config.ts`), `npm run screenshots`, and
`node scripts/qualityDrop.mjs <old url> <new url>` against two preview
builds (`RUNS=10` by default).

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
  no row of its own. One is still open, deliberate: the first. The
  eighteenth (round 94, a layout figure in a page's address read by the
  screenshot parameters and by the share link's table) was joined in round 98a
  (D23); the twelfth (round 84,
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

## 6. Working with Leo (和 Leo 一起工作的做法)

The rules this project's sessions have worked to, gathered in one place on
2026-11-06 for a session that starts with nothing but the repository. Most
were set by Leo after something went wrong; where a rule has its record in
`docs/decisions.md` (mostly D17), that record is the text and this is the
list.

### The order of a round

1. **A plan first**, written for Leo and shown to him. **Nothing is built
   before he confirms it** (「每一轮都先写计划给我看，确认后再动手」). A plan says what
   changes, which rooms, before and after, what stays as it is, and the
   questions he has to answer.
2. **He confirms**, often with answers; his answers go into
   `docs/decisions.md` in his words, with the date. A new requirement that
   arrives mid-round is **registered only** (Open items, his words, its place
   in his order written in `docs/decisions.md` alone) and does not interrupt
   the round.
3. **Build it**: tests red first (below), then the code, then the proof.
4. **A local preview**, and the report names its main chunk
   (`assets/index-….js`). The preview server is `vite preview` on 4173; the
   app stops it between turns, so before Leo looks it is started again and
   the chunk it serves is checked to be the one reported.
5. **Leo looks at the preview and says so** (his words are like
   「…预览看过了（index-….js），可以提交」). **Without his look nothing is
   committed.** Until then every report says the live site does not have it,
   names the live commit and chunk, and labels every screenshot with its
   build.
6. **Commit and push.** Before the push, CI's own commands on the tree as
   committed: `npm ci`, `npm run test:unit`, `npm run build`.
7. **Report the deploy's two jobs**: `gh run watch` on the Pages run, then
   each job's (build, deploy) conclusion and times, and the run's number.
8. **Check the live site file by file.** After the commit (the commit is
   compiled into the main chunk, so a build before it never matches), build
   with the counter's address,
   `VITE_GOATCOUNTER=https://geesonchan.goatcounter.com/count npm run build`,
   the tree clean; fetch every file the live site serves; list each file's
   name, its size, and whether it is the same byte for byte. Write it into
   `docs/decisions.md` under the round, as "Shipped"; that change to the
   docs is committed with the next round (or on its own when Leo asks).

### Reports

- **Leo reads Chinese** — the report in Chinese, plain words, easy to read
  on a phone: short paragraphs and lists, no wide tables (a table of two or
  three narrow columns is the most). Code names and file names stay as
  they are.
- **The results are in the report itself**: the numbers, the files, the
  counts — never only "done", and **never only in the app's next-step box**,
  which he has missed twice. The whole report as a message first, the box
  after it.
- **Before the report goes out**, every probe, aside and "note this" from
  the round is in the report or in Open items (D17, round 73).
- **A figure is quoted from the run that was checked**, and says which run.
- **Every step with its start, its end and its exit code, and the files
  changed** (Leo: 「报告里写清楚：改了哪些文件；每一步的开始、结束时间和 exit code」).
  **A step that failed is written as it failed** — 「中途哪一步失败了照实写，不要重跑掉」
  — and a run made again is listed beside it, not in its place.
- **The live site's check goes into the report's own text**: the commit, the
  main chunk's name, each file's status and headers, the Pages run's two jobs.
- **A flaky or red result is reported as it was**, with its record; it is
  not a pass. Run again, and report both.
- **What Leo sends from his shop is data, not code**: site practice, the
  shop's own names for things, anything he is to choose — give the options
  and a suggestion with its reason, and **do not choose for him**
  (「不要选，等我答」).

### Tests

- **A new test is run red on the old code first**, and why it is red is
  read and written down, before the code changes.
- **An old test whose expected figure changes** says why, beside it, with
  the round and Leo's answer it follows.
- **An old test whose check changes** (what it measures, how it reads the
  scene) is shown to check the same thing as before — on the old build and
  the new — and the reason is written beside it.
- Fixtures that are symmetric (square openings, nothing turned) pass broken
  logic: pick lopsided cases.
- **A test with a fake in it shows it can go red**: a fake hood whose manual
  says 32" in the real table (E on one wall), a fake size far from its width
  (the main title) — put in, the test red, taken out, green.
- **An exemption in a test is narrow** (Leo, 2026-11-10, the ovens' knobs):
  only the part marked for it, only as far as a printed figure allows, and a
  test that an unmarked part goes red.
- **A browser test is run red on the old build too**: copy the old build into
  `dist/`, run it, put the new one back.
- A script `click()` in the page and a real mouse, finger or key can differ
  here (D17): say which input a result came from, and check both before
  saying what a customer sees.

### The proof of a round that touches the room

- **The dumps, line by line**: `scripts/lDump.ts` (the L, 1,063 rooms) and
  `scripts/oneWallDump.ts` (one wall, 106), on the commit before the round
  (`ROOT=<tree>`) and on the round; every changed line accounted for by the
  plan, and nothing else changed.
- **Pixels**: `scripts/pixelShots.mjs` and `scripts/pixelCompare.mjs`, 45
  states, the quality locked (`?qualityLock=1`), the old build and the new
  each shot twice, alternated (old, new, old, new), each build also against
  itself. A difference in the room is never explained away; close-ups
  before and after for Leo where it changes. **The old build is built from
  the commit itself** (a `git worktree` of it), so its footer stamps the
  commit and not `dev` (Leo, 2026-11-10).
- **What a pixel proof says**: the 3D canvas, shot alone, the same to the pixel
  in every state not named; the states meant to change listed one by one, each
  with a close-up before and after; on the whole screen, every changed pixel
  inside a text that changed, and any pin label that moved named.
- **Real input for every swap a round touches**: the mouse on a desktop and a
  finger on a phone, each once, the page's errors read.
- **The full suite** (`npm test`; how long it takes, and the 90 minutes a
  run is planned as, are in decisions.md, Open items, "The full suite
  takes 75 to 86 minutes"):
  - **Before it**, read the power plan: turning the screen off, sleep and
    hibernate all "never" (`powercfg /query`).
  - **Tell Leo before it starts**, and keep the session's turn open until it
    ends.
  - **Around 18:00 Leo may put the computer to sleep by hand**: do not start
    a run that would cross it without telling him first.
  - **The system log at the start and the end**: any sleep or standby in
    the run (events 42, 506, 507, 107, 187) means it is **not a pass**,
    however it ended. So does any red.
  - Vitest's exit code is written to a file of its own (D17).
  - **It runs on the commit that ships.** A change after the last full suite,
    however small, means another run on the commit itself — a `git worktree`
    of it, so nothing uncommitted is in it (Leo, 2026-11-10: 96cfaf9 had not
    had one).
- **A preview server that is stopped is checked to be gone**: its port free,
  and no `node.exe` or `esbuild.exe` left from it — a leftover `esbuild.exe`
  makes `npm ci` fail on the locked file. End them by hand before `npm ci`.
- Windows: Python's `open()` writes CRLF here, and every text file is LF;
  edit repository files with Node or the editor tools, and quote a diff's
  size from `git -c core.autocrlf=false diff --stat`.

### Figures and their sources

- **A manufacturer's document goes into `docs/reference/`**, with a row in its
  `README.md`: what it is, where it came from (the URL, the server's own date),
  and what it settles (Leo: 「官方说明书放进 docs/reference/，写明来源」). A figure with
  no source there is not a source (D21).
- **A figure is the printed one first**: the installation guide, then the spec
  sheet, with the file and the page. **Where none prints it**, it is measured
  off the sheet's photograph, and `docs/decisions.md` says so — 「从照片量出，推断」
  — with the method, so it can be measured again (Leo, 2026-11-09; the ovens'
  panels, "The ovens do not look like ovens").
- **The shop's practice and a manual's figure are written apart**: the rule
  uses the shop's (the shop's installation distance, 30" and 24"); the
  manual's minimum and maximum are a check and the words beside the line
  (Leo, 2026-11-08). A rule is written once (D17).

### Imports from Leo's sheet

- **A dry run first**, compared against the catalogue in the repository:
  only the cells Leo changed may change. **If anything else changes, stop**
  and list every one of them for him; write nothing.
- **The catalogue and the code that reads it go in one commit** — a
  catalogue without its code can draw the wrong thing (the panel-ready
  round, `docs/plans/overnight-2026-10-28.md`).
- The import's own rules are D4 and `docs/data-sheet-spec.md`; `_meta` carries
  the provenance alone, no day and no path (Open items, "The import's `_meta`
  is in the main chunk", 2026-11-08).

### Nights, with nobody there

- What was done goes into **`docs/plans/overnight-<date>.md`**, in Chinese,
  with **a five-minute summary at the top**: what was done, the proof, what
  he has to answer, in order of weight.
- **Commit only what Leo has said, in so many words, may be committed**;
  everything else stays in the working tree and the report says so, with the
  live commit named.

### When this file and the repository disagree

A brief written in chat once said a decision was "written into D20" when the
file said nothing of the kind. **Read the repository.** If something this
file or a message says is decided is not in `docs/decisions.md`, write it in,
with where it came from, and tell Leo it was missing.

---

## 7. Open items

**In `docs/decisions.md`, at the end, under "Open items".** Read them there.
They are not copied here on purpose: a second list would be wrong within a
round, and this file would then be the thing people believed.

---

## 8. Things the repository does not have

Each is recorded where it bites, so go to the section rather than trusting a
list here:

- **Package C's four installation manuals** — its five machines' rough-in
  cannot be recorded without them, and the three drawings that are in
  `docs/reference/` carry no connection at all (Open items; D17's round-72
  entry).
- **T36IT100NP's own sheet** — the 84" it is drawn to is an inference (D4,
  round 40).
- ~~The T18IF900SP door panel drawing, Thermador's column-spacing drawing, the
  flush columns' own sheets~~ — **in since round 98**: the six flush columns'
  sheets (T18IF900SP's own, page 3 its panel) and the four Freedom column
  installation instructions, page 9 the spacing and the 1-3/16" beside a hot
  appliance (D11's round-53 note). What each says, page by page:
  `docs/reference/README.md`.
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
- **The 18" column's panel drawing, `t18iw905sp-panel.png`** — not here, and
  not needed since round 98: `t18iw905sp-spec.pdf` page 3 is the same drawing,
  and `WINE_COLUMN`'s figures are its own.

What is inferred rather than read off a drawing is marked in the data itself:
every rough-in point carries a `provenance`, and the install view draws the
three tiers differently (D21). `rough-in.json`'s `basis` fields say which
figures in a point are the guide's and which are not.

---

## 9. What is registered and not started

Four things, each with its source:
- **A Run Composer** — registered in D14, before building it.
- **The two run towers on separate legs** — D22, round 55: "splitting them
  across two legs is not being built now".
- **The rest of the layout shape switch: the U** — registered in round 98,
  from a colleague's feedback from use; one wall is built (rounds 98a, 98b-1,
  98b-2). **The galley is cancelled** (Leo, 2026-11-10: "直接做 U 型，不做走廊式");
  **the U is next**, its plan in `docs/plans/u-shape-plan.md`, not started
  (Open items, "The U: Leo's answers of 2026-11-10, and the galley cancelled",
  and "A layout shape switch"). Round 98's plan,
  `docs/plans/round-98-layout-shape-plan.md`, reads where the code holds for
  it and where it does not.
- Whether a hood follows the cooking surface actually chosen, against D13's
  drilled once — B, C and D with a 36-3/4" range read under the minimum; Leo,
  2026-11-08: later (Open items, "Should a hood follow the cooking surface
  actually chosen?").

And the rounds Leo has queued, with what he decided for each: the last entry of
the Open items, "Registered rounds after 78".

**Do not start one without Leo.** Anything else that sounds planned and is not
in `docs/decisions.md` was not planned (D17, round 77).

---

## 10. Keeping this file honest

- It is an index. If you find yourself copying a figure, a rule or an open item
  into it, stop: link the section instead.
- `src/data/handoff.test.ts` checks that every `D<number>` this file mentions
  exists as a section in `docs/decisions.md`. A renumbered or deleted section
  turns the suite red here rather than misleading the next reader.
- When a round changes how the work is done, the rule goes in
  `docs/decisions.md` and at most one line goes here.
