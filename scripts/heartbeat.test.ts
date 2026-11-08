import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beat } from "./heartbeat.mjs";

/**
 * The heartbeat beside the server-reset loop (docs/plans/server-reset-plan.md,
 * section 2, 甲): a process of its own that asks the test server for one small
 * file every 250 ms and writes how long each took. When the server stalls the
 * heartbeat slows with it; when the browser stalls and the server does not,
 * the heartbeat does not. Held here against a server of the test's own, one
 * that answers at once, once late on purpose, and then is gone.
 */

let server: Server;
let url: string;
let calls = 0;
beforeAll(async () => {
  server = createServer((req, res) => {
    calls += 1;
    const late = req.url === "/late" ? 300 : 0;
    setTimeout(() => res.end("ok"), late);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("one beat", () => {
  it("gives the time, the status and the bytes; a late answer is as late as it was; no server is an error, not a throw", async () => {
    const quick = await beat(`${url}/quick`, 5_000);
    const late = await beat(`${url}/late`, 5_000);
    const gone = await beat("http://127.0.0.1:9/", 5_000);
    expect(quick).toMatchObject({ status: 200, bytes: 2, error: null });
    expect(quick.ms).toBeLessThan(250);
    expect(late.ms).toBeGreaterThanOrEqual(290);
    expect(gone.status).toBeNull();
    expect(gone.error).toMatch(/ECONNREFUSED|fetch failed/);
  });

  it("gives up at its time limit and says so", async () => {
    const slow = await beat(`${url}/late`, 100);
    expect(slow.status).toBeNull();
    expect(slow.error).toMatch(/timeout|aborted/i);
    expect(slow.ms).toBeLessThan(290);
  });
});

describe("node scripts/heartbeat.mjs <url> <out.jsonl> <ms>", () => {
  it("is its own process and writes a line a beat, at about the interval asked, until it is stopped", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "heartbeat-")), "beats.jsonl");
    const script = fileURLToPath(new URL("./heartbeat.mjs", import.meta.url));
    const before = calls;
    const child = spawn(process.execPath, [script, `${url}/quick`, out, "100"], { stdio: "ignore" });
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await exited;
    const lines = readFileSync(out, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines.length).toBeLessThanOrEqual(13);
    // Every line is a request the server had; at most one more, the beat in flight when it was stopped.
    expect(calls - before - lines.length).toBeGreaterThanOrEqual(0);
    expect(calls - before - lines.length).toBeLessThanOrEqual(1);
    expect(lines[0]).toEqual(expect.objectContaining({ t: expect.any(String), ms: expect.any(Number), status: 200, error: null }));
  });
});
