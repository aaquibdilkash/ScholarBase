import Link from "next/link";

/**
 * Tab bar for the account settings page.
 *
 * Real `<Link>` navigation rather than client-side state, for three reasons:
 *   - the back button works, which matters on a settings page people arrive at
 *     from their profile and expect to return from;
 *   - a tab is a shareable URL (`?tab=security`), so a support reply can point
 *     at exactly the right panel;
 *   - only the active panel renders, so the other forms never mount.
 *
 * These are navigation links rather than widgets, so `aria-current="page"` is
 * the correct state marker. `aria-selected` belongs to `role="tab"`, which this
 * deliberately does not use: these panels are separately routable, and a tab
 * widget that is not a real URL breaks the back button.
 */
export type SettingsTabId =
  | "profile"
  | "security"
  | "notifications"
  | "app";

const TABS: { id: SettingsTabId; label: string; blurb: string }[] = [
  {
    id: "profile",
    label: "Profile",
    blurb: "Your name, handle, bio, avatar and profile links.",
  },
  {
    id: "security",
    label: "Security",
    blurb: "Password, account email, institutional verification, deletion.",
  },
  {
    id: "notifications",
    label: "Notifications",
    blurb: "How often you receive the email digest.",
  },
  {
    id: "app",
    label: "App",
    blurb: "Install ScholarBase on this device for faster, offline-friendly access.",
  },
];

/**
 * The tab shown when none is requested. Profile first, because that is where
 * people arrive from the "Edit profile" button on their profile page.
 */
export const DEFAULT_SETTINGS_TAB: SettingsTabId = "profile";

/**
 * Resolves an arbitrary `?tab=` value to a real tab.
 *
 * Fails closed rather than throwing or rendering nothing: a hand-typed or
 * stale `?tab=banana` shows the default panel instead of a blank page.
 */
export function resolveSettingsTab(
  raw: string | string[] | undefined,
): SettingsTabId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TABS.some((tab) => tab.id === value)
    ? (value as SettingsTabId)
    : DEFAULT_SETTINGS_TAB;
}

export function SettingsTabs({
  active,
  basePath,
}: {
  active: SettingsTabId;
  basePath: string;
}) {
  const activeTab = TABS.find((tab) => tab.id === active)!;

  return (
    <div>
      <nav aria-label="Settings sections">
        <ul className="flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 sm:inline-flex">
          {TABS.map((tab) => {
            const isActive = tab.id === active;
            return (
              <li key={tab.id}>
                <Link
                  href={`${basePath}?tab=${tab.id}`}
                  scroll={false}
                  prefetch={false}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "block rounded-xl px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-50",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        {activeTab.blurb}
      </p>
    </div>
  );
}