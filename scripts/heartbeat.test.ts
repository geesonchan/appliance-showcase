import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { argsOf, beat, main, run } from "./heartbeat.mjs";

/**
 * The heartbeat beside the server-reset loop (docs/plans/server-reset-plan.md,
 * section 2, 甲): a process of its own that asks the test server for one small
 * file every 250 ms and writes how long each took. When the server stalls the
 * heartbeat slows with it; when the browser stalls and the server does not,
 * the heartbeat does not. Held here against a server of the test's own, one
 * that answers at once, once late on purpose, and then is gone.
 *
 * 12d-2 (Leo, 2026-11-18, after a clean worktree's unit run went red on "gives up at its
 * time limit", 349 ms against 290, the machine busy; docs/plans/item12d2-plan.md): the two
 * beat() cases time by a clock the test drives and give up on a signal the test sends, so
 * a busy machine cannot make them late; one case on the real clock and the real timeout
 * stays, asking only that it answers, or gives up and says so, with no millisecond bound.
 *
 * And the process case (Leo, 2026-11-19: 「heartbeat 文件里那条 "process" 测试：一起改，用同样的办法（测试自己
 * 掌管时间，不加长时限）」; on a busy machine it was red 14 of 20 after the change above, a fixed
 * 1.2 s holding 5 to 13 lines): the heartbeat's loop is held on the test's clock — when each beat
 * is asked for, how long it waits — and the process is stopped once the server has had five of
 * its beats, not after a fixed time, asked only that it writes a line a beat as each comes.
 */

let server: Server;
let url: string;
let calls = 0;
/** The test's own clock: the server moves it on by as long as each answer is to take. */
const clock = { t: 0, now: () => clock.t };
/** /took: how long each answer takes on the test's clock, in turn, and when on it each was asked for. */
const took: number[] = [];
const tookAskedAt: number[] = [];
/** /process: the heartbeat process's beats, and what to do when one comes. */
let processCalls = 0;
let onProcess = () => {};
beforeAll(async () => {
  server = createServer((req, res) => {
    calls += 1;
    if (req.url === "/took") {
      tookAskedAt.push(clock.t);
      clock.t += took.shift() ?? 0;
      res.end("ok");
      return;
    }
    if (req.url === "/process") {
      processCalls += 1;
      onProcess();
    }
    const late = req.url === "/late" ? 300 : 0;
    clock.t += late;
    // /slow is as late on the real clock and leaves the test's alone: the give-up cases set it.
    setTimeout(() => res.end("ok"), req.url === "/slow" ? 300 : late);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("one beat", () => {
  it("gives the time, the status and the bytes; a late answer is as late as it was; no server is an error, not a throw", async () => {
    // On the test's clock: the quick answer takes none of it, the late one its 300 ms.
    clock.t = 0;
    const quick = await beat(`${url}/quick`, 5_000, { now: clock.now });
    const late = await beat(`${url}/late`, 5_000, { now: clock.now });
    const gone = await beat("http://127.0.0.1:9/", 5_000, { now: clock.now });
    expect(quick).toEqual({ ms: 0, status: 200, bytes: 2, error: null });
    expect(late).toEqual({ ms: 300, status: 200, bytes: 2, error: null });
    expect(gone.status).toBeNull();
    expect(gone.error).toMatch(/ECONNREFUSED|fetch failed/);
  });

  it("gives up at its time limit and says so", async () => {
    // The test is the time limit: at 100 ms on its clock it gives up, as AbortSignal.timeout does.
    // The real timeout is far off (10 s), so only the test's signal can stop it in time.
    clock.t = 0;
    const limit = new AbortController();
    const slow = beat(`${url}/slow`, 10_000, { now: clock.now, signal: limit.signal });
    await new Promise((resolve) => setTimeout(resolve, 50));
    clock.t = 100;
    limit.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    expect(await slow).toEqual({ ms: 100, status: null, bytes: null, error: expect.stringMatching(/^timeout/) });
  });

  it("on the real clock and the real timeout: answers, and gives up and says so (no millisecond bound)", async () => {
    const quick = await beat(`${url}/quick`, 5_000);
    // /slow, not /late: the request given up on can reach the server after the next case has
    // begun, and /late would move that case's clock on by 300 (red 3 of 20 on a busy machine,
    // 2026-11-19, the loop's case asked at 300, 330, 480 and 580).
    const slow = await beat(`${url}/slow`, 100);
    expect({ quick: { status: quick.status, error: quick.error }, slow: { status: slow.status, error: slow.error } }).toEqual({
      quick: { status: 200, error: null },
      slow: { status: null, error: expect.stringMatching(/timeout|aborted/i) },
    });
    expect(Number.isFinite(quick.ms) && Number.isFinite(slow.ms)).toBe(true);
  });
});

describe("node scripts/heartbeat.mjs <url> <out.jsonl> <ms>", () => {
  it("a beat every `ms` from when the last began, at once after a slow one: on the test's clock", async () => {
    // Four beats taking 30, 150, 0 and 100 ms on the test's clock, every 100 ms: the wait moves
    // the clock on by what it waits, so the beats are asked for at 0, 100, 250 and 350.
    clock.t = 0;
    took.splice(0, took.length, 30, 150, 0, 100);
    tookAskedAt.splice(0);
    const waited: number[] = [];
    const lines: string[] = [];
    await run({
      url: `${url}/took`,
      every: 100,
      write: (line: string) => lines.push(line),
      going: () => lines.length < 4,
      now: clock.now,
      wait: async (ms: number) => {
        waited.push(ms);
        clock.t += ms;
      },
      stamp: () => `at ${clock.t}`,
    });
    expect(tookAskedAt).toEqual([0, 100, 250, 350]);
    expect(waited).toEqual([70, 100]);
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { t: "at 0", ms: 30, status: 200, bytes: 2, error: null },
      { t: "at 100", ms: 150, status: 200, bytes: 2, error: null },
      { t: "at 250", ms: 0, status: 200, bytes: 2, error: null },
      { t: "at 350", ms: 100, status: 200, bytes: 2, error: null },
    ]);
    expect(lines.every((line) => line.endsWith("\n"))).toBe(true);
  });

  // What the process hands its loop, with no clock at all (Leo, 2026-11-19: 「"程序把间隔时间传错了"这个缺口：
  // 试一下不靠真实时间的守法，比如直接查从命令行读到的间隔和交给循环的是不是同一个值」).
  it("hands its loop the url and the interval its command line gave, and writes each line to its file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "heartbeat-"));
    const handed: Array<{ url: string; every: number; going: boolean }> = [];
    const loop = async (options: { url: string; every: number; write: (line: string) => void; going: () => boolean }) => {
      handed.push({ url: options.url, every: options.every, going: options.going() });
      options.write("one line\n");
    };
    await main([`${url}/x`, join(dir, "a.jsonl"), "100"], { loop, stopOn: [] });
    await main([`${url}/x`, join(dir, "b.jsonl")], { loop, stopOn: [] });
    expect(handed).toEqual([
      { url: `${url}/x`, every: 100, going: true },
      { url: `${url}/x`, every: 250, going: true },
    ]);
    expect(readFileSync(join(dir, "a.jsonl"), "utf8")).toBe("one line\n");
  });

  it("reads its interval from its command line, 250 ms when none is given", () => {
    expect(argsOf(["http://x/", "beats.jsonl", "100"])).toEqual({ url: "http://x/", out: "beats.jsonl", every: 100 });
    expect(argsOf(["http://x/", "beats.jsonl"])).toEqual({ url: "http://x/", out: "beats.jsonl", every: 250 });
    expect(() => argsOf(["http://x/"])).toThrow(/heartbeat\.mjs <url> <out\.jsonl>/);
  });

  // No fixed wait: it is stopped once the server has had five of its beats, however long the
  // machine takes to start it. The 60 s is only how long to wait before calling it lost.
  it("is its own process and writes a line a beat, as each comes, until it is stopped", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "heartbeat-")), "beats.jsonl");
    const script = fileURLToPath(new URL("./heartbeat.mjs", import.meta.url));
    processCalls = 0;
    const five = new Promise<void>((resolve) => {
      onProcess = () => {
        if (processCalls >= 5) resolve();
      };
    });
    const child = spawn(process.execPath, [script, `${url}/process`, out, "100"], { stdio: "ignore" });
    await five;
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await exited;
    onProcess = () => {};
    const lines = readFileSync(out, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    // The fifth beat was asked for, so the four before it were each answered and written.
    expect(lines.length).toBeGreaterThanOrEqual(4);
    // Every line is a request the server had; at most one more, the beat in flight when it was stopped.
    expect(processCalls - lines.length).toBeGreaterThanOrEqual(0);
    expect(processCalls - lines.length).toBeLessThanOrEqual(1);
    for (const line of lines) expect(line).toEqual({ t: expect.any(String), ms: expect.any(Number), status: 200, bytes: 2, error: null });
  }, 60_000);
});
