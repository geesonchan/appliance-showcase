/**
 * Diagnostics flag, read once from `?debug=1`. Toggling it means a reload,
 * which is deliberate: nothing in the app should behave differently based on a
 * value that can change under it mid-session.
 */
export const DEBUG =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("debug") === "1";
