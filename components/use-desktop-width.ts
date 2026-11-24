"use client";

import { useSyncExternalStore } from "react";

const desktopQuery = "(min-width: 760px)";

export const isDesktopWidth = () => window.matchMedia(desktopQuery).matches;

const subscribe = (listener: () => void) => {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const serverSnapshot = () => false;

export function useDesktopWidth() {
  return useSyncExternalStore(subscribe, isDesktopWidth, serverSnapshot);
}
