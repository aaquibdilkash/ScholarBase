"use client";

import type { ReactNode } from "react";
import { FollowProvider } from "./FollowProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthModalProvider } from "./AuthModal";
import { URLMessageToast } from "./URLMessageToast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <URLMessageToast />
      <FollowProvider>
        <AuthModalProvider>{children}</AuthModalProvider>
      </FollowProvider>
    </ToastProvider>
  );
}
