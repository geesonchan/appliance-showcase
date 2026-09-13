/**
 * Which of the two desktop rails are open, and remembering it for the tab.
 *
 * The page opens with Configuration open and the appliance list closed (D12,
 * round 31). Once somebody changes either, it stays that way for as long as
 * the tab is open: sessionStorage rather than localStorage, because the next
 * customer, in a fresh tab, should get the default rather than the last
 * salesperson's arrangement. A phone never reads these — its sheet opens closed.
 */
export type Rails = { leftOpen: boolean; rightOpen: boolean };

export const RAIL_DEFAULTS: Rails = { leftOpen: false, rightOpen: true };

const KEY = "appliance-showcase:rails";

type Store = Pick<Storage, "getItem" | "setItem">;

/** sessionStorage where it exists and is allowed; nothing where it is not. */
function session(): Store | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function readRails(storage: Store | null = session()): Rails {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...RAIL_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Rails>;
    return {
      leftOpen: typeof parsed.leftOpen === "boolean" ? parsed.leftOpen : RAIL_DEFAULTS.leftOpen,
      rightOpen: typeof parsed.rightOpen === "boolean" ? parsed.rightOpen : RAIL_DEFAULTS.rightOpen,
    };
  } catch {
    return { ...RAIL_DEFAULTS };
  }
}

export function writeRails(rails: Rails, storage: Store | null = session()) {
  try {
    storage?.setItem(KEY, JSON.stringify(rails));
  } catch {
    // A browser that refuses storage still gets the rails; it just forgets them.
  }
}
