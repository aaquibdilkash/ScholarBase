"use client";
import { useEffect, useState } from "react";
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    // Set the initial state
    setMatches(mediaQuery.matches);
    // Add event listener
    mediaQuery.addEventListener("change", handler);
    // Remove event listener on cleanup
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);
  return matches;
};
export default useMediaQuery;
