"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { signOut } from "@/app/actions/auth";
import useMediaQuery from "@/hooks/useMediaQuery";
import ThemeToggle from "@/components/layout/ThemeToggle";

type SidebarUser = {
  id: string;
  email?: string | null;
  isAdmin?: boolean | null;
} | null;

type SidebarProps = {
  user: SidebarUser;
};

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const isCollapsed = isDesktop ? desktopCollapsed : !mobileOpen;

  const checkScrollable = useCallback(() => {
    if (!navRef.current) return;
    const { scrollHeight, clientHeight, scrollTop } = navRef.current;
    setIsScrollable(scrollHeight > clientHeight + 4);
    setCanScrollDown(scrollTop < scrollHeight - clientHeight - 4);
  }, []);

  const scrollNavDown = useCallback(() => {
    if (!navRef.current) return;
    const { clientHeight, scrollHeight, scrollTop } = navRef.current;
    const remaining = scrollHeight - clientHeight - scrollTop;
    navRef.current.scrollBy({
      top: Math.min(clientHeight * 0.8, Math.max(remaining, 0)),
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const handleToggle = () => {
      setMobileOpen((current) => !current);
      window.setTimeout(checkScrollable, 300);
    };

    checkScrollable();
    navRef.current?.addEventListener("scroll", checkScrollable);
    window.addEventListener("resize", checkScrollable);
    window.addEventListener("sb-toggle-sidebar", handleToggle as EventListener);

    const observer = new MutationObserver(checkScrollable);
    if (navRef.current) {
      observer.observe(navRef.current, { childList: true, subtree: true });
    }

    return () => {
      navRef.current?.removeEventListener("scroll", checkScrollable);
      window.removeEventListener("resize", checkScrollable);
      window.removeEventListener(
        "sb-toggle-sidebar",
        handleToggle as EventListener,
      );
      observer.disconnect();
    };
  }, [checkScrollable]);

  const isOnLoginPage = pathname === "/login";

  const menuItems = [
    {
      name: "Feed",
      href: "/feed",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5L18.5 7H20z"
          />
        </svg>
      ),
    },
    {
      name: "Scholars",
      href: "/scholars",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H7m6 0v-2c0-1.657-2.686-3-6-3s-6 1.343-6 3v2m6-10a4 4 0 100-8 4 4 0 000 8zm9 4a3 3 0 100-6 3 3 0 000 6z"
          />
        </svg>
      ),
    },
    {
      name: "Messages",
      href: "/messages",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      name: "Supervisors",
      href: "/supervisor",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ),
    },
    {
      name: "Research Survey",
      href: "/surveys",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
    {
      name: "Admissions",
      href: "/admissions",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 14l9-5-9-5-9 5 9 5z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
          />
        </svg>
      ),
    },
    {
      name: "Vacancies",
      href: "/vacancies",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      name: "Events",
      href: "/events",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      name: "Results",
      href: "/results",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      name: "Blog",
      href: "/blog",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      name: "Research Tools",
      href: "/research-tools",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
    {
      name: "Journals",
      href: "/journals",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      ),
    },
    {
      name: "Publications",
      href: "/publications",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5l-1.5-1.5H18V9l1 1v9a1 1 0 01-1 1zM9 12h3m-3 4h6"
          />
        </svg>
      ),
    },
    {
      name: "Contributions",
      href: "/contributions",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      name: "Help",
      href: "/help",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8.257 13.257A6 6 0 1114 6h-1a3 3 0 00-3 3v1m0 4h.01M12 18h.01"
          />
        </svg>
      ),
    },
    ...(user?.isAdmin
      ? [
          {
            name: "Admin",
            href: "/admin",
            icon: (
              <svg
                className="h-6 w-6 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            ),
          },
        ]
      : []),
  ];

  const asideClasses = `fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200/70 bg-white/95 px-6 py-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-black/20 md:sticky md:top-0 md:z-20 md:h-screen md:gap-4 md:bg-white/70 md:py-6 md:backdrop-blur-xl md:transition-all md:shadow-none md:dark:bg-slate-950/80 ${
    isCollapsed
      ? "-translate-x-full md:translate-x-0 md:w-24 md:px-3"
      : "translate-x-0 md:w-72 md:px-6"
  }`;

  const profileHref = user ? `/scholars/${user.id}` : "/login";

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[1px] md:hidden dark:bg-black/60 ${isCollapsed ? "hidden" : ""}`}
        aria-label="Close navigation overlay"
      />

      <aside className={asideClasses}>
        <div
          className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}
        >
          {!isCollapsed ? (
            <Link
              href="/"
              className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50"
            >
              <BrandMark />
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => setDesktopCollapsed((current) => !current)}
            className="hidden rounded-2xl border border-slate-200/70 bg-white/80 p-2.5 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white md:inline-flex"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            )}
          </button>
        </div>

        <nav
          ref={navRef}
          onScroll={checkScrollable}
          className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200/80 scrollbar-track-transparent hover:scrollbar-thumb-slate-300/80 scrollbar-w-1.5 dark:scrollbar-thumb-slate-700 dark:hover:scrollbar-thumb-slate-600"
          style={{ scrollbarGutter: "stable", overscrollBehavior: "contain" }}
        >
          <div className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : ""}
                  onClick={() => {
                    if (!isDesktop) setMobileOpen(false);
                  }}
                  className={`flex items-center overflow-hidden rounded-2xl font-semibold transition-all duration-200 ${isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"} ${isActive ? "bg-blue-50/90 text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-300" : "text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/80 dark:hover:text-white"}`}
                >
                  <div
                    className={
                      isActive
                        ? "text-blue-600 dark:text-blue-300"
                        : "text-slate-400 dark:text-slate-500"
                    }
                  >
                    {item.icon}
                  </div>
                  <span
                    className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? "hidden w-0 opacity-0" : "w-auto opacity-100"}`}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {!isCollapsed && isScrollable ? (
          <button
            type="button"
            onClick={scrollNavDown}
            disabled={!canScrollDown}
            className={`mb-2 flex w-full items-center justify-center rounded-xl py-1 transition-colors ${
              canScrollDown
                ? "cursor-pointer text-slate-400 hover:bg-white/60 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-900/60 dark:hover:text-slate-300"
                : "cursor-default text-slate-200 dark:text-slate-700"
            }`}
            aria-label="Scroll navigation down"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        ) : null}

        {!isCollapsed ? <ThemeToggle /> : null}

        <div className="mt-auto border-t border-slate-200/70 pt-3 dark:border-slate-800">
          {user ? (
            isCollapsed ? (
              <div className="flex flex-col items-center gap-3">
                <Link
                  href={profileHref}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white shadow-sm dark:bg-white dark:text-slate-950"
                  aria-label={
                    user.email ? `Open ${user.email}` : "Open profile"
                  }
                  title={user.email ?? "Open profile"}
                  onClick={() => {
                    if (!isDesktop) setMobileOpen(false);
                  }}
                >
                  {user.email?.charAt(0).toUpperCase() || "@"}
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white"
                    aria-label="Sign out"
                  >
                    ⎋
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-3">
                <Link
                  href={profileHref}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/20 dark:hover:bg-slate-800"
                  onClick={() => {
                    if (!isDesktop) setMobileOpen(false);
                  }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
                    {user.email?.charAt(0).toUpperCase() || "@"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                      {user.email || "Open profile"}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      Open your scholar profile
                    </span>
                  </span>
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white"
                  >
                    Sign Out
                  </button>
                </form>
              </div>
            )
          ) : !isOnLoginPage ? (
            isCollapsed ? (
              <Link
                href="/login"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white"
                aria-label="Sign in"
                title="Sign in"
                onClick={() => {
                  if (!isDesktop) setMobileOpen(false);
                }}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
              </Link>
            ) : (
              <Link
                href="/login"
                className="sb-button-primary w-full justify-center dark:bg-black dark:hover:bg-black"
                onClick={() => {
                  if (!isDesktop) setMobileOpen(false);
                }}
              >
                Sign In
              </Link>
            )
          ) : null}
        </div>
      </aside>
    </>
  );
}
