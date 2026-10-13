/**
 * Whether a page was opened from a share link, and which version of the link.
 *
 * A module of its own, with nothing imported, because the room is first built
 * at load (room.ts) and has to know before anything else whether to read the
 * older screenshot parameters or leave the whole query to the link's own
 * table (src/store/shareLink.ts). docs/decisions.md D23, round 94.
 */

/** The version a link written today carries, as `v=1`. */
export const LINK_VERSION = "1";

/** A share link says which version it is; the screenshot parameters never do. */
export const isShareLink = (query: URLSearchParams) => query.has("v");
