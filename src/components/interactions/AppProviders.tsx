"use client";

import type { ReactNode } from "react";
import { FollowProvider } from "./FollowProvider";
import { ToastProvider } from "@/components/ui/Toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FollowProvider>{children}</FollowProvider>
    </ToastProvider>
  );
}
