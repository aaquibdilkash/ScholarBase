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
  defaultCollapsed: boolean;
};

export default function Sidebar({ user, defaultCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // We keep this ONLY for click handlers, NOT for rendering classes
  const isDesktop = useMediaQuery("(min-width: 768px)");
  
  const [desktopCollapsed, setDesktopCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const toggleDesktop = () => {
    setDesktopCollapsed((current) => {
      const newState = !current;
      document.cookie = `sb-main-sidebar-collapsed=${newState}; path=/; max-age=31536000`;
      return newState;
    });
  };

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

  const [optimisticUnreadMessages, setOptimisticUnreadMessages] = useState(user?.unreadMessages ?? 0);

  useEffect(() => {
    setOptimisticUnreadMessages(user?.unreadMessages ?? 0);
  }, [user?.unreadMessages]);

  useEffect(() => {
    const handleConversationRead = (event: Event) => {
      const { delta } = (event as CustomEvent<{ delta: number }>).detail || {};
      if (typeof delta === 'number' && delta > 0) {
        setOptimisticUnreadMessages((prev) => Math.max(0, prev - delta));
      }
    };
    window.addEventListener('conversation-read', handleConversationRead as EventListener);
    return () => window.removeEventListener('conversation-read', handleConversationRead as EventListener);
  }, []);

  const isOnLoginPage = pathname === "/login";
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const menuItems = useMemo(
    () => [
      { name: "Feed", href: "/feed", icon: <Newspaper className="h-6 w-6 shrink-0" /> },
      { name: "Scholars", href: "/scholars", icon: <Users className="h-6 w-6 shrink-0" /> },
      { name: "Messages", href: "/messages", icon: <MessageSquare className="h-6 w-6 shrink-0" />, badge: optimisticUnreadMessages },
      { name: "Supervisors", href: "/supervisor", icon: <Star className="h-6 w-6 shrink-0" /> },
      { name: "Research Survey", href: "/surveys", icon: <ClipboardList className="h-6 w-6 shrink-0" /> },
      { name: "Admissions", href: "/admissions", icon: <GraduationCap className="h-6 w-6 shrink-0" /> },
      { name: "Vacancies", href: "/vacancies", icon: <Briefcase className="h-6 w-6 shrink-0" /> },
      { name: "Events", href: "/events", icon: <Calendar className="h-6 w-6 shrink-0" /> },
      { name: "Results", href: "/results", icon: <BarChart2 className="h-6 w-6 shrink-0" /> },
      { name: "Research Grants", href: "/grants", icon: <HandCoins className="h-6 w-6 shrink-0" /> },
      { name: "Research Blog", href: "/blog", icon: <FileText className="h-6 w-6 shrink-0" /> },
      { name: "Research Tools", href: "/research-tools", icon: <Search className="h-6 w-6 shrink-0" /> },
      { name: "Learning Zone", href: "/learn", icon: <BookMarked className="h-6 w-6 shrink-0" /> },
      { name: "Journals", href: "/journals", icon: <List className="h-6 w-6 shrink-0" /> },
      { name: "Publications", href: "/publications", icon: <File className="h-6 w-6 shrink-0" /> },
      { name: "Contributions", href: "/contributions", icon: <Gift className="h-6 w-6 shrink-0" /> },
      { name: "Scholar Suggest", href: "/help", icon: <HelpCircle className="h-6 w-6 shrink-0" /> },
      ...(user?.isAdmin ? [{ name: "Admin", href: "/admin", icon: <Shield className="h-6 w-6 shrink-0" /> }] : []),
    ],
    [user?.isAdmin, optimisticUnreadMessages],
  );

  useEffect(() => {
    const activeHref =
      menuItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;
    if (!activeHref) return;
    const el = itemRefs.current[activeHref];
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: "nearest", behavior: "auto" });
      });
    }
  }, [menuItems, pathname]);

  const profileHref = user ? `/scholars/${user.id}` : "/login";

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[1px] md:hidden dark:bg-black/60 transition-opacity duration-300 ${!mobileOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        aria-label="Close navigation overlay"
      />

      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/70 bg-white/95 py-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-black/20 
        md:sticky md:top-0 md:z-20 md:h-screen md:gap-4 md:bg-white/70 md:py-6 md:backdrop-blur-xl md:shadow-none md:dark:bg-slate-950/80 
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"} w-72 px-6 
        md:translate-x-0 ${desktopCollapsed ? "md:w-24 md:px-3" : "md:w-72 md:px-6"}`}
      >
        <div className={`flex w-full items-center transition-all duration-300 justify-between ${desktopCollapsed ? "md:justify-center" : ""}`}>
          <Link
            href="/"
            className={`overflow-hidden whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950 transition-all duration-300 ease-in-out dark:text-slate-50
            max-w-[200px] opacity-100 mr-2 pl-4 
            ${desktopCollapsed ? "md:w-0 md:max-w-0 md:opacity-0 md:m-0 md:p-0" : ""}`}
          >
            <BrandMark />
          </Link>

          <button
            type="button"
            onClick={toggleDesktop}
            className={`hidden shrink-0 rounded-2xl border border-slate-200/70 bg-white/80 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white md:inline-flex items-center justify-center 
            ${desktopCollapsed ? "md:h-12 md:w-12 md:mx-auto md:p-0" : "md:h-11 md:w-11 md:p-0"}`}
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? <Menu className="h-6 w-6" /> : <ChevronsLeft className="h-6 w-6" />}
          </button>
        </div>

        <nav
          ref={navRef}
          onScroll={checkScrollable}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200/80 scrollbar-track-transparent hover:scrollbar-thumb-slate-300/80 scrollbar-w-1.5 dark:scrollbar-thumb-slate-700 dark:hover:scrollbar-thumb-slate-600"
          style={{ scrollbarGutter: "stable", overscrollBehavior: "contain" }}
        >
          <div className="flex flex-col gap-1 mt-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge = "badge" in item ? item.badge ?? 0 : 0;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  ref={(el) => { itemRefs.current[item.href] = el; }}
                  title={desktopCollapsed ? item.name : ""}
                  onClick={() => { if (!isDesktop) setMobileOpen(false); }}
                  className={`flex items-center overflow-hidden rounded-2xl font-semibold transition-all duration-300 ease-in-out
                    w-full px-4 py-3 justify-start gap-3
                    ${desktopCollapsed ? "md:w-12 md:h-12 md:mx-auto md:justify-center md:p-0 md:gap-0" : ""}
                    ${isActive ? "bg-blue-50/90 text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-300" : "text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/80 dark:hover:text-white"}
                  `}
                >
                  <div className={`shrink-0 transition-colors ${isActive ? "text-blue-600 dark:text-blue-300" : "text-slate-400 dark:text-slate-500"}`}>
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
                    className={`whitespace-nowrap transition-all duration-300 ease-in-out
                      max-w-[200px] opacity-100
                      ${desktopCollapsed ? "md:w-0 md:max-w-0 md:opacity-0 md:m-0 md:p-0" : ""}
                    `}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {!desktopCollapsed && isScrollable ? (
          <button
            type="button"
            onClick={scrollNavDown}
            disabled={!canScrollDown}
            aria-label="Scroll navigation down"
            className={`mb-2 flex w-full items-center justify-center rounded-xl py-1 transition-colors ${
              canScrollDown
                ? "cursor-pointer text-slate-400 hover:bg-white/60 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-900/60 dark:hover:text-slate-300"
                : "cursor-default text-slate-200 dark:text-slate-700"
            }`}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        <div className="mt-auto overflow-hidden">
          <div className="mb-3 flex justify-center">
            <ThemeToggle collapsed={desktopCollapsed} />
          </div>
          
          <div className="border-t border-slate-200/70 pt-3 dark:border-slate-800 flex flex-col gap-3">
            {user ? (
              <>
                <Link
                  href={profileHref}
                  className={`group flex items-center overflow-hidden rounded-2xl transition-all duration-300 ease-in-out
                    w-full border border-slate-200/70 bg-white px-4 py-3 gap-3 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/20 dark:hover:bg-slate-800
                    ${desktopCollapsed ? "md:w-12 md:h-12 md:mx-auto md:justify-center md:p-0 md:border-transparent md:bg-transparent md:gap-0" : ""}
                  `}
                  onClick={() => { if (!isDesktop) setMobileOpen(false); }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white transition-colors dark:bg-white dark:text-slate-950">
                    {user?.avatarUrl ? (
                      <Image width={44} height={44} src={user.avatarUrl} alt={user.email || "Scholar"} className="rounded-full object-cover" />
                    ) : (
                      user?.email?.charAt(0).toUpperCase() || "@"
                    )}
                  </span>
                  
                  <span
                    className={`flex flex-col whitespace-nowrap transition-all duration-300 ease-in-out
                      max-w-[160px] opacity-100
                      ${desktopCollapsed ? "md:w-0 md:max-w-0 md:opacity-0 md:m-0 md:p-0" : ""}
                    `}
                  >
                    <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                      {user.email || "Open profile"}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      Open your scholar profile
                    </span>
                  </span>
                </Link>

                <SignOutButton
                  className={`sb-button-primary relative flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out dark:border dark:border-slate-700 dark:bg-black dark:shadow-[0_10px_24px_rgba(0,0,0,0.5)] dark:hover:border-slate-500 dark:hover:bg-slate-800
                    w-full rounded-2xl px-4 py-3
                    ${desktopCollapsed ? "md:h-12 md:w-12 md:p-0 md:mx-auto md:justify-center" : ""}
                  `}
                  aria-label="Sign out"
                >
                  <LogOut
                    className={`absolute h-5 w-5 transition-all duration-300 ease-in-out
                      scale-50 opacity-0
                      ${desktopCollapsed ? "md:scale-100 md:opacity-100" : ""}
                    `}
                  />
                  <span
                    className={`whitespace-nowrap transition-all duration-300 ease-in-out
                      scale-100 opacity-100
                      ${desktopCollapsed ? "md:w-0 md:max-w-0 md:opacity-0 md:scale-50" : ""}
                    `}
                  >
                    Sign Out
                  </span>
                </SignOutButton>
              </>
            ) : !isOnLoginPage ? (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(isOnLoginPage ? "/" : currentUrl)}`}
                className={`sb-button-primary relative flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out dark:bg-black dark:hover:bg-black
                  w-full rounded-2xl px-4 py-3
                  ${desktopCollapsed ? "md:h-12 md:w-12 md:rounded-2xl md:p-0 md:mx-auto md:justify-center md:bg-white md:border md:border-slate-200 md:text-slate-600 md:dark:border-slate-800 md:dark:bg-slate-900 md:dark:text-slate-300" : ""}
                `}
                onClick={() => { if (!isDesktop) setMobileOpen(false); }}
              >
                <LogIn
                  className={`absolute h-5 w-5 transition-all duration-300 ease-in-out
                    scale-50 opacity-0
                    ${desktopCollapsed ? "md:scale-100 md:opacity-100" : ""}
                  `}
                />
                <span
                  className={`whitespace-nowrap transition-all duration-300 ease-in-out
                    scale-100 opacity-100
                    ${desktopCollapsed ? "md:w-0 md:max-w-0 md:opacity-0 md:scale-50" : ""}
                  `}
                >
                  Sign In
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}