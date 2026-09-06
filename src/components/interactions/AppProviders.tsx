"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode, useEffect } from "react";
import { FollowProvider } from "./FollowProvider";
import { PresenceProvider } from "./PresenceProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthModalProvider } from "./AuthModal";
import { FrozenUserProvider } from "./FrozenUserProvider";

export function AppProviders({
  children,
  isFrozen = false,
}: {
  children: ReactNode;
  isFrozen?: boolean;
}) {
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
          <AuthModalProvider>
            <FrozenUserProvider isFrozen={isFrozen}>
              <PresenceProvider>{children}</PresenceProvider>
            </FrozenUserProvider>
          </AuthModalProvider>
        </FollowProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
