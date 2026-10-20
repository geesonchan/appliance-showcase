/**
 * Whether a page was opened from a share link, and which version of the link.
 *
 * A module of its own, with nothing imported, because the room is first built
 * at load (room.ts) and has to know before anything else whether to read the
 * older screenshot parameters or leave the whole query to the link's own
 * table (src/store/shareLink.ts). docs/decisions.md D23, round 94.
 */

/**
 * The version a link written today carries, as `v=2`.
 *
 * 2 since round 98a, when a link began to carry the layout's shape: a `v=1`
 * link was written before there was a shape to carry, and is read as the L it
 * was, with nothing said (Leo, round 98a). docs/decisions.md D23.
 */
export const LINK_VERSION = "2";

/** Every version a page can read: what it writes, and what it wrote before. */
export const LINK_VERSIONS: readonly string[] = ["1", "2"];

/** A share link says which version it is; the screenshot parameters never do. */
export const isShareLink = (query: URLSearchParams) => query.has("v");
