import type { Metadata } from "next";
import Link from "next/link";
import { buildNoindexMetadata } from "@/lib/seo";

type FlowType = "signup" | "email_change" | "unknown";

const FLOW_MESSAGES: Record<FlowType, { badge: string; title: string; description: string; href: string; label: string }> = {
  signup: {
    badge: "Account confirmed",
    title: "Your account is ready",
    description:
      "Your email has been verified successfully. You can now sign in and start using ScholarBase.",
    href: "/login",
    label: "Continue to sign in",
  },
  email_change: {
    badge: "Email updated",
    title: "Your email has been updated",
    description:
      "Your primary email address has been changed successfully. You may need to sign in again with your new email.",
    href: "/settings",
    label: "Go to settings",
  },
  unknown: {
    badge: "Confirmed",
    title: "Your email has been verified",
    description:
      "Your email has been verified successfully. You can now continue to ScholarBase.",
    href: "/",
    label: "Continue to ScholarBase",
  },
};

function getFlowType(type: string | null): FlowType {
  if (type === "signup") return "signup";
  if (type === "email_change") return "email_change";
  return "unknown";
}

export const metadata: Metadata = buildNoindexMetadata("Account Confirmed - ScholarBase");

export default async function EmailConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = await searchParams;
  const type = typeof resolved.type === "string" ? resolved.type : null;
  const flow = getFlowType(type);
  const messages = FLOW_MESSAGES[flow];

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <section className="sb-surface w-full max-w-md space-y-6 p-8 text-center md:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
          ✓
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
            {messages.badge}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {messages.title}
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            {messages.description}
          </p>
        </div>
        <Link prefetch={false} href={messages.href} className="sb-button-primary w-full">
          {messages.label}
        </Link>
      </section>
    </main>
  );
}
