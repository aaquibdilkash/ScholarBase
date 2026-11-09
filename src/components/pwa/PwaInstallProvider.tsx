"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Single source of truth for "can this browser install ScholarBase as an app?".
 *
 * A few things make this more than a `matchMedia` check:
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
 *    listen for `appinstalled` and re-probe on visibility change, window
 *    focus, AND `pageshow` (the mobile bfcache return path that fires with
 *    neither of the first two) rather than trusting a one-shot probe at
 *    mount. A fresh `beforeinstallprompt` arriving while we claim "installed"
 *    is itself an uninstall signal: Chromium only re-issues it when the app
 *    becomes installable again, so the stale local flag yields to it. No
 *    browser exposes an `appuninstalled` event, so the related-app probe below
 *    is the closest thing to one.
 *
 * 4. **A positive is proof; an empty result is not.** `getInstalledRelatedApps()`
 *    returning `[]` is ambiguous: the same empty list also means the API cannot
 *    see PWAs on this platform (desktop Chrome before 140, Android home-screen
 *    shortcuts rather than WebAPKs), that the recorded install belongs to a
 *    different origin (localhost vs production, staging vs production), or that
 *    the installed app has not registered yet. Treating `[]` as authoritative
 *    is what made the tick appear and then vanish on the next focus. So an
 *    empty list clears the recorded install ONLY after this same origin has
 *    seen this same API report the app installed (`sb:pwa-gira-install`): a
 *    flip from positive to empty on one origin is a genuine deletion.
 *    Where the API is ABSENT (Firefox/Safari) it returns `null` and nothing is
 *    cleared; only `standalone` counts, so a deleted iOS app opened in a
 *    normal tab falls back to the share-sheet instructions, and a deleted app
 *    on a platform with no API waits for Chromium to re-issue
 *    `beforeinstallprompt` (the same uninstall signal as above).
 *
 * 5. **A probe that started before an install must never undo it.** The probe
 *    is asynchronous and several events (focus, visibilitychange, pageshow)
 *    can fire at once, so a `[]` captured before `appinstalled` may resolve
 *    after it. Every install bumps an epoch and every probe carries the epoch
 *    it started with; a negative that crosses an install (or a newer probe) is
 *    dropped instead of clearing the tick the user just earned.
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

/**
 * How often the visible page re-probes for an uninstall. The API is local and
 * cheap; the interval only exists so a deletion that produced no focus or
 * visibility transition is noticed without waiting for the next manual tab
 * switch. Hidden tabs skip it entirely.
 */
const INSTALL_POLL_MS = 30_000;

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
 * This is the precondition for ever treating an empty result as an uninstall.
 * It is what distinguishes a platform where the API genuinely tracks PWAs
 * (Android Chrome 84+, desktop Chromium 140+) from one where it always
 * returns `[]` (older desktop Chromium, home-screen shortcuts, a different
 * origin). Without it, a positive-then-empty flip cannot be told apart from
 * "this browser never reports anything", and the tick would be wiped on every
 * focus.
 */
const GIRA_INSTALLED_FLAG = "sb:pwa-gira-install";

function readGiraInstalledFlag(): boolean {
  try {
    return window.localStorage.getItem(GIRA_INSTALLED_FLAG) === "1";
  } catch {
    // Private mode / storage disabled: uninstall detection stays off rather
    // than guessing from an ambiguous empty result.
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
  // Monotonic counters that make the asynchronous probe safe:
  //   - `installEpoch` is bumped by every install/clear, so a negative probe
  //     that started BEFORE the install cannot clear it when it resolves;
  //   - `probeSeq` identifies the newest probe, so overlapping probes cannot
  //     apply out of order.
  const installEpochRef = useRef(0);
  const probeSeqRef = useRef(0);
  const markInstalled = useCallback((value: boolean) => {
    installEpochRef.current += 1;
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

  /**
   * Clears every local trace of a recorded install. Kept as the single
   * "forget" primitive so the probe and the early-install paths can never
   * disagree about what it means.
   */
  const resetInstalledState = useCallback(() => {
    installEpochRef.current += 1;
    setInstalledState(false);
    writeInstalledFlag(false);
    writeGiraInstalledFlag(false);
  }, []);

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
    // Seed from the local flag ONLY where the install API exists to correct
    // us. Where it is absent (Firefox/Safari) the flag is ignored entirely:
    // nothing can confirm or refute it, and trusting it is what stuck the UI
    // on "installed" after an iOS deletion. There only `standalone` counts.
    const hasInstallApi =
      typeof navigator !== "undefined" &&
      typeof (
        navigator as Navigator & {
          getInstalledRelatedApps?: () => Promise<
            { platform?: string; id?: string; url?: string }[]
          >;
        }
      ).getInstalledRelatedApps === "function";
    if (hasInstallApi && readInstalledFlag()) setInstalledState(true);
    if (isRunningStandalone()) markInstalled(true);

    // Pick up anything the inline `<head>` capture script already stashed. Both
    // events can fire before this effect runs — especially on a fast load or a
    // warm cache — and because they are issued only once, a listener that
    // attaches late misses them for the lifetime of the page. That race is what
    // made the button read "How to install" and then flip to working after a
    // navigation.
    const stashed = (window as Window & { __sbInstallPrompt?: BeforeInstallPromptEvent | null })
      .__sbInstallPrompt;
    if (stashed) setDeferredPrompt(stashed);
    if ((window as Window & { __sbAppInstalled?: boolean }).__sbAppInstalled) {
      markInstalled(true);
    }

    // The capture script re-broadcasts the prompt on a custom event, so this
    // still works when the real event arrives after we mount.
    const onCaptured = () => {
      const event = (
        window as Window & { __sbInstallPrompt?: BeforeInstallPromptEvent | null }
      ).__sbInstallPrompt;
      if (event) {
        // A fresh prompt means the app is installable again: Chromium only
        // re-issues it after a deletion. That is a true uninstall signal, so
        // the stale flag must yield rather than suppress it.
        resetInstalledState();
        setDeferredPrompt(event);
      }
    };
    window.addEventListener("sb:beforeinstallprompt", onCaptured);

    const onBeforeInstallPrompt = (event: Event) => {
      // Chromium's default would show its own mini-infobar — exactly the prompt
      // we are being asked to replace with a persistent button.
      event.preventDefault();
      // Same uninstall signal as above, for prompts that arrive after mount.
      resetInstalledState();
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

    /**
     * The only uninstall probe any browser offers. See doc note 4: a positive
     * is applied unconditionally, an empty result only clears a state that
     * this origin previously confirmed through the very same API.
     */
    const probeInstalled = async () => {
      const epoch = installEpochRef.current;
      const seq = ++probeSeqRef.current;
      const result = await isInstalledAsRelatedApp();

      // `true` is proof and is always safe to apply, even if another probe is
      // in flight: the browser can only name an install that exists.
      if (result === true) {
        markInstalled(true);
        writeGiraInstalledFlag(true);
        setDeferredPrompt(null);
        return;
      }

      // `null` = API absent (Firefox/Safari) or the call failed. Unknown is
      // not "uninstalled": keep the recorded state and let the manual
      // instructions cover this platform.
      if (result !== false) return;

      // Only the newest probe may act on an empty list, and only if no
      // install or clear happened while it was in flight. A `[]` captured
      // before `appinstalled` must not undo the install when it resolves.
      if (seq !== probeSeqRef.current) return;
      if (epoch !== installEpochRef.current) return;

      // An empty list only means "deleted" on a platform where this API has
      // already reported the app installed from this origin. Everywhere else
      // `[]` is the permanent answer — desktop Chromium before 140, Android
      // home-screen shortcuts, a different origin — and clearing on it is what
      // made the tick vanish right after install.
      if (!readGiraInstalledFlag()) return;

      // We ARE the installed app; it cannot have been deleted while this
      // window is still running in standalone mode.
      if (isRunningStandalone()) return;

      resetInstalledState();
    };

    // Re-check whenever the page can have changed underneath us. The user may
    // install the app from the browser's own menu while this page sits in a
    // background tab, and nothing else would tell us.
    //
    // No visibility guard here on purpose: `focus` can fire a beat before
    // `visibilityState` flips back to "visible" on mobile, and dropping that
    // signal would leave a deleted app showing as installed until the next
    // tab switch. The probe is local and cheap, so it is safe to run whenever
    // the page is actually in front of the user.
    const syncInstalled = () => {
      if (isRunningStandalone()) {
        markInstalled(true);
        setDeferredPrompt(null);
      }
      void probeInstalled();
    };

    document.addEventListener("visibilitychange", syncInstalled);
    // Window focus covers the desktop case visibilitychange misses: the tab
    // never hides while the user deletes the app from chrome://apps or the OS
    // in another window, so the only in-session signal is this window
    // regaining focus.
    window.addEventListener("focus", syncInstalled);
    // Mobile return path: deleting the PWA from the launcher then reopening
    // the browser tab often restores the page from bfcache, which fires
    // `pageshow` WITHOUT a preceding `visibilitychange`/`focus` pair the
    // handlers above would catch. Without this the stale install state
    // survives until the next manual tab switch.
    window.addEventListener("pageshow", syncInstalled);

    // A display-mode flip is the install itself: the standalone window opened
    // while this tab was already alive. Listening for the change (rather than
    // re-reading it on the next event) makes that instant.
    const standaloneQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;
    const onDisplayModeChange = () => {
      if (isRunningStandalone()) {
        markInstalled(true);
        setDeferredPrompt(null);
        return;
      }
      void probeInstalled();
    };
    standaloneQuery?.addEventListener?.("change", onDisplayModeChange);

    // Bounded responsiveness for the platforms that report reliably: while the
    // page is visible, re-probe on a slow cadence so a deletion that did not
    // come with a focus/visibility transition is still noticed. Hidden tabs
    // are skipped — they are throttled anyway, and the events above run the
    // probe the moment they become visible again.
    const pollInstalled = () => {
      if (document.visibilityState === "visible") void probeInstalled();
    };
    const poll = window.setInterval(pollInstalled, INSTALL_POLL_MS);

    // Run once on mount, after a short delay so it does not compete with
    // hydration for the main thread on a slow device.
    const initialCheck = window.setTimeout(syncInstalled, 400);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("sb:beforeinstallprompt", onCaptured);
      document.removeEventListener("visibilitychange", syncInstalled);
      window.removeEventListener("focus", syncInstalled);
      window.removeEventListener("pageshow", syncInstalled);
      standaloneQuery?.removeEventListener?.("change", onDisplayModeChange);
      window.clearInterval(poll);
      window.clearTimeout(initialCheck);
    };
  }, [markInstalled, resetInstalledState]);

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
