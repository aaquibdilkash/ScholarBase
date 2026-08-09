"use client";

import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from "react";

interface MessagesLayoutContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export const MessagesLayoutContext =
  createContext<MessagesLayoutContextType | null>(null);

export function useMessagesLayout() {
  const context = useContext(MessagesLayoutContext);
  if (!context) {
    throw new Error(
      "useMessagesLayout must be used within a MessagesLayoutProvider",
    );
  }
  return context;
}
