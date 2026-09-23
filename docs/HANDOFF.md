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

Covers the repository up to **round 72** (`docs/decisions.md` is the record of
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

---

## 3. Where things are

| Path | What it holds |
|---|---|
| `data/*.json` | The product data: appliances, packages, slots, fixtures, rules, rough-in points, colours. Validated on load by `src/data/schema.ts` (D3). |
| `docs/decisions.md` | Every decision, numbered D1–D22, and the Open items. The record. |
| `docs/data-sheet-spec.md` | Where each field of `appliances.json` comes from in Leo's inventory sheet, and what the importer does to it. |
| `docs/reference/` | Manufacturer drawings and manuals, with `README.md` listing every file and what it settles. A figure with no entry here is not a source (D21). |
| `src/data/` | The geometry and the rules: room and runs, cabinets, layout template, layout rules, rough-in, quote, checklist. |
| `src/three/` | The scene: cabinets, appliances, utilities, rough-in layer, camera. |
| `src/ui/` | Panels, install checklist, quote sheet, spec card. |
| `src/i18n/` | `en.json`, `zh.json`, `reviewed.json` (copy Leo has approved, locked to his words), `index.ts` (`translate`, `sayWith`). |
| `tests/smoke.test.ts` | The browser suite: a real build in a real browser. |
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
  written twice — seven so far, two still open.
- **Visual changes are proved by pixel diff**, live against local, mouse
  clicks, `?quality=high` pinned. A difference is zeroed one of two ways:
  put the changed value back, or shoot the same build twice. **A difference
  inside the room is never waved away with an explanation.** D17.
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
- Windows: PowerShell splits `"` in a commit message (`git commit -F`), and
  `\n` written through a shell or Python lands as a real newline — use the
  editor tools for i18n strings and scripts.

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
- **T36IT100NP's own sheet** — the 84" it is drawn to is an inference (D13).
- **The T18IF900SP door panel drawing** — the 18" freezer column's panel is
  drawn from the 18" wine column's (D20).
- **Thermador's column-spacing drawing** — the 1-3/16" clear between hot and
  cold is recorded and deliberately not implemented (D11 rule 12).
- **HMCB30WS's installation manual** — package C's chimney route is an
  inference (D20).

What is inferred rather than read off a drawing is marked in the data itself:
every rough-in point carries a `provenance`, and the install view draws the
three tiers differently (D21). `rough-in.json`'s `basis` fields say which
figures in a point are the guide's and which are not.

---

## 8. What is registered and not started

D20's tail and the Open items list them — U-shaped and galley layouts, the
airflow path as a third utility tier, a `roughInSide` field, exporting the
rough-in list as an installation sheet, showing data completeness in the
install view, the two run towers on separate legs, a Run Composer, glTF.
**Do not start one without Leo.**

---

## 9. Keeping this file honest

- It is an index. If you find yourself copying a figure, a rule or an open item
  into it, stop: link the section instead.
- `src/data/handoff.test.ts` checks that every `D<number>` this file mentions
  exists as a section in `docs/decisions.md`. A renumbered or deleted section
  turns the suite red here rather than misleading the next reader.
- When a round changes how the work is done, the rule goes in
  `docs/decisions.md` and at most one line goes here.
