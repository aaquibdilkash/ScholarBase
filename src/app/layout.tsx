import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import NextTopLoader from "nextjs-toploader";
import { ensureUserProfile } from "@/lib/users";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { AppProviders } from "@/components/interactions/AppProviders";
import { getUnreadMessageCount } from "@/app/actions/messages";

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
  robots: {
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
  alternates: {
    canonical: "https://scholarbase.app",
  },
  category: "Education",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  let isAdmin = false;
  let unreadMessages = 0;
  let avatarUrl: string | null = null;
  if (user) {
    await ensureUserProfile(user);
    const [dbUser, messageCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { isAdmin: true, avatarUrl: true },
      }),
      getUnreadMessageCount(user.id),
    ]);
    isAdmin = dbUser?.isAdmin ?? false;
    unreadMessages = messageCount;
    avatarUrl = dbUser?.avatarUrl ?? null;
  }

  const sidebarUser = user ? { id: user.id, email: user.email, isAdmin, unreadMessages, avatarUrl } : null;

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
      </head>
      <body
        className="min-h-screen bg-background font-sans antialiased text-foreground"
      >
        <NextTopLoader showSpinner={false} />
        <AppProviders>
          <div className="flex min-h-screen">
            <Sidebar user={sidebarUser} />

            <div className="flex min-w-0 flex-1 flex-col">
              <Navbar />

              <main className="sb-shell flex-1 grow py-8 md:py-10">{children}</main>

              <Footer />
            </div>
          </div>
        </AppProviders>
        <SpeedInsights />
        <Analytics />
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var theme=localStorage.getItem('sb-theme');var dark=theme==='dark';document.documentElement.classList.toggle('dark',dark);document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';}catch(e){}})();`}
        </Script>
      </body>
    </html>
  );
}
