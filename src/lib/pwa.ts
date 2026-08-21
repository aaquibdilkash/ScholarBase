"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    beforeInstallPrompt?: BeforeInstallPromptEvent;
  }
}

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

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

    setIsOffline(!navigator.onLine);

    window.addEventListener("online", () => setIsOffline(false));
    window.addEventListener("offline", () => setIsOffline(true));

    const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      window.beforeInstallPrompt = e;
      setIsInstalled(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("load", registerSW);
    };
  }, []);

  const install = () => {
    if (window.beforeInstallPrompt) {
      window.beforeInstallPrompt.prompt();
      window.beforeInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted install");
        }
        window.beforeInstallPrompt = undefined;
      });
    }
  };

  return { isInstalled, isOffline, install };
}