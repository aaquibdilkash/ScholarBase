"use client";

import {
  BarChart2,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronsLeft,
  ClipboardList,
  File,
  FileText,
  Gift,
  HandCoins,
  GraduationCap,
  HelpCircle,
  List,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Newspaper,
  Search,
  Shield,
  Star,
  Users,
  BookMarked,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import useMediaQuery from "@/hooks/useMediaQuery";
import ThemeToggle from "@/components/layout/ThemeToggle";
import SignOutButton from "@/components/auth/SignOutButton";

type SidebarUser = {
  id: string;
  email?: string | null;
  isAdmin?: boolean | null;
  unreadMessages?: number;
  avatarUrl?: string | null;
} | null;

type SidebarProps = {
  user: SidebarUser;
};

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const isCollapsed = isDesktop ? desktopCollapsed : !mobileOpen;

  useEffect(() => {
    setDesktopCollapsed(localStorage.getItem("sb-main-sidebar-collapsed") === "true");
    setSidebarPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (sidebarPreferenceLoaded) {
      localStorage.setItem("sb-main-sidebar-collapsed", String(desktopCollapsed));
    }
  }, [desktopCollapsed, sidebarPreferenceLoaded]);

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
    const navElement = navRef.current;
    const handleToggle = () => {
      setMobileOpen((current) => !current);
      window.setTimeout(checkScrollable, 300);
    };

    checkScrollable();
    if (navElement) {
      const savedScrollTop = Number(localStorage.getItem("sb-main-sidebar-scroll-top") || "0");
      if (savedScrollTop > 0) {
        requestAnimationFrame(() => {
          if (navElement) navElement.scrollTop = savedScrollTop;
        });
      }
    }

    const handleScroll = () => {
      checkScrollable();
      if (navElement) {
        localStorage.setItem("sb-main-sidebar-scroll-top", String(navElement.scrollTop));
      }
    };

    navElement?.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", checkScrollable);
    window.addEventListener("sb-toggle-sidebar", handleToggle as EventListener);

    const observer = new MutationObserver(checkScrollable);
    if (navElement) {
      observer.observe(navElement, { childList: true, subtree: true });
    }

    return () => {
      navElement?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", checkScrollable);
      window.removeEventListener(
        "sb-toggle-sidebar",
        handleToggle as EventListener,
      );
      observer.disconnect();
    };
  }, [checkScrollable]);

  const isOnLoginPage = pathname === "/login";
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const menuItems = useMemo(
    () => [
      {
        name: "Feed",
        href: "/feed",
        icon: <Newspaper className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Scholars",
        href: "/scholars",
        icon: <Users className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Messages",
        href: "/messages",
        icon: <MessageSquare className="h-6 w-6 shrink-0" />,
        badge: user?.unreadMessages ?? 0,
      },
      {
        name: "Supervisors",
        href: "/supervisor",
        icon: <Star className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Research Survey",
        href: "/surveys",
        icon: <ClipboardList className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Admissions",
        href: "/admissions",
        icon: <GraduationCap className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Vacancies",
        href: "/vacancies",
        icon: <Briefcase className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Events",
        href: "/events",
        icon: <Calendar className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Results",
        href: "/results",
        icon: <BarChart2 className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Research Grants",
        href: "/grants",
        icon: <HandCoins className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Blog",
        href: "/blog",
        icon: <FileText className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Research Tools",
        href: "/research-tools",
        icon: <Search className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Learning Zone",
        href: "/learn",
        icon: <BookMarked className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Journals",
        href: "/journals",
        icon: <List className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Publications",
        href: "/publications",
        icon: <File className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Contributions",
        href: "/contributions",
        icon: <Gift className="h-6 w-6 shrink-0" />,
      },
      {
        name: "Help",
        href: "/help",
        icon: <HelpCircle className="h-6 w-6 shrink-0" />,
      },
      ...(user?.isAdmin
        ? [
            {
              name: "Admin",
              href: "/admin",
              icon: <Shield className="h-6 w-6 shrink-0" />,
            },
          ]
        : []),
    ],
    [user?.isAdmin, user?.unreadMessages],
  );

  useEffect(() => {
    const activeHref =
      menuItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
        ?.href;
    if (!activeHref || !sidebarPreferenceLoaded) return;
    const el = itemRefs.current[activeHref];
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: "nearest", behavior: "auto" });
      });
    }
  }, [menuItems, pathname, sidebarPreferenceLoaded]);

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
              <Menu className="h-6 w-6" />
            ) : (
              <ChevronsLeft className="h-6 w-6" />
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
              const badge = "badge" in item ? item.badge ?? 0 : 0;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  ref={(el) => {
                    itemRefs.current[item.href] = el;
                  }}
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
                    <span className="relative inline-flex">
                      {item.icon}
                      {badge > 0 ? (
                        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
                    </span>
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
            <ChevronDown className="h-4 w-4" />
          </button>
        ) : null}

        <div className="mt-auto">
          <div className={`mb-3 ${isCollapsed ? "flex justify-center" : ""}`}>
            <ThemeToggle collapsed={isCollapsed} />
          </div>
          <div className="border-t border-slate-200/70 pt-3 dark:border-slate-800">
            {user ? (
              isCollapsed ? (
                <div className="flex flex-col items-center gap-3">
                  <Link
                    href={profileHref}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    aria-label={
                      user.email ? `Open ${user.email}` : "Open profile"
                    }
                    title={user.email ?? "Open profile"}
                    onClick={() => {
                      if (!isDesktop) setMobileOpen(false);
                    }}
                  >
                    {user?.avatarUrl ? (
                                            <Image
                        width={44}
                        height={44}
                        src={user.avatarUrl}
                        alt={user.email || "Scholar"}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      user?.email?.charAt(0).toUpperCase() || "@"
                    )}
                  </Link>
                  <SignOutButton
                    className="sb-button-primary h-11 w-11 rounded-full p-0 dark:border dark:border-slate-700 dark:bg-black dark:shadow-[0_10px_24px_rgba(0,0,0,0.5)] dark:hover:border-slate-500 dark:hover:bg-slate-800"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-5 w-5" />
                  </SignOutButton>
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
                                        {user?.avatarUrl ? (
                                                                                    <Image
                                            width={40}
                                            height={40}
                                            src={user.avatarUrl}
                                            alt={user.email || "Scholar"}
                                            className="rounded-full object-cover"
                                          />
                                        ) : (
                                          user?.email?.charAt(0).toUpperCase() || "@"
                                        )}
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
                  <SignOutButton className="sb-button-primary w-full rounded-2xl px-4 py-3 dark:border dark:border-slate-700 dark:bg-black dark:shadow-[0_10px_24px_rgba(0,0,0,0.5)] dark:hover:border-slate-500 dark:hover:bg-slate-800">
                    Sign Out
                  </SignOutButton>
                </div>
              )
            ) : !isOnLoginPage ? (
              isCollapsed ? (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(
                    isOnLoginPage ? "/" : currentUrl
                  )}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white"
                  aria-label="Sign in"
                  title="Sign in"
                  onClick={() => {
                    if (!isDesktop) setMobileOpen(false);
                  }}
                >
                  <LogIn className="h-5 w-5" />
                </Link>
              ) : (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(
                    isOnLoginPage ? "/" : currentUrl
                  )}`}
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
        </div>
      </aside>
    </>
  );
}
