"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Client-side read model for the current account's frozen state. The root
 * layout already knows `isFrozen` from the DB; this provider makes it available
 * to interactive composers (post form, comment section, ...) so they can
 * proactively disable / hide editing controls instead of letting the user
 * attempt an action that the server will reject.
 */
const FrozenUserContext = createContext(false);

export function FrozenUserProvider({
  isFrozen,
  children,
}: {
  isFrozen: boolean;
  children: ReactNode;
}) {
  return (
    <FrozenUserContext.Provider value={isFrozen}>
      {children}
    </FrozenUserContext.Provider>
  );
}

export function useIsFrozen(): boolean {
  return useContext(FrozenUserContext);
}