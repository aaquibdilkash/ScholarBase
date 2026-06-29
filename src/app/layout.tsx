import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* 1. Added the font variables to the body 
        2. Set antialiased for crisp text
        3. Enforced a soft, premium light-gray background (bg-slate-50) 
      */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-slate-50 text-slate-900 min-h-screen`}
      >
        <div className="flex min-h-screen">
          <Sidebar />

          <div className="flex-1 flex flex-col min-w-0">
            <Navbar />

            <main className="p-8 flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
