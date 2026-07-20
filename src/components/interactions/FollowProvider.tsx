"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

type FollowMap = Map<string, boolean>;

interface FollowContextValue {
  /** Returns the follow state for a given author. Falls back to `initial` if not set. */
  getFollowState: (authorId: string, initial: boolean) => boolean;
  /** Updates the follow state for a given author and propagates to all consumers. */
  setFollowState: (authorId: string, following: boolean) => void;
}

const FollowContext = createContext<FollowContextValue | null>(null);

export function FollowProvider({ children }: { children: ReactNode }) {
  const [followMap, setFollowMap] = useState<FollowMap>(new Map());

  const getFollowState = useCallback(
    (authorId: string, initial: boolean) => {
      return followMap.has(authorId) ? followMap.get(authorId)! : initial;
    },
    [followMap],
  );

  const setFollowState = useCallback((authorId: string, following: boolean) => {
    setFollowMap((prev) => {
      const next = new Map(prev);
      next.set(authorId, following);
      return next;
    });
  }, []);

  return (
    <FollowContext.Provider value={{ getFollowState, setFollowState }}>
      {children}
    </FollowContext.Provider>
  );
}

export function useFollowContext() {
  const ctx = useContext(FollowContext);
  if (!ctx) {
    throw new Error("useFollowContext must be used within a FollowProvider");
  }
  return ctx;
}
