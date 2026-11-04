/**
 * Whether a page was opened from a share link, and which version of the link.
 *
 * A module of its own, with nothing imported, because the room is first built
 * at load (room.ts) and has to know before anything else whether to read the
 * older screenshot parameters or leave the whole query to the link's own
 * table (src/store/shareLink.ts). docs/decisions.md D23, round 94.
 */

/**
 * The version a link written today carries, as `v=3`.
 *
 * 2 since round 98a, when a link began to carry the layout's shape: a `v=1`
 * link was written before there was a shape to carry, and is read as the L it
 * was, with nothing said (Leo, round 98a). docs/decisions.md D23.
 *
 * 3 since the panel-ready round (Leo, 2026-10-28; 2026-11-02): a built-in
 * column is two rows, `T18IW905SP-SS` stainless and `T18IW905SP`
 * panel-ready, each written as its own number. A `v=1` or `v=2` link's
 * `T18IW905SP` was written when that was the stainless one, and is read so,
 * as the -SS row, with nothing said.
 */
export const LINK_VERSION = "3";

/** Every version a page can read: what it writes, and what it wrote before. */
export const LINK_VERSIONS: readonly string[] = ["1", "2", "3"];

/** The first version in which a column's bare number is its panel-ready row. */
export const PANEL_READY_SINCE = 3;

/** A share link says which version it is; the screenshot parameters never do. */
export const isShareLink = (query: URLSearchParams) => query.has("v");
