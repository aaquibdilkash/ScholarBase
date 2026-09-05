import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import NextTopLoader from "nextjs-toploader";
import { ensureUserProfile } from "@/lib/users";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { AppProviders } from "@/components/interactions/AppProviders";
import { getUnreadMessageCount } from "@/app/actions/messages";
import { cookies } from "next/headers";

// In app/layout.tsx or your root SEO metadata config
const isDev =
  process.env.NEXT_PUBLIC_SITE_URL?.includes("dev.scholarbase.app") ||
  process.env.VERCEL_ENV !== "production";

export const metadata: Metadata = {
  metadataBase: new URL("https://scholarbase.app"),
  title: {
    default: "ScholarBase - The Academic Hub for Scholars & Researchers",
    template: "%s | ScholarBase",
  },
  description:
    "Connect with peers, publish research, find PhD supervisors, discover admissions, academic events, and job vacancies. ScholarBase is the open-source academic community platform.",
  keywords: [
    "academic",
    "research",
    "phd",
    "supervisor",
    "phd admissions",
    "research community",
    "scholar platform",
    "academic jobs",
    "research publications",
    "conference",
    "university",
  ],
  authors: [{ name: "ScholarBase Community" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "ScholarBase",
    title: "ScholarBase - The Academic Hub for Scholars & Researchers",
    description:
      "Connect with peers, publish your research, find PhD supervisors, and discover opportunities in academia.",
    url: "https://scholarbase.app",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ScholarBase - Academic Community Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ScholarBase - The Academic Hub",
    description:
      "Connect with peers, publish research, find supervisors and opportunities.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://scholarbase.app",
  },
  category: "Education",
  manifest: "/manifest.json",
  appleWebApp: {
    title: "ScholarBase",
    capable: true,
  },
  icons: [
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      url: "/logo.png",
    },
    {
      rel: "apple-touch-icon",
      sizes: "180x180",
      url: "/logo.png",
    },
  ],
  robots: isDev
    ? {
        index: false,
        follow: false,
      }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-video-preview": -1,
          "max-snippet": -1,
        },
      },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  let isAdmin = false;
  let isFrozen = false;
  let unreadMessages = 0;
  let unreadNotifications = 0;
  let avatarUrl: string | null = null;

  if (user) {
    await ensureUserProfile(user);
    const [dbUser, messageCount, notificationCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { isAdmin: true, avatarUrl: true, isFrozen: true },
      }),
      getUnreadMessageCount(user.id),
      prisma.notification.count({
        where: { recipientId: user.id, readAt: null },
      }),
    ]);

    isAdmin = dbUser?.isAdmin ?? false;
    isFrozen = dbUser?.isFrozen ?? false;
    unreadMessages = messageCount;
    unreadNotifications = notificationCount;
    avatarUrl = dbUser?.avatarUrl ?? null;
  }

  const sidebarUser = user
    ? { id: user.id, email: user.email, isAdmin, unreadMessages, avatarUrl }
    : null;

  const cookieStore = await cookies();
  const isSidebarCollapsed =
    cookieStore.get("sb-main-sidebar-collapsed")?.value === "true";
  const themeCookie = cookieStore.get("sb-theme")?.value;
  const isDark = themeCookie !== "light";

  return (
    <html
      lang="en"
      className={isDark ? "dark" : ""}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <NextTopLoader showSpinner={false} />
        <AppProviders isFrozen={isFrozen}>
          <div className="flex min-h-screen">
            <Sidebar user={sidebarUser} defaultCollapsed={isSidebarCollapsed} />

            <div className="flex min-w-0 flex-1 flex-col">
              {isFrozen && (
                <div
                  role="alert"
                  className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                >
                  <span aria-hidden>❄</span>
                  Your account is frozen. You can still browse, but posting,
                  commenting, voting, reporting and other interactions are
                  disabled until a moderator reviews your account.
                </div>
              )}

              <Navbar user={user} unreadCount={unreadNotifications} />

              <main className="sb-shell flex-1 grow py-8 md:py-10">
                {children}
              </main>

              <Footer />
            </div>
          </div>
        </AppProviders>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
