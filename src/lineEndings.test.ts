import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Every text file the repository tracks ends its lines with LF, in the index
 * and in the working tree. Round 97, Leo: the round's edits came out of a
 * Windows machine with CRLF in twenty-nine files, and the diff read twenty
 * thousand lines where about a thousand had changed. `.gitattributes` asks git
 * for LF; this holds the files to it, whatever wrote them.
 *
 * Read from `git ls-files --eol`, which says for each tracked file what git
 * finds in the index (`i/`) and in the working tree (`w/`): `lf`, `crlf`,
 * `mixed`, `none`, or `-text` for a file it takes to be binary.
 */

interface Entry {
  path: string;
  index: string;
  tree: string;
}

const entries: Entry[] = execFileSync("git", ["ls-files", "--eol", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\0")
  .filter(Boolean)
  .map((line) => {
    const [info, path] = line.split("\t");
    const [index, tree] = info.trim().split(/\s+/);
    return { path, index: index.replace(/^i\//, ""), tree: tree.replace(/^w\//, "") };
  });

/** Text, by git's own reading of the index; binary files (`-text`) are not asked. */
const text = entries.filter((entry) => entry.index !== "-text");
const crlf = (eol: string) => eol === "crlf" || eol === "mixed";

describe("line endings (round 97)", () => {
  it("reads the tracked text files, and finds some", () => {
    expect(text.length, `${text.length} of ${entries.length} tracked files are text`).toBeGreaterThan(100);
  });

  it("finds no CRLF in any of them, in the index or in the working tree", () => {
    const found = text.filter((entry) => crlf(entry.index) || crlf(entry.tree)).map((entry) => entry.path);
    expect(found, `${found.length} of ${text.length} text files carry CRLF`).toEqual([]);
  });
});
