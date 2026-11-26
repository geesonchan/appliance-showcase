/**
 * Item 12e-3, D25: an inch figure is written by `src/data/inchText.ts` and by
 * nothing else in `src/` (as `sceneFrame.test.ts` holds `useFrame` to one file).
 *
 * Every non-test .ts / .tsx under `src/` is read with TypeScript's own parser,
 * so what is inside a string is told from the quotes that end it. Red on:
 * - a mark (`"`, `″`, `′`) right after a figure or a `${}` inside a string,
 *   a template or JSX text;
 * - JSX writing `&quot;` (or `&Prime;`, `&#8243;`) after a figure or an
 *   expression;
 * - a regular expression naming a mark (`.replace(/"$/, "")`, which strips one
 *   written elsewhere);
 * - a second fraction function: a template writing `${n}/${d}`.
 *
 * The exceptions, each by file and name, each with its reason, and no other:
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// The tests run from the repository's root, as sceneFrame.test.ts walks "src".
const SRC = "src";
const HOME = "data/inchText.ts";

/** file -> names (a property, a variable, a type, a function) a mark may stand inside. */
const EXEMPT: Record<string, Record<string, string>> = {
  "data/hood.ts": {
    // A manual's own words, quoted where a figure is said to come from; not on the page.
    GAS_AND_INDUCTION: "the hood manuals' sentence, quoted word for word",
    read: "where a hood's figures were read, the manual quoted word for word",
    basis: "where an OTR template's figures come from, the template's words",
  },
  // Leo, 2026-11-24: 「燃气管径在显示的时候换成 ″，数据和类型不动。」 The gas pipe's size is data
  // written '1/2"' / '3/4"'; its type and the check of it stay as they are, by file and name.
  // Leo, 2026-11-25: 「燃气管径的豁免 4 个名字都留。」 The constant and the check compare the data's own
  // string, which is not on the page.
  "data/schema.ts": { pipeSize: "the gas pipe's size as the data writes it (its type)" },
  "data/rules.ts": {
    GAS_PIPE_BASE: "a constant compared with the data's own string; not on the page",
    GasPipe: "the gas pipe's size as the data writes it (its type)",
    gasPipeFor: "the check compares the data's own string with the type's two sizes; not on the page",
  },
};

interface Hit { file: string; line: number; what: string; text: string }

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

/** The names a node stands inside: properties, variables, types, functions. */
function namesAround(node: ts.Node): string[] {
  const names: string[] = [];
  for (let at: ts.Node | undefined = node.parent; at; at = at.parent) {
    const named = at as ts.Node & { name?: ts.Node };
    if (
      (ts.isPropertyAssignment(at) || ts.isVariableDeclaration(at) || ts.isTypeAliasDeclaration(at) ||
        ts.isFunctionDeclaration(at) || ts.isPropertySignature(at)) && named.name && ts.isIdentifier(named.name)
    ) names.push(named.name.text);
  }
  return names;
}

const FIGURE = /[0-9½¼¾⅛⅜⅝⅞]/;
const ENTITY = /&quot;|&#34;|&#x22;|&Prime;|&#8243;|&#x2033;|&prime;|&#8242;/;

function scan(): { hits: Hit[]; exemptUsed: Set<string> } {
  const hits: Hit[] = [];
  const exemptUsed = new Set<string>();
  for (const path of sourceFiles(SRC)) {
    const file = relative(SRC, path).split(sep).join("/");
    if (file === HOME) continue;
    const text = readFileSync(path, "utf8");
    const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
    const add = (node: ts.Node, what: string) => {
      const exempt = EXEMPT[file];
      const name = exempt && namesAround(node).find((n) => n in exempt);
      if (name) { exemptUsed.add(`${file}:${name}`); return; }
      hits.push({ file, line: lineOf(node.getStart(sf)), what, text: text.split("\n")[lineOf(node.getStart(sf)) - 1].trim().slice(0, 140) });
    };
    const visit = (node: ts.Node) => {
      const K = ts.SyntaxKind;
      let raw: string | null = null;
      let afterPlaceholder = false;
      let previousEndsInQuote = false;
      if (node.kind === K.StringLiteral || node.kind === K.NoSubstitutionTemplateLiteral || node.kind === K.TemplateHead) {
        raw = (node as ts.LiteralLikeNode).text;
      } else if (node.kind === K.TemplateMiddle || node.kind === K.TemplateTail) {
        raw = (node as ts.LiteralLikeNode).text;
        afterPlaceholder = true;
        // The literal piece before this one's placeholder: a `"` there opens a quotation round a name.
        const span = node.parent as ts.TemplateSpan;
        const template = span.parent as ts.TemplateExpression;
        const index = template.templateSpans.indexOf(span);
        const before = index === 0 ? template.head.text : template.templateSpans[index - 1].literal.text;
        previousEndsInQuote = before.endsWith('"');
      } else if (node.kind === K.JsxText) {
        const jsx = (node as ts.JsxText).getText(sf);
        const at = jsx.search(ENTITY);
        if (at >= 0 && (at === 0 || FIGURE.test(jsx[at - 1]))) add(node, "an entity mark in JSX");
        raw = (node as ts.JsxText).text;
      } else if (node.kind === K.RegularExpressionLiteral) {
        if (/["″′]/.test((node as ts.RegularExpressionLiteral).text)) add(node, "a regex naming a mark");
      }
      if (raw !== null) {
        for (let i = 0; i < raw.length; i++) {
          const ch = raw[i];
          if (ch !== '"' && ch !== "″" && ch !== "′") continue;
          const atPlaceholder = i === 0 && afterPlaceholder;
          if (ch === '"' && !(FIGURE.test(raw[i - 1] ?? "") || atPlaceholder)) continue;
          if (ch === '"' && atPlaceholder && previousEndsInQuote) continue; // "${name}": a quotation, not a mark
          add(node, `a mark ${ch} after a figure`);
          break;
        }
      }
      // A second fraction function: a template that writes `${n}/${d}`. (Rounding a length to
      // sixteenths for geometry, as cabinets.ts does, writes nothing and is not one.)
      if (ts.isTemplateExpression(node) && /\}\/\$\{/.test(node.getText(sf))) {
        add(node, "a fraction written outside inchText");
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { hits, exemptUsed };
}

const { hits, exemptUsed } = scan();
const of = (what: string) => hits.filter((hit) => hit.what.startsWith(what)).map((hit) => `${hit.file}:${hit.line}  ${hit.text}`);

describe("an inch figure is written in inchText.ts and nowhere else in src/ (D25)", () => {
  it("no mark after a figure or a placeholder in a string, a template or JSX text", () => {
    expect(of("a mark")).toEqual([]);
  });
  it("no &quot; (or ″'s entities) after a figure or an expression in JSX", () => {
    expect(of("an entity mark")).toEqual([]);
  });
  it("no regex naming a mark", () => {
    expect(of("a regex")).toEqual([]);
  });
  it("no second fraction function", () => {
    expect(of("a fraction")).toEqual([]);
  });
  it("every exception is still needed, so the list cannot grow stale", () => {
    const listed = Object.entries(EXEMPT).flatMap(([file, names]) => Object.keys(names).map((name) => `${file}:${name}`));
    expect(listed.filter((entry) => !exemptUsed.has(entry))).toEqual([]);
  });
});
