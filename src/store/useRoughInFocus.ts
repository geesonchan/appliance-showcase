import { create } from "zustand";

/**
 * The rough-in point last picked — in the panel's list or by a click in the
 * room — by its `roughInKey`. The scene highlights it. Its own small store
 * rather than a field on the app store, because nothing else reads it. Round 42.
 */
export const useRoughInFocus = create<{
  active: string | null;
  setActive: (key: string | null) => void;
}>((set) => ({
  active: null,
  setActive: (active) => set({ active }),
}));
