"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { signOut } from "@/app/actions/auth";

type SidebarUser = {
  id: string;
  email?: string | null;
} | null;

type SidebarProps = {
  user: SidebarUser;
};

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsCollapsed(mobile);
    };

    const handleToggle = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed((current) => !current);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("sb-toggle-sidebar", handleToggle as EventListener);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener(
        "sb-toggle-sidebar",
        handleToggle as EventListener,
      );
    };
  }, []);

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
          xmlns="http://www.w3.org/2000/svg"
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
          xmlns="http://www.w3.org/2000/svg"
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
      name: "Results",
      href: "/results",
      icon: (
        <svg
          className="h-6 w-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
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
  ];

  const asideClasses = isMobile
    ? `fixed inset-y-0 left-0 z-50 w-72 border-r border-white/60 bg-white/90 px-6 py-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl transition-transform duration-300 ease-in-out ${
        isCollapsed ? "-translate-x-full" : "translate-x-0"
      }`
    : `sticky top-0 z-20 flex h-screen flex-col gap-8 border-r border-white/60 bg-white/70 py-6 backdrop-blur-xl transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-20 px-3" : "w-64 px-6"
      }`;

  const profileHref = user ? `/scholar/${user.id}` : "/login";

  return (
    <>
      {isMobile && !isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="fixed inset-0 z-40 bg-slate-950/25 md:hidden"
          aria-label="Close navigation overlay"
        />
      )}

      <aside className={asideClasses}>
        <div
          className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}
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

        <nav className="flex flex-1 flex-col gap-2">
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
                  if (isMobile) {
                    setIsCollapsed(true);
                  }
                }}
              >
                <div className={isActive ? "text-blue-600" : "text-slate-400"}>
                  {item.icon}
                </div>

                <span
                  className={`whitespace-nowrap transition-all duration-300 ${
                    isCollapsed ? "hidden w-0 opacity-0" : "w-auto opacity-100"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-200/70 pt-4">
          {user ? (
            isCollapsed ? (
              <div className="flex flex-col items-center gap-3">
                <Link
                  href={profileHref}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white shadow-sm"
                  aria-label={
                    user.email ? `Open ${user.email}` : "Open profile"
                  }
                  title={user.email ?? "Open profile"}
                >
                  {user.email?.charAt(0).toUpperCase() || "@"}
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
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
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/70"
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
                  >
                    Sign Out
                  </button>
                </form>
              </div>
            )
          ) : (
            <Link
              href="/login"
              className="sb-button-accent w-full justify-center"
            >
              Log In
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
