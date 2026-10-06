"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Single source of truth for "can this browser install ScholarBase as an app?".
 *
 * Three things make this more than a `matchMedia` check:
 *
 * 1. **`beforeinstallprompt` must be captured.** The event fires once, early, and
 *    is not re-issued — if no listener is attached when it fires, the prompt is
 *    gone for the lifetime of the page and cannot be summoned again
 *    programmatically. That is precisely the "user dismissed the first prompt,
 *    now I want it" case this provider exists for. It is mounted in
 *    `AppProviders` rather than in the button, so the listener is live from first
 *    paint regardless of which page the user is on when the browser fires it.
 *
 * 2. **iOS Safari has no such event.** It only ever offers Add to Home Screen via
 *    the share sheet, so the honest thing there is to *not* promise a one-click
 *    install we cannot deliver — we show the manual steps instead.
 *
 * 3. **Install state can change without us.** The user can install from the
 *    browser's own menu at any time — or DELETE the installed app later — so we
 *    listen for `appinstalled` and re-probe on visibility change and window
 *    focus rather than trusting a one-shot probe at mount.
 *
 * 4. **A negative is NOT reliable — on its own.** `getInstalledRelatedApps()`
 *    returning an empty list does NOT mean "not installed": it only sees apps
 *    installed from the exact same origin (so a `localhost` dev tab never sees
 *    a production install), and Chromium produces false negatives in other
 *    cases too. An empty result may clear the install state ONLY when this
 *    origin previously confirmed that install through this very API
 *    (`sb:pwa-gira-install`) — same origin, same API, so a flip to empty then
 *    means the user actually deleted the app. That is the uninstall case that
 *    would otherwise require clearing site data before the install button
 *    returns.
 *
 * This is entirely *device* state, exactly like the push subscription in
 * `PushNotificationProvider` — no server round-trip, nothing to persist.
 */

/** Why we can or cannot offer an install right now. */
export type InstallStatus =
  /** Listening; the browser has not (yet) offered a prompt. */
  | "checking"
  /**
   * Installed already, or the browser provably cannot install (no service
   * worker support at all). These are the only two states where the button is
   * hidden forever, and both are decided from a fact, never from a timeout.
   */
  | "unavailable"
  /** We hold a `beforeinstallprompt` and can install in one click. */
  | "installable"
  /** iOS: installable only by hand, through the share sheet. */
  | "manual";

interface PwaInstallContextValue {
  status: InstallStatus;
  /** True while the browser's install sheet is open or resolving. */
  isWorking: boolean;
  isInstalled: boolean;
  /**
   * True when we hold a live `beforeinstallprompt`, i.e. a one-click install is
   * actually possible right now. Exposed separately from `status` because the UI
   * must NOT hide the install control when this is false: Chrome issues the event
   * only once per install cycle, so "no prompt in hand" is the normal, permanent
   * state for anyone who has reloaded or dismissed it, and hiding the button then
   * left them with no way to install at all.
   */
  canPrompt: boolean;
  /**
   * True when the browser provably cannot install any app (no service worker
   * support). Unlike "no prompt in hand", this is a permanent, factual answer,
   * so it is the only thing besides "already installed" that may retire the
   * install affordance with an explanation.
   */
  canNeverInstall: boolean;
  /** True on iOS, where we can only offer instructions. */
  isManualOnly: boolean;
  /** Opens the browser install prompt. No-op unless `canPrompt` is true. */
  install: () => Promise<void>;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error("usePwaInstall must be used within a PwaInstallProvider");
  }
  return ctx;
}

/**
 * `display-mode` is the standards-based check (Chrome, Edge, Firefox, Safari
 * 16.4+). `navigator.standalone` is iOS Safari's older proprietary equivalent.
 * Both are needed — checking only one misses an entire browser family.
 */
function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Whether this app is already installed, checked ASYNCHRONOUSLY.
 *
 * `isRunningStandalone` only answers the question when the page was launched
 * FROM the installed app. The case this covers is the other one the user cares
 * about: ScholarBase is installed, but they opened the site in an ordinary
 * browser tab. There `display-mode` is "browser", so we wrongly kept offering an
 * install for something already on their device.
 *
 * `getInstalledRelatedApps` is the only signal that works in that situation, and
 * it needs a `related_applications` entry in the manifest to match against.
 *
 * Support is uneven and worth being honest about:
 *   - Chromium (Chrome/Edge/Opera): supported.
 *   - Firefox and Safari: not implemented, so this returns null and we simply
 *     keep the current behaviour rather than guessing.
 * A null result therefore means "unknown", never "not installed" — treating it
 * as a negative would hide the install button from every Firefox user.
 */
async function isInstalledAsRelatedApp(): Promise<boolean | null> {
  // Not in the TypeScript DOM lib yet, so it is declared locally rather than
  // pulled into the global types. Guarded everywhere because support is partial.
  const getInstalled =
    typeof navigator === "undefined"
      ? undefined
      : (
          navigator as Navigator & {
            getInstalledRelatedApps?: () => Promise<
              { platform?: string; id?: string; url?: string }[]
            >;
          }
        ).getInstalledRelatedApps;

  if (typeof getInstalled !== "function") {
    return null;
  }
  try {
    const apps = await getInstalled.call(navigator);
    return Array.isArray(apps) && apps.length > 0;
  } catch {
    // A permissions/identity error here must not break the page.
    return null;
  }
}

/**
 * A local record that the user installed the app, set when the browser tells us
 * the install succeeded (`appinstalled`).
 *
 * Why this exists: `getInstalledRelatedApps` is Chromium-only, so on Firefox
 * and Safari the installed-in-a-normal-tab case is undetectable by any API. We
 * cannot infer it either — an installed app and a never-installed one both just
 * report "no prompt available".
 *
 * It is trusted on EVERY browser, including Chromium. The API is not a usable
 * negative: an empty result is returned both for "never installed" and for the
 * many real installs it simply cannot see (a different origin such as
 * `localhost` vs production, a different profile, a manifest-id mismatch). The
 * moment this hint was treated as merely a fallback, genuinely installed users
 * started seeing "Install app" again. Only a positive from the API is acted on.
 *
 * It is a device-local hint, never sent anywhere, and it is deliberately
 * allowed to be wrong: the user can clear it, and worst case we show the manual
 * instructions, which always work. It is strictly better than telling someone
 * who already installed the app that they need to install it.
 */
const INSTALLED_FLAG = "sb:pwa-installed";

function readInstalledFlag(): boolean {
  try {
    return window.localStorage.getItem(INSTALLED_FLAG) === "1";
  } catch {
    // Private mode / storage disabled.
    return false;
  }
}

function writeInstalledFlag(value: boolean) {
  try {
    if (value) window.localStorage.setItem(INSTALLED_FLAG, "1");
    else window.localStorage.removeItem(INSTALLED_FLAG);
  } catch {
    // Non-fatal: we simply fall back to the API-only behaviour.
  }
}

/**
 * Records that THIS origin's `getInstalledRelatedApps()` positively reported
 * the install.
 *
 * The counterpart to doc note 4: an empty result may only clear the recorded
 * install when the install was first confirmed through the same API on the same
 * origin. A flag written by `appinstalled` alone is never enough — that event
 * exists on installs this API cannot see (different profile, manifest-id drift),
 * where an empty list is meaningless.
 */
const GIRA_INSTALLED_FLAG = "sb:pwa-gira-install";

function readGiraInstalledFlag(): boolean {
  try {
    return window.localStorage.getItem(GIRA_INSTALLED_FLAG) === "1";
  } catch {
    // Private mode / storage disabled: uninstall detection simply stays off.
    return false;
  }
}

function writeGiraInstalledFlag(value: boolean) {
  try {
    if (value) window.localStorage.setItem(GIRA_INSTALLED_FLAG, "1");
    else window.localStorage.removeItem(GIRA_INSTALLED_FLAG);
  } catch {
    // Non-fatal: we degrade to the pre-existing conservative behaviour.
  }
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports a desktop Safari UA, so the touch-point check catches
  // what the UA string hides.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
  );
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  // Every path to "installed" goes through this, so the local flag can never
  // disagree with the state the UI renders.
  const [installed, setInstalledState] = useState(false);
  const markInstalled = useCallback((value: boolean) => {
    setInstalledState(value);
    writeInstalledFlag(value);
  }, []);
  const [isWorking, setIsWorking] = useState(false);
  // iOS has no programmatic install path, so it gets instructions rather than
  // a button. Detected once, from the platform, not from a timeout.
  const [isManualOnlyPlatform, setIsManualOnlyPlatform] = useState(false);
  // True when the browser provably can never install (no service worker
  // support). Deliberately NOT set by any timer.
  const [canNeverInstall, setCanNeverInstall] = useState(false);

  const onInstall = useCallback(async () => {
    if (!deferredPrompt || isWorking) return;
    setIsWorking(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      // Single-use per spec; drop our reference either way so a second click
      // can't try to reuse a consumed prompt.
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        markInstalled(true);
        toast("ScholarBase added to your apps.");
      }
    } catch {
      // A rejected/aborted prompt is normal (user dismissed the sheet).
      setDeferredPrompt(null);
    } finally {
      setIsWorking(false);
    }
  }, [deferredPrompt, isWorking, toast, markInstalled]);

  useEffect(() => {
    // Seed from the local flag first, so a returning user on ANY browser still
    // sees the installed state. It is not treated as a fallback: an empty
    // `getInstalledRelatedApps` result is not proof of a missing install (see
    // the note on INSTALLED_FLAG), so the hint is what the UI trusts.
    if (readInstalledFlag()) setInstalledState(true);
    if (isRunningStandalone()) setInstalledState(true);

    // Pick up anything the inline `<head>` capture script already stashed. The
    // event can fire before this effect runs — especially on a fast load or a
    // warm cache — and because it is issued only once, a listener that attaches
    // late misses it for the lifetime of the page. That race is what made the
    // button read "How to install" and then flip to working after a navigation.
    const stashed = (window as Window & { __sbInstallPrompt?: BeforeInstallPromptEvent | null })
      .__sbInstallPrompt;
    if (stashed) setDeferredPrompt(stashed);

    // The capture script re-broadcasts on a custom event, so this still works
    // when the real event arrives after we mount.
    const onCaptured = () => {
      const event = (
        window as Window & { __sbInstallPrompt?: BeforeInstallPromptEvent | null }
      ).__sbInstallPrompt;
      if (event) setDeferredPrompt(event);
    };
    window.addEventListener("sb:beforeinstallprompt", onCaptured);

    const onBeforeInstallPrompt = (event: Event) => {
      // Chromium's default would show its own mini-infobar — exactly the prompt
      // we are being asked to replace with a persistent button.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      markInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Only TWO things may ever hide this button permanently, and both are facts
    // rather than deadlines:
    //   - iOS, which has no programmatic install path at all; and
    //   - a browser with no service worker support, which can never install.
    //
    // Everything else keeps listening for the page's lifetime. Earlier versions
    // started a countdown and flipped to "unavailable" when it expired, which
    // produced a genuinely random UI: the same browser showed the icon on a
    // cold load and hid it on refresh, purely because an already-active worker
    // made that countdown start earlier. Chrome's own installability checks
    // (manifest, icons, engagement heuristics) finish on their own schedule and
    // are not observable from here, so any timer is a guess — and a wrong guess
    // wrongly tells the user that their browser cannot install.
    //
    // Note `navigator.serviceWorker` is checked by VALUE: some environments
    // expose the key while leaving it undefined, and trusting the key alone
    // would claim capability the browser does not have.
    setIsManualOnlyPlatform(detectIOS());
    setCanNeverInstall(!navigator.serviceWorker);

    // Re-check periodically and whenever the tab regains focus. The user may
    // install the app from the browser's own menu while this page sits in a
    // background tab, and nothing else would tell us.
    const syncInstalled = () => {
      if (document.visibilityState !== "visible") return;

      if (isRunningStandalone()) {
        markInstalled(true);
        setDeferredPrompt(null);
      }

      // Three outcomes from the related-app probe:
      //
      //  * `true` — a definitive install. Record it, plus that THIS origin saw
      //    it through this API, so a later disappearance can be recognised.
      //  * `false` — an EMPTY array is not "not installed" on its own: this API
      //    sees only apps installed from the exact same origin (a `localhost`
      //    tab cannot see a production install) and Chromium returns false
      //    negatives in other cases too. It may clear the install state ONLY
      //    when this origin previously confirmed the install through this very
      //    API (`sb:pwa-gira-install`): same origin, same API, so a flip to
      //    empty then means the user actually deleted the app — the uninstall
      //    case that used to require clearing site data before the install
      //    button came back.
      //  * `null` — API absent (Firefox/Safari): leave the local hint alone.
      void isInstalledAsRelatedApp().then((result) => {
        if (result === true) {
          markInstalled(true);
          setDeferredPrompt(null);
          writeGiraInstalledFlag(true);
        } else if (result === false && readGiraInstalledFlag() && !isRunningStandalone()) {
          // Uninstall confirmed by the same-origin API flip. Clear both flags
          // but KEEP any held `beforeinstallprompt`: after a deletion Chromium
          // may re-issue one, and holding it makes the button one-click again.
          setInstalledState(false);
          writeInstalledFlag(false);
          writeGiraInstalledFlag(false);
        }
      });
    };
    document.addEventListener("visibilitychange", syncInstalled);
    // Window focus covers the desktop case visibilitychange misses: the tab
    // never hides while the user deletes the app from chrome://apps or the OS
    // in another window, so the only in-session signal is this window
    // regaining focus.
    window.addEventListener("focus", syncInstalled);

    // Run once on mount, after a short delay so it does not compete with
    // hydration for the main thread on a slow device.
    const initialCheck = window.setTimeout(syncInstalled, 400);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("sb:beforeinstallprompt", onCaptured);
      document.removeEventListener("visibilitychange", syncInstalled);
      window.removeEventListener("focus", syncInstalled);
      window.clearTimeout(initialCheck);
    };
  }, [markInstalled]);

  const value = useMemo<PwaInstallContextValue>(() => {
    const status: InstallStatus = installed
      ? "unavailable"
      : deferredPrompt
        ? "installable"
        : isManualOnlyPlatform
          ? "manual"
          : canNeverInstall
            ? "unavailable"
            : // Still listening. Deliberately never resolves to "unavailable"
              // on a timer — see the effect above.
              "checking";

    return {
      status,
      isWorking,
      isInstalled: installed,
      canPrompt: deferredPrompt !== null,
      canNeverInstall,
      isManualOnly: status === "manual",
      install: onInstall,
    };
  }, [installed, deferredPrompt, isManualOnlyPlatform, canNeverInstall, isWorking, onInstall]);
  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  );
}

/**
 * The non-standard event Chromium fires once the PWA is installable. Not in
 * lib.dom, so it is declared locally rather than added to the global types.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
