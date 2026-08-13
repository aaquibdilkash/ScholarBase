"use client";

import type { ReactNode } from "react";
import { FollowProvider } from "./FollowProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthModalProvider } from "./AuthModal";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FollowProvider>
        <AuthModalProvider>{children}</AuthModalProvider>
      </FollowProvider>
    </ToastProvider>
  );
}
