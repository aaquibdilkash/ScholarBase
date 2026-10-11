"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Download, Loader2, Share } from "lucide-react";
import { usePwaInstall } from "@/components/pwa/PwaInstallProvider";

export type InstallAppButtonVariant =
  | "default"
  | "navbar"
  | "menu"
  | "settings";

/**
 * Entry point for installing ScholarBase as an app.
 *
 * Always visible unless the app is already installed. An earlier version waited
 * for a `beforeinstallprompt` before rendering anything, which was backwards:
 * Chrome issues that event only ONCE per install cycle, so the control vanished
 * on every reload after the first and left the user with no way to install.
 *
 * The button therefore adapts to what the browser actually offers, and a click
 * is NEVER a dead click:
 *   - a live prompt is held  -> one click installs;
 *   - no prompt             -> a popover explains the manual route.
 * That second case used to be broken in the navbar, which rendered a button
 * wired to toggle help it never rendered, so the icon looked inert.
 *
 * State is shared app-wide via `PwaInstallProvider`, so the navbar icon and the
 * settings row can never disagree about whether the app is installed.
 */
export function InstallAppButton({
  variant = "default",
}: {
  variant?: InstallAppButtonVariant;
}) {
  const { status, isWorking, install, isManualOnly, canPrompt, isInstalled, resetInstall } =
    usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Dismiss the popover on an outside click or Escape, so it behaves like the
  // rest of the navbar's transient UI rather than sticking around.
  useEffect(() => {
    if (!showHelp) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setShowHelp(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowHelp(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showHelp]);

  // Only a browser that can never install retires the control outright. When the
  // app is merely INSTALLED we keep rendering, because showing "Installed" is
  // better than an empty hole where the button used to be.
  //
  // This sits AFTER all hooks deliberately: an early return above them would
  // change the hook count between renders and crash React with "Rendered fewer
  // hooks than expected".
  if (status === "unavailable" && !isInstalled) return null;

  const canInstallInOneClick = canPrompt && !isManualOnly;
  const onClick = canInstallInOneClick ? install : () => setShowHelp((v) => !v);

  const label = isManualOnly
    ? "Add ScholarBase to your home screen"
    : "Install ScholarBase app";
  // One source of truth for the installed wording, shared by the tooltip and the
  // accessible name so they can never disagree.
  const installedLabel = "ScholarBase is installed on this device";
  // The in-flight wording, kept next to the installed one for the same reason.
  const installingLabel = "Installing ScholarBase…";
  const actionText = isWorking
    ? "Installing..."
    : isManualOnly
      ? "Add to Home Screen"
      : canInstallInOneClick
        ? "Install"
        : "How to install";

  const renderIcon = (iconClass: string) =>
    isWorking ? (
      <Loader2 className={`${iconClass} animate-spin`} />
    ) : isManualOnly ? (
      <Share className={iconClass} />
    ) : (
      <Download className={iconClass} />
    );

  /**
   * The only uninstall signal on browsers with no install API (iOS Safari,
   * Firefox) is the user telling us. Also rescues installs recorded before
   * the manifest fix, where the confirmation flag was never set and no probe
   * can clear the stale `sb:pwa-installed`. Rendered next to every installed
   * confirmation so a deleted app never requires clearing site data.
   */
  const renderResetAction = (className: string) => (
    <button
      type="button"
      onClick={resetInstall}
      title="Show the install option again"
      aria-label="App deleted? Show the install option again"
      className={className}
    >
      Deleted it? Re-offer install
    </button>
  );

  /** The manual route. Shown in a popover from the navbar, inline in settings. */
  const helpBody = isManualOnly ? (
    <>
      On iPhone and iPad, tap the <span aria-label="Share">Share</span> icon in
      your browser, then choose <strong>Add to Home Screen</strong>. ScholarBase
      will open like a normal app.
    </>
  ) : (
    <>
      Click the install icon at the right of your browser&apos;s address bar (a
      screen with a down arrow). If you cannot see it, open the browser menu and
      choose <strong>Install app</strong> or <strong>Add to Home screen</strong>
      .
    </>
  );

  // Icon-only, sized against the navbar's own density, sitting immediately left
  // of the message-alert bell. When there is nothing to install with, the click
  // opens this popover rather than doing nothing.
  if (variant === "navbar") {
    // Installed icons stay clickable (but never reinstall): the click only
    // opens the tiny recovery popover below, which is the single place the
    // icon-only slot can offer the "deleted it?" reset.
    const navbarOnClick =
      isInstalled && !isWorking ? () => setShowHelp((v) => !v) : onClick;
    return (
      <div ref={popoverRef} className="relative">
        <button
          type="button"
          onClick={navbarOnClick}
          disabled={isWorking}
          title={isWorking ? installingLabel : isInstalled ? installedLabel : label}
          aria-label={isWorking ? installingLabel : isInstalled ? installedLabel : label}
          aria-expanded={isWorking ? undefined : showHelp}
          className="sb-menu-trigger h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10"
        >
          {renderIcon("h-4 w-4 sm:h-5 sm:w-5")}

          {/* Installed: a tick in the corner, mirroring the notification count
              badge. A standalone check icon in place of the download glyph was
              not self-explanatory — it read as a verified/unknown state rather
              than "this app is on your device". Overlaying keeps the control
              recognisable as the install button it still is. */}
          {isInstalled && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white sm:h-4 sm:w-4 dark:ring-slate-950"
              aria-hidden="true"
            >
              <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={3.5} />
            </span>
          )}
        </button>

        {showHelp && !canInstallInOneClick && !isInstalled && (
          <div
            role="dialog"
            aria-label="How to install ScholarBase"
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs leading-relaxed text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Install ScholarBase
            </p>
            {helpBody}
          </div>
        )}

        {/* Icon-only navbar slot has no room for a second control, so the
            reset lives in the popover: click the (disabled-as-installed) icon
            and the row offers the uninstall recovery without clearing data. */}
        {showHelp && isInstalled && !isWorking && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              ScholarBase installed
            </p>
            {renderResetAction(
              "mt-1 text-[11px] font-medium text-slate-400 underline underline-offset-2 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
            )}
          </div>
        )}
      </div>
    );
  }

  // A row in the mobile overflow menu, styled like its neighbours. It has room
  // for words, so it states the action rather than relying on an icon.
  if (variant === "menu") {
    // An install in flight must win over the installed row: otherwise the menu
    // flips straight to "ScholarBase installed" and the user never sees that
    // anything is happening.
    if (isInstalled && !isWorking) {
      return (
        <span
          role="menuitem"
          aria-disabled="true"
          className="sb-menu-item flex w-full flex-col items-start gap-1 px-3 py-1.5 text-[13px] sm:px-4 sm:py-2 sm:text-sm"
        >
          <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            ScholarBase installed
          </span>
          {renderResetAction(
            "ml-6 text-[11px] font-medium text-slate-400 underline underline-offset-2 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
          )}
        </span>
      );
    }

    return (
      <div ref={popoverRef} className="relative">
        <button
          type="button"
          role="menuitem"
          onClick={onClick}
          disabled={isWorking}
          aria-expanded={isWorking || canInstallInOneClick ? undefined : showHelp}
          className="sb-menu-item flex w-full items-center gap-2 px-3 py-1.5 text-[13px] disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
        >
          {renderIcon("h-4 w-4")}
          <span>
            {isWorking
              ? "Installing..."
              : isManualOnly
                ? "Add to Home Screen"
                : "Install ScholarBase"}
          </span>
        </button>

        {showHelp && !canInstallInOneClick && (
          <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            {helpBody}
          </p>
        )}
      </div>
    );
  }

  if (variant === "settings") {
    // Installed settings row is a NON-button container: nesting the reset
    // <button> inside a disabled <button> would make it unclickable (and is
    // invalid HTML). The row keeps the same card styling, minus the
    // hover/click affordance.
    if (isInstalled && !isWorking) {
      return (
        <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-900">
          <span className="text-slate-500 dark:text-slate-400">
            {renderIcon("h-5 w-5")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              Install app
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              ScholarBase is installed on this device.
            </span>
            {renderResetAction(
              "mt-1 block text-[11px] font-medium text-slate-400 underline underline-offset-2 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Installed
          </span>
        </div>
      );
    }

    return (
      <div>
        <button
          type="button"
          onClick={onClick}
          disabled={isWorking}
          aria-expanded={canInstallInOneClick ? undefined : showHelp}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <span className="text-slate-500 dark:text-slate-400">
            {renderIcon("h-5 w-5")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              Install app
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {isWorking
                ? "Adding ScholarBase to this device…"
                : isManualOnly
                  ? "Add ScholarBase to your home screen for faster access."
                  : "Add ScholarBase to your device for faster, offline-friendly access."}
            </span>
          </span>
          {/* Order matters: an install in flight is shown as "Installing…" even
              if the installed flag has already flipped, so the transition is
              never a silent jump straight to "Installed". */}
          {isWorking ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Installing...
            </span>
          ) : isInstalled ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Installed
            </span>
          ) : (
            <span className="shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">
              {actionText}
            </span>
          )}
        </button>

        {/* Inline rather than behind a click here: this is a full-width settings
            row, so there is room to simply say what to do, and a row whose
            "How to install" text does nothing on click would read as broken. */}
        {showHelp && !canInstallInOneClick && (
          <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            {helpBody}
          </p>
        )}
      </div>
    );
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={onClick}
        disabled={isWorking}
        aria-expanded={canInstallInOneClick ? undefined : showHelp}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {renderIcon("h-4 w-4")}
        {actionText}
      </button>

      {showHelp && !canInstallInOneClick && (
        <span
          role="dialog"
          aria-label="How to install ScholarBase"
          className="absolute right-0 top-full z-50 mt-2 block w-72 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs leading-relaxed text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {helpBody}
        </span>
      )}
    </span>
  );
}

/**
 * Explains the state of the install, for the App tab.
 *
 * Only ever shown for the two terminal cases. The "waiting for the browser" copy
 * was removed deliberately: the provider keeps listening for the whole lifetime
 * of the page, but Chrome will not re-issue `beforeinstallprompt` after a
 * dismissal, so that message could sit there forever promising something that
 * was never coming. Silence plus a working button is more honest than a spinner
 * that lies.
 */
export function InstallStatusNote() {
  const { isInstalled, canNeverInstall } = usePwaInstall();

  // The installed case is already stated by the install row itself, which now
  // turns into a green confirmation, so repeating it here would be noise.
  if (isInstalled) return null;

  if (canNeverInstall) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        This browser cannot install apps. Try Chrome or Edge on desktop, or open
        ScholarBase in Safari on iPhone and iPad and use{" "}
        <strong>Share → Add to Home Screen</strong>.
      </p>
    );
  }

  return null;
}
