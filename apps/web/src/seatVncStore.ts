import { create } from "zustand";

/** Slot in the preview panel the persistent Kasm iframe is positioned over. */
export const useSeatVncStore = create<{
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
}>((set) => ({
  slot: null,
  setSlot: (slot) => set({ slot }),
}));
