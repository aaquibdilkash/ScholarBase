import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { getCurrentUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/users";

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

  if (user) {
    await ensureUserProfile(user);
  }

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-slate-900 min-h-screen`}
      >
        <div className="flex min-h-screen">
          <Sidebar user={user} />

          <div className="flex-1 flex flex-col min-w-0">
            <Navbar />

            <main className="sb-shell flex-1 py-8 md:py-10">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
