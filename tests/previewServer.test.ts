import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { startPreview } from "./globalSetup";

/**
 * The preview server the browser suite serves the build from stops when it is
 * stopped. Round 89 (Leo, round 88): it was started through a shell, and
 * stopping it ended the shell and left Vite listening on 4174 after every run
 * — four times in round 88, each ended by hand — serving a `dist/` the next
 * build rewrote under it (D17, round 87: a stopped preview server is checked
 * to have stopped).
 *
 * `startPreview` is what the suite's own setup calls, on its own port here
 * (not 4174, which the suite is using while this runs). Needs a build, which
 * `npm test` makes first.
 */
const PORT = 4191;

/** Whether nothing is listening on `port`, on either loopback address. */
async function portFree(port: number): Promise<boolean> {
  const tryListen = (host: string) =>
    new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen(port, host, () => server.close(() => resolve(true)));
    });
  return (await tryListen("127.0.0.1")) && (await tryListen("::1"));
}

describe("the browser suite's preview server (round 89)", () => {
  it("serves the build while it runs, and leaves its port free when stopped", async () => {
    const freeBefore = await portFree(PORT);
    const stop = await startPreview(PORT);
    const served = (await fetch(`http://localhost:${PORT}/`)).ok;
    const takenWhileRunning = !(await portFree(PORT));
    await stop();
    const freeAfter = await portFree(PORT);
    expect({ freeBefore, served, takenWhileRunning, freeAfter }).toEqual({
      freeBefore: true,
      served: true,
      takenWhileRunning: true,
      freeAfter: true,
    });
  });
});
