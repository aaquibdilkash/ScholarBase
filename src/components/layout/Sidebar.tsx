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
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import useMediaQuery from "@/hooks/useMediaQuery";
import ThemeToggle from "@/components/layout/ThemeToggle";
import SignOutButton from "@/components/auth/SignOutButton";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/utils/supabase/client";
import { privateChannelSync, userTopic, withRealtimeAuth } from "@/lib/realtime";
import { useNavigationDrawer } from "@/components/layout/NavigationDrawerProvider";

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

/**
 * Unread-badge ping published by the `Message` trigger
 * (`supabase/realtime/broadcast-messages.sql`) to `user:<id>` — one per
 * recipient per message, for every conversation the user is in.
 */
type RealtimeMessageRow = {
  id: string;
  body: string;
  conversationId: string;
  senderId: string;
  senderName: string | null;
  createdAt: string;
};

export default function Sidebar({ user, defaultCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // We keep this ONLY for click handlers, NOT for rendering classes
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  
  const [desktopCollapsed, setDesktopCollapsed] = useState(defaultCollapsed);
  // Off-canvas (mobile) drawer state now lives in NavigationDrawerProvider so
  // the app shell can mark itself `inert` while the drawer is open. Keeping it
  // local would mean the shell could never learn the drawer is open, and taps
  // outside it would keep reaching the page chrome and dropdowns behind it.
  const { isOpen: mobileOpen, setOpen: setMobileOpen } = useNavigationDrawer();
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

    const observer = new MutationObserver(checkScrollable);
    if (navElement) {
      observer.observe(navElement, { childList: true, subtree: true });
    }

    return () => {
      navElement?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", checkScrollable);
      observer.disconnect();
    };
  }, [checkScrollable]);

  // A drawer is a modal surface, so it gets the two affordances every modal
  // needs: Escape dismisses it, and the page behind it cannot scroll (without
  // this, a touch-drag on the scrim scrolls the background instead of the
  // drawer, which reads as the tap "missing").
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    // The slide-out is a CSS transition; re-measure once it has settled so the
    // scroll-down affordance reflects the newly visible overflow.
    const settle = window.setTimeout(checkScrollable, 300);

    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, setMobileOpen, checkScrollable]);

  const [optimisticUnreadMessages, setOptimisticUnreadMessages] = useState(user?.unreadMessages ?? 0);
  const pathnameRef = useRef(pathname);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    setOptimisticUnreadMessages(user?.unreadMessages ?? 0);
  }, [user?.unreadMessages]);

  useEffect(() => {
    if (!user) return;

    const markSeen = (messageId: string) => {
      if (seenMessageIdsRef.current.has(messageId)) return false;
      seenMessageIdsRef.current.add(messageId);
      // Keep this browser-session dedupe set bounded.
      if (seenMessageIdsRef.current.size > 1000) {
        const oldest = seenMessageIdsRef.current.values().next().value;
        if (oldest) seenMessageIdsRef.current.delete(oldest);
      }
      return true;
    };

    const handleMessageReceived = (event: CustomEvent) => {
      const { conversationId, message } = event.detail ?? {};
      if (!conversationId || !message?.id || !markSeen(message.id)) return;
      if (message.senderId === user.id) return;

      const routeSegments = pathnameRef.current.split("/").filter(Boolean);
      const isMessagesPage = routeSegments[0] === "messages";
      const activeConversationId = isMessagesPage ? routeSegments[1] : undefined;
      const isActiveConversation =
        activeConversationId === decodeURIComponent(String(conversationId));

      // Messages in the active conversation are already visible. Messages
      // from every other conversation notify and increment the global badge,
      // even while a conversation page is open.
      if (isActiveConversation) return;

      toast({
        title: message.sender?.name || "New message",
        description: message.body || undefined,
      });
      setOptimisticUnreadMessages((count) => count + 1);
    };

    const handleBadgePing = (raw: RealtimeMessageRow) => {
      if (!raw.conversationId || !raw.id || !raw.senderId) return;

      // One shared event feeds the conversation sidebar and the main badge.
      window.dispatchEvent(
        new CustomEvent("message-received", {
          detail: {
            conversationId: raw.conversationId,
            message: {
              id: raw.id,
              body: raw.body,
              senderId: raw.senderId,
              sender: { name: raw.senderName ?? null },
              createdAt: raw.createdAt,
            },
          },
        }),
      );
    };

    // ⚡ UNREAD BADGE — Broadcast from Database on `user:<id>`, the same
    // mechanism that drives the live thread on `conversation:<id>`.
    //
    // The trigger publishes one small ping per recipient per message, so there is
    // no table subscription that every connected browser must be authorized
    // against on every write.
    //
    // `privateChannel()` resolves the session before joining, which is what makes
    // a private join possible from here at all: `user` arrives as a server prop,
    // so this component can render before supabase-js has restored the session,
    // and a private channel authorized without a token is denied silently.
    //
    // The dep is `user?.id` — a primitive — never `user`, which is a fresh object
    // literal from the root layout and would re-join this channel every render.
    let cancelled = false;

    // ⚡ Channel is created SYNCHRONOUSLY so this effect's cleanup can always
    // remove it. Building it inside an awaited call meant cleanup ran while the
    // channel did not yet exist, the late-arriving one landed in the cancelled
    // branch and was discarded, and the badge never joined — silently.
    const ch = privateChannelSync(userTopic(user.id));

    ch.on(
      "broadcast",
      { event: "INSERT" },
      ({ payload }: { payload: RealtimeMessageRow }) => {
        if (process.env.NODE_ENV === "development") {
          console.log("[badge] ping received", payload?.conversationId);
        }
        if (payload) handleBadgePing(payload);
      },
    );

    if (process.env.NODE_ENV === "development") {
      console.log("[badge] subscribing", userTopic(user.id));
    }

    void withRealtimeAuth(() => {
      if (cancelled) return;
      ch.subscribe((status: string) => {
        if (process.env.NODE_ENV === "development") {
          console.log(`[badge] status: ${status}`);
        }
      });
    });

    window.addEventListener(
      "message-received",
      handleMessageReceived as EventListener,
    );
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
      window.removeEventListener(
        "message-received",
        handleMessageReceived as EventListener,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, toast]);

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
      { name: "Research Feed", href: "/feed", icon: <Newspaper className="h-6 w-6 shrink-0" /> },
      { name: "Research Scholars", href: "/scholars", icon: <Users className="h-6 w-6 shrink-0" /> },
      { name: "Messages", href: "/messages", icon: <MessageSquare className="h-6 w-6 shrink-0" />, badge: optimisticUnreadMessages },
      { name: "Scholar Shield", href: "/shield", icon: <Shield className="h-6 w-6 shrink-0" /> },
      { name: "Supervisor Suggest", href: "/supervisor", icon: <Star className="h-6 w-6 shrink-0" /> },
      { name: "Research Journals", href: "/journals", icon: <List className="h-6 w-6 shrink-0" /> },
      { name: "Research Survey", href: "/surveys", icon: <ClipboardList className="h-6 w-6 shrink-0" /> },
      { name: "Admissions", href: "/admissions", icon: <GraduationCap className="h-6 w-6 shrink-0" /> },
      { name: "Vacancies", href: "/vacancies", icon: <Briefcase className="h-6 w-6 shrink-0" /> },
      { name: "Research Events", href: "/events", icon: <Calendar className="h-6 w-6 shrink-0" /> },
      { name: "Results", href: "/results", icon: <BarChart2 className="h-6 w-6 shrink-0" /> },
      { name: "Research Grants", href: "/grants", icon: <HandCoins className="h-6 w-6 shrink-0" /> },
      { name: "Research Blog", href: "/blog", icon: <FileText className="h-6 w-6 shrink-0" /> },
      { name: "Research Tools", href: "/research-tools", icon: <Search className="h-6 w-6 shrink-0" /> },
      { name: "Learning Zone", href: "/learn", icon: <BookMarked className="h-6 w-6 shrink-0" /> },
      { name: "Research Publications", href: "/publications", icon: <File className="h-6 w-6 shrink-0" /> },
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
        className={`fixed inset-0 z-drawer-scrim bg-slate-950/25 backdrop-blur-[1px] lg:hidden dark:bg-black/60 transition-opacity duration-300 ${!mobileOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        aria-label="Close navigation overlay"
      />

      <aside 
        className={`fixed inset-y-0 left-0 z-drawer flex flex-col border-r border-slate-200/70 sb-sidebar-bg py-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl transition-all duration-300 ease-in-out dark:border-slate-800 dark:shadow-black/20 

        lg:sticky lg:top-0 lg:z-20 lg:h-dvh lg:shrink-0 lg:gap-4 lg:py-6 lg:backdrop-blur-xl lg:shadow-sm
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"} w-72 px-6 
        lg:translate-x-0 ${desktopCollapsed ? "lg:w-24 lg:px-3" : "lg:w-72 lg:px-6"}`}
      >
        <div className={`flex w-full items-center transition-all duration-300 justify-between ${desktopCollapsed ? "lg:justify-center" : ""}`}>
          <Link prefetch={false}
            href="/"
            className={`overflow-hidden whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-950 transition-all duration-300 ease-in-out dark:text-slate-50
            max-w-[200px] opacity-100 mr-2 pl-4 
            ${desktopCollapsed ? "lg:w-0 lg:max-w-0 lg:opacity-0 lg:m-0 lg:p-0" : ""}`}
          >
            <BrandMark />
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden shrink-0 rounded-2xl border border-slate-200/70 bg-[var(--input-bg)] text-slate-950 shadow-sm transition hover:border-slate-300 hover:bg-[var(--surface-strong)] hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white inline-flex items-center justify-center h-10 w-10"
              aria-label="Close sidebar"
            >
              <ChevronsLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={toggleDesktop}
              className={`hidden shrink-0 rounded-2xl border border-slate-200/70 bg-[var(--input-bg)] text-slate-950 shadow-sm transition hover:border-slate-300 hover:bg-[var(--surface-strong)] hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white lg:inline-flex items-center justify-center
              ${desktopCollapsed ? "lg:h-12 lg:w-12 lg:mx-auto lg:p-0" : "lg:h-11 lg:w-11 lg:p-0"}`}
              aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {desktopCollapsed ? <Menu className="h-6 w-6" /> : <ChevronsLeft className="h-6 w-6" />}
            </button>
          </div>
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
                <Link prefetch={false}
                  key={item.name}
                  href={item.href}
                  ref={(el) => { itemRefs.current[item.href] = el; }}
                  title={desktopCollapsed ? item.name : ""}
                  onClick={() => { if (!isDesktop) setMobileOpen(false); }}
                  className={`flex items-center overflow-hidden rounded-2xl font-semibold transition-all duration-300 ease-in-out
                    w-full px-4 py-3 justify-start gap-3
                    ${desktopCollapsed ? "lg:w-12 lg:h-12 lg:mx-auto lg:justify-center lg:p-0 lg:gap-0" : ""}
                    ${isActive ? "bg-blue-50/90 text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-300" : "text-slate-950 hover:bg-[var(--surface)] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/80 dark:hover:text-white"}
                  `}
                >
                  <div className={`shrink-0 transition-colors ${isActive ? "text-blue-600 dark:text-blue-300" : "text-slate-800 dark:text-slate-500"}`}>
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
                      ${desktopCollapsed ? "lg:w-0 lg:max-w-0 lg:opacity-0 lg:m-0 lg:p-0" : ""}
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
                 ? "cursor-pointer text-slate-800 hover:bg-[var(--surface-soft)] hover:text-slate-950 dark:text-slate-500 dark:hover:bg-slate-900/60 dark:hover:text-slate-300"
                : "cursor-default text-slate-300 dark:text-slate-700"
            }`}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        <div className="mt-auto">
          <div className="mb-3 flex justify-center">
            <ThemeToggle collapsed={desktopCollapsed} />
          </div>
          
          <div className="border-t border-slate-200/70 pt-3 dark:border-slate-800 flex flex-col gap-3">
            {user ? (
              <>
                <Link prefetch={false}
                  href={profileHref}
                  className={`group flex items-center overflow-hidden rounded-2xl transition-all duration-300 ease-in-out
                    w-full border border-slate-200/70 bg-[var(--input-bg)] px-4 py-3 gap-3 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/20 dark:hover:bg-slate-800
                    ${desktopCollapsed ? "lg:w-12 lg:h-12 lg:mx-auto lg:justify-center lg:p-0 lg:border-transparent lg:bg-transparent lg:gap-0" : ""}
                  `}
                  onClick={() => { if (!isDesktop) setMobileOpen(false); }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white transition-colors dark:bg-white dark:text-slate-950">
                    <UserAvatar
                      src={user?.avatarUrl}
                      email={user?.email}
                      imageClassName="rounded-full"
                      fallbackClassName="text-sm font-semibold"
                    />
                  </span>
                  
                  <span
                    className={`flex flex-col whitespace-nowrap transition-all duration-300 ease-in-out
                      max-w-[160px] opacity-100
                      ${desktopCollapsed ? "lg:w-0 lg:max-w-0 lg:opacity-0 lg:m-0 lg:p-0" : ""}
                    `}
                  >
                    <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                      {user.email || "Open profile"}
                    </span>
                    <span className="block truncate text-xs text-slate-800 dark:text-slate-400">
                      Open your scholar profile
                    </span>
                  </span>
                </Link>

                <SignOutButton
                  className={`sb-button-primary relative flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out dark:border dark:border-slate-700 dark:bg-black dark:shadow-[0_10px_24px_rgba(0,0,0,0.5)] dark:hover:border-slate-500 dark:hover:bg-slate-800
                    w-full rounded-2xl px-4 py-3
                    ${desktopCollapsed ? "lg:h-12 lg:w-12 lg:p-0 lg:mx-auto lg:justify-center" : ""}
                  `}
                  aria-label="Sign out"
                >
                  <LogOut
                    className={`absolute h-5 w-5 transition-all duration-300 ease-in-out
                      scale-50 opacity-0
                      ${desktopCollapsed ? "lg:scale-100 lg:opacity-100" : ""}
                    `}
                  />
                  <span
                    className={`whitespace-nowrap transition-all duration-300 ease-in-out
                      scale-100 opacity-100
                      ${desktopCollapsed ? "lg:w-0 lg:max-w-0 lg:opacity-0 lg:scale-50" : ""}
                    `}
                  >
                    Sign Out
                  </span>
                </SignOutButton>
              </>
            ) : !isOnLoginPage ? (
              <Link prefetch={false}
                href={`/login?callbackUrl=${encodeURIComponent(isOnLoginPage ? "/" : currentUrl)}`}
                className={`sb-button-primary relative flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out dark:bg-black dark:hover:bg-black
                  w-full rounded-2xl px-4 py-3
                  ${desktopCollapsed ? "lg:h-12 lg:w-12 lg:rounded-2xl lg:p-0 lg:mx-auto lg:justify-center lg:bg-[var(--surface-strong)] lg:border lg:border-[var(--card-border)] lg:text-slate-950 lg:dark:border-slate-800 lg:dark:bg-slate-900 lg:dark:text-slate-300" : ""}
                `}
                onClick={() => { if (!isDesktop) setMobileOpen(false); }}
              >
                <LogIn
                  className={`absolute h-5 w-5 transition-all duration-300 ease-in-out
                    scale-50 opacity-0
                    ${desktopCollapsed ? "lg:scale-100 lg:opacity-100" : ""}
                  `}
                />
                <span
                  className={`whitespace-nowrap transition-all duration-300 ease-in-out
                    scale-100 opacity-100
                    ${desktopCollapsed ? "lg:w-0 lg:max-w-0 lg:opacity-0 lg:scale-50" : ""}
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
