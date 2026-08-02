"use client";
import { useSyncExternalStore } from "react";
const useMediaQuery = (query: string): boolean => {
  const subscribe = (onStoreChange: () => void) => {
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener("change", onStoreChange);
    return () => mediaQuery.removeEventListener("change", onStoreChange);
  };

  const getSnapshot = () => window.matchMedia(query).matches;

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
export default useMediaQuery;
