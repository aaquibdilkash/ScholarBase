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
  title: "ScholarBase",
  description: "The academic hub for scholars and researchers.",
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

            <div className="flex-1 flex flex-col min-w-0">
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
