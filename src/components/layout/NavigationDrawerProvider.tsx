"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * NavigationDrawerProvider
 * ------------------------
 * Owns the open/closed state of the app's off-canvas navigation drawer and,
 * critically, PUBLISHES it so the rest of the shell can be made `inert`.
 *
 * Why this exists
 * ---------------
 * A drawer plus its scrim is a MODAL surface: while it is open, nothing outside
 * it may be reachable. A scrim alone cannot guarantee that — it only wins the
 * clicks that land on its own pixels. Two things escape it:
 *
 *   1. Anything painted ABOVE the scrim. Dropdown menus (kebab, user actions)
 *      and the sticky navbar all sat at z-50..z-[100] while the scrims were at
 *      z-30/z-40, so a tap "outside" the open drawer opened a menu instead of
 *      dismissing the drawer. The z-scale in globals.css fixes the ordering.
 *   2. Keyboard and assistive tech. Focus could still Tab from the drawer into
 *      the page behind it, and a screen reader could still walk the background.
 *      `inert` fixes both: it removes a subtree from the tab order and the
 *      accessibility tree and makes it non-interactive, in one attribute.
 *
 * `inert` is the standard primitive for this, so the shell does not need a
 * hand-rolled focus trap re-implementing every edge case.
 *
 * The drawer and the shell are SIBLINGS in the layout (both children of the
 * shell row), so marking the shell column `inert` leaves the drawer fully
 * interactive. That is the whole trick — `inert` suppresses a subtree without
 * needing to portal the drawer out of it, which matters because at `lg+` the
 * `<aside>` is a real flex child of the shell row and portalling it away would
 * break the desktop layout.
 *
 * Consumers treat `isOpen` as meaningful below the `lg` breakpoint only — above
 * it the drawer is a normal sticky sidebar.
 */
interface NavigationDrawerContextValue {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const NavigationDrawerContext =
  createContext<NavigationDrawerContextValue | null>(null);

export function NavigationDrawerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const setOpen = useCallback((open: boolean) => setIsOpen(open), []);
  const toggle = useCallback(() => setIsOpen((current) => !current), []);

  const value = useMemo(
    () => ({ isOpen, setOpen, toggle }),
    [isOpen, setOpen, toggle],
  );

  return (
    <NavigationDrawerContext.Provider value={value}>
      {children}
    </NavigationDrawerContext.Provider>
  );
}

export function useNavigationDrawer(): NavigationDrawerContextValue {
  const ctx = useContext(NavigationDrawerContext);
  if (!ctx) {
    throw new Error(
      "useNavigationDrawer must be used within <NavigationDrawerProvider>",
    );
  }
  return ctx;
}

/**
 * InertWhenDrawerOpen
 * ------------------
 * The shell column, marked `inert` whenever the navigation drawer is open.
 *
 * `inert` is the single attribute that covers all three leaks a scrim cannot:
 * it stops pointer events (so no click reaches a button behind the dimmed
 * layer), removes descendants from the tab order (so focus cannot wander out of
 * the open drawer), and hides the subtree from assistive technology.
 *
 * It renders the column element itself rather than wrapping one in an extra
 * div, because that element is a flex child of the shell row and an extra
 * wrapper would break the desktop `lg:flex-row` layout. Being a sibling of the
 * drawer, it leaves the drawer fully interactive while it is open.
 */
export function InertWhenDrawerOpen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isOpen } = useNavigationDrawer();
  return (
    <div className={className} inert={isOpen ? true : undefined}>
      {children}
    </div>
  );
}