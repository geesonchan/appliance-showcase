import { afterAll, describe, expect, it } from "vitest";
import { LAYOUT_PARAMS, RUNS, feasibleRange } from "../data/room";
import { resetRoom } from "../data/testRoom";
import { useAppStore } from "./useAppStore";

/**
 * Round 99a, Leo: "墙长数字和灰色区还没算好、仍显示旧值的那段时间里，如果用户马上拖墙长滑杆…会不会
 * 拖到房间排不下的长度？房间那边是否照样拒绝并提示？"
 *
 * The Layout tab works out a wall slider's greyed band in the page's idle
 * time (`useIdleValue`), so for a frame or two after a package switch the
 * band is still the room's before it: after A → B it lets the slider down to
 * A's 147" where B needs 187". The slider snaps only to the band it shows, so
 * a length the room cannot take can be asked for. What stops it is the room,
 * not the band: a wall slider's length is built or refused on its own terms
 * (round 34) — refused, the room standing stays, and the reasons, with the
 * wall's figures, are said under the slider.
 */

afterAll(() => {
  useAppStore.getState().setPackageId("package-a");
  resetRoom();
});

describe("a wall length asked for while the band still shows the room before (round 99a)", () => {
  it("is refused with the wall's figures, and the room standing stays as it was", () => {
    const store = useAppStore.getState;
    store().setLayoutShape("L");
    store().setPackageId("package-a");
    const aBand = feasibleRange(LAYOUT_PARAMS, "backWallIn");
    store().setPackageId("package-b");
    const bBand = feasibleRange(LAYOUT_PARAMS, "backWallIn");
    const standing = JSON.stringify(RUNS);
    const version = store().layoutVersion;

    // Inside A's band, which the slider still shows; under B's.
    const asked = 150;
    store().setLayout({ backWallIn: asked });
    const short = store().layoutIssues.find((issue) => issue.key === "refusal.wallShort");

    expect({
      aMin: aBand?.minIn,
      bMin: bBand?.minIn,
      sliderShows: store().layoutParams.backWallIn,
      refused: short?.vars.paramKey,
      saysTheWall: (short?.occupancy?.length ?? 0) > 0,
      roomRebuilt: store().layoutVersion !== version,
      roomUnchanged: JSON.stringify(RUNS) === standing,
    }).toEqual({
      aMin: 147,
      bMin: 187,
      sliderShows: 150,
      refused: "param.backWallIn",
      saysTheWall: true,
      roomRebuilt: false,
      roomUnchanged: true,
    });
  });
});
