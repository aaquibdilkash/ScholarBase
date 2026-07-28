import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import NextTopLoader from "nextjs-toploader";
import { ensureUserProfile } from "@/lib/users";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { AppProviders } from "@/components/interactions/AppProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
    url: "https://scholarbase.vercel.app",
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
    canonical: "https://scholarbase.vercel.app",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  category: "Education",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  let isAdmin = false;
  if (user) {
    await ensureUserProfile(user);
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    });
    isAdmin = dbUser?.isAdmin ?? false;
  }

  const sidebarUser = user ? { id: user.id, email: user.email, isAdmin } : null;

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-slate-900 min-h-screen`}
      >
        <NextTopLoader showSpinner={false} />
        <AppProviders>
          <div className="flex min-h-screen">
            <Sidebar user={sidebarUser} />

            <div className="flex min-w-0 flex-1 flex-col">
              <Navbar />

              <main className="sb-shell flex-1 py-8 md:py-10">{children}</main>
            </div>
          </div>
        </AppProviders>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
