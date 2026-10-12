"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FollowProvider } from "./FollowProvider";
import { PresenceProvider } from "./PresenceProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthModalProvider } from "./AuthModal";
import { FrozenUserProvider } from "./FrozenUserProvider";
import { PushActivitySignal } from "@/components/push/PushActivitySignal";
import { PushNotificationProvider } from "@/components/push/PushNotificationProvider";

// Exact message thrown by Next.js's Server Action client when the response is
// neither an RSC payload nor a redirect.
const UNEXPECTED_ACTION_RESPONSE =
  "An unexpected response was received from the server.";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";

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

  const router = useRouter();

  // Recover from Next.js Server Action responses that are not RSC payloads
  // (e.g. a stale action after a redeploy, or an action that raced a client
  // navigation). Instead of an unhandled crash, re-sync the router; if it
  // happens again shortly after, fall back to one hard reload.
  useEffect(() => {
    const RELOAD_FLAG = "sb:unexpected-action-response";
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message =
        event.reason instanceof Error ? event.reason.message : String(event.reason ?? "");
      if (message !== UNEXPECTED_ACTION_RESPONSE) return;

      event.preventDefault();
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
      const now = Date.now();
      if (now - last < 10_000) {
        sessionStorage.removeItem(RELOAD_FLAG);
        window.location.reload();
        return;
      }
      sessionStorage.setItem(RELOAD_FLAG, String(now));
      router.refresh();
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () =>
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, [router]);

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
              <PresenceProvider>
                <PwaInstallProvider>
                  <PushNotificationProvider>
                    <PushActivitySignal />
                    {children}
                  </PushNotificationProvider>
                </PwaInstallProvider>
              </PresenceProvider>
            </FrozenUserProvider>
          </AuthModalProvider>
        </FollowProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
