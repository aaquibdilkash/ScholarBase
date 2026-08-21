"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode, useEffect } from "react";
import { FollowProvider } from "./FollowProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthModalProvider } from "./AuthModal";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("SW registered: ", registration);
      } catch (error) {
        console.log("SW registration failed: ", error);
      }
    };

    if (document.readyState === "loading") {
      window.addEventListener("load", registerSW);
    } else {
      registerSW();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FollowProvider>
          <AuthModalProvider>{children}</AuthModalProvider>
        </FollowProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
