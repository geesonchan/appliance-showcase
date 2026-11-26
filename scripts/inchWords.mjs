/**
 * Item 12e-3, D25, the page's guard: the words a build actually shows, as the
 * pixel proof records them (`<name>.texts.json` from scripts/pixelShots.mjs)
 * and as the dumps write them (scripts/oneWallDump.ts, lDump.ts, uDump.ts:
 * every finding's `en` and `zh`), held to how an inch figure is written.
 *
 *   node scripts/inchWords.mjs <pixel shots folder | dump .jsonl> ...
 *
 * Prints each breaking text with where it was found, and exits 1 if there is
 * one. Red on:
 * - a figure followed by " (the straight mark);
 * - a decimal before ″;
 * - ″″ (a mark written twice);
 * - a fraction under an inch written with a 0 (0-3/4″);
 * - ½ ¼ ¾ ⅛ ⅜ ⅝ ⅞.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const RULES = [
  ["a straight mark after a figure", /\d"/],
  ["a decimal before ″", /\d\.\d+″/],
  ["″ written twice", /″″/],
  ["0- before a fraction", /(^|[^\d])0-\d+\/\d+″/],
  ["a fraction character", /[½¼¾⅛⅜⅝⅞]/],
];

export function breaks(text) {
  return RULES.filter(([, rule]) => rule.test(text)).map(([name]) => name);
}

function* textsOf(path) {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path).filter((n) => n.endsWith(".texts.json")).sort()) {
      const record = JSON.parse(readFileSync(join(path, name), "utf8"));
      for (const found of record.found ?? []) yield [`${name}`, found.t];
    }
    return;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    const row = JSON.parse(line);
    for (const finding of row.room?.findings ?? []) {
      for (const lang of ["en", "zh"]) if (finding[lang]) yield [`${row.label} ${finding.messageKey ?? ""} ${lang}`, finding[lang]];
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith("inchWords.mjs")) {
  const seen = new Map();
  let texts = 0;
  for (const path of process.argv.slice(2)) {
    for (const [where, text] of textsOf(path)) {
      texts++;
      const why = breaks(text);
      if (!why.length) continue;
      const key = `${why.join(", ")} | ${text}`;
      if (!seen.has(key)) seen.set(key, { where, count: 0 });
      seen.get(key).count++;
    }
  }
  for (const [key, { where, count }] of seen) console.log(`${count}x  ${key}   (first: ${where})`);
  console.log(`texts read ${texts}; breaking texts ${seen.size}`);
  process.exit(seen.size ? 1 : 0);
}
