"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { signOut } from "@/app/actions/auth";
import useMediaQuery from "@/hooks/useMediaQuery";

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
  const [isCollapsed, setIsCollapsed] = useState(!isDesktop);
  const [isScrollable, setIsScrollable] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setIsCollapsed(false);
    } else {
      setIsCollapsed(true);
    }
  }, [isDesktop]);

  useEffect(() => {
    const checkScrollable = () => {
      if (navRef.current) {
        const { scrollHeight, clientHeight } = navRef.current;
        setIsScrollable(scrollHeight > clientHeight + 4);
      }
    };

    const handleToggle = () => {
      setIsCollapsed((current) => !current);
      setTimeout(checkScrollable, 300);
    };

    checkScrollable();
    window.addEventListener("resize", checkScrollable);
    window.addEventListener("sb-toggle-sidebar", handleToggle as EventListener);
    const observer = new MutationObserver(checkScrollable);
    const nav = navRef.current;
    if (nav) observer.observe(nav, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", checkScrollable);
      window.removeEventListener(
        "sb-toggle-sidebar",
        handleToggle as EventListener,
      );
      observer.disconnect();
    };
  }, []);

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

  const asideClasses = `fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200/70 bg-white/90 px-6 py-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl transition-transform duration-300 ease-in-out md:sticky md:top-0 md:z-20 md:h-screen md:gap-8 md:bg-white/70 md:py-6 md:backdrop-blur-xl md:transition-all md:shadow-none ${
    isCollapsed
      ? "-translate-x-full md:translate-x-0 md:w-24 md:px-3"
      : "translate-x-0 md:w-72 md:px-6"
  }`;

  const profileHref = user ? `/scholar/${user.id}` : "/login";

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsCollapsed(true)}
        className={`fixed inset-0 z-40 bg-slate-950/25 md:hidden ${
          isCollapsed ? "hidden" : ""
        }`}
        aria-label="Close navigation overlay"
      />

      <aside className={asideClasses}>
        <div
          className={`flex items-center ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!isCollapsed && (
            <Link href="/" className="text-2xl font-semibold tracking-tight">
              <BrandMark />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden rounded-2xl border border-slate-200/70 bg-white/80 p-2.5 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900 md:inline-flex"
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
          className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-slate-200/80 scrollbar-track-transparent hover:scrollbar-thumb-slate-300/80 scrollbar-w-1.5"
          style={{
            scrollbarGutter: "stable",
            overscrollBehavior: "contain",
          }}
        >
          <div className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center overflow-hidden rounded-2xl font-semibold transition-all duration-200 ${
                    isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                  } ${
                    isActive
                      ? "bg-blue-50/90 text-blue-700 shadow-sm"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                  }`}
                  title={isCollapsed ? item.name : ""}
                  onClick={() => {
                    if (!isDesktop) {
                      setIsCollapsed(true);
                    }
                  }}
                >
                  <div
                    className={isActive ? "text-blue-600" : "text-slate-400"}
                  >
                    {item.icon}
                  </div>
                  <span
                    className={`whitespace-nowrap transition-all duration-300 ${
                      isCollapsed
                        ? "hidden w-0 opacity-0"
                        : "w-auto opacity-100"
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Scroll indicator */}
        {!isCollapsed && isScrollable && (
          <div className="flex justify-center -mt-2 mb-1">
            <div className="flex gap-1.5">
              <span className="h-1 w-6 rounded-full bg-blue-200/60" />
              <span className="h-1 w-2 rounded-full bg-slate-200" />
              <span className="h-1 w-2 rounded-full bg-slate-200" />
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-slate-200/70 pt-4">
          {user ? (
            <>
              {isCollapsed ? (
                <div className="flex flex-col items-center gap-3">
                  <Link
                    href={profileHref}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white shadow-sm"
                    aria-label={
                      user.email ? `Open ${user.email}` : "Open profile"
                    }
                    title={user.email ?? "Open profile"}
                    onClick={() => {
                      if (!isDesktop) {
                        setIsCollapsed(true);
                      }
                    }}
                  >
                    {user.email?.charAt(0).toUpperCase() || "@"}
                  </Link>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      aria-label="Sign out"
                      onClick={() => {
                        if (!isDesktop) {
                          setIsCollapsed(true);
                        }
                      }}
                    >
                      ⎋
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href={profileHref}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/70"
                    onClick={() => {
                      if (!isDesktop) {
                        setIsCollapsed(true);
                      }
                    }}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {user.email?.charAt(0).toUpperCase() || "@"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-950">
                        {user.email || "Open profile"}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        Open your scholar profile
                      </span>
                    </span>
                  </Link>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      onClick={() => {
                        if (!isDesktop) {
                          setIsCollapsed(true);
                        }
                      }}
                    >
                      Sign Out
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            !isOnLoginPage && (
              <Link
                href="/login"
                className="sb-button-primary w-full justify-center"
                onClick={() => {
                  if (!isDesktop) {
                    setIsCollapsed(true);
                  }
                }}
              >
                Sign In
              </Link>
            )
          )}
        </div>
      </aside>
    </>
  );
}
