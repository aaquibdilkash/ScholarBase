"use client";

import { BellOff, BellRing, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/components/push/PushNotificationProvider";

/**
 * Opt-in toggle for message push notifications.
 *
 * All state lives in `PushNotificationProvider`, so every instance on screen
 * agrees — flipping the switch in the mobile overflow menu updates the navbar
 * icon (and the `/notifications` and messages-sidebar buttons) in the same
 * render. The subscription itself is browser-scoped, so this reflects the
 * current *device*: signing in elsewhere requires opting in there too.
 */

/**
 * `default` — labelled pill, for settings surfaces such as `/notifications`.
 * `compact` — icon-only at a fixed 2rem, so it lines up with the 2rem chevron
 *   it sits beside in the messages sidebar header.
 * `navbar`  — icon-only, sized against the navbar's own density: dense on
 *   phones, roomier through the tablet range, full size from `md` up.
 * `menu`    — a dropdown row styled like the other `sb-menu-item` entries, for
 *   the mobile overflow menu where the navbar's icons are collapsed away.
 */
export type EnablePushButtonVariant = "default" | "compact" | "navbar" | "menu";

export function EnablePushButton({
  variant = "default",
}: {
  variant?: EnablePushButtonVariant;
}) {
  const { status, isWorking, isEnabled, toggle } = usePushNotifications();

  // Nothing useful to show while we probe, or on browsers without Push support.
  if (status === "checking" || status === "unsupported") return null;

  const label = isEnabled ? "Disable message alerts" : "Enable message alerts";

  const renderIcon = (iconClass: string) =>
    isWorking ? (
      <Loader2 className={`${iconClass} animate-spin`} />
    ) : isEnabled ? (
      <BellRing className={iconClass} />
    ) : (
      <BellOff className={iconClass} />
    );

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isWorking}
        title={label}
        aria-label={label}
        aria-pressed={isEnabled}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-50 ${
          isEnabled
            ? "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        {renderIcon("h-4 w-4")}
      </button>
    );
  }

  if (variant === "navbar") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isWorking}
        title={label}
        aria-label={label}
        aria-pressed={isEnabled}
        className={`sb-menu-trigger h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 ${
          isEnabled
            ? "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
            : ""
        }`}
      >
        {renderIcon("h-4 w-4 sm:h-5 sm:w-5")}
      </button>
    );
  }

  if (variant === "menu") {
    return (
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={isEnabled}
        onClick={toggle}
        disabled={isWorking}
        title={label}
        className={`sb-menu-item flex w-full items-center gap-2 px-3 py-1.5 text-[13px] disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm ${
          isEnabled ? "text-blue-600 dark:text-blue-400" : ""
        }`}
      >
        {renderIcon("h-4 w-4")}
        <span>{isEnabled ? "Message alerts" : "Enable message alerts"}</span>
        {/* Spelled-out state, since every other row in this menu is a plain
            link and a changed label alone is easy to miss. */}
        <span
          className={`ml-auto text-[11px] font-medium ${
            isEnabled ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {isWorking ? "Updating..." : isEnabled ? "On" : "Off"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isWorking}
      aria-pressed={isEnabled}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
        isEnabled
          ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      }`}
    >
      {renderIcon("h-4 w-4")}
      {isWorking ? "Updating..." : isEnabled ? "Message alerts on" : "Enable message alerts"}
    </button>
  );
}