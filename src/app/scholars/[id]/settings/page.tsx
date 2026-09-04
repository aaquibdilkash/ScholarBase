import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";
export const metadata: Metadata = buildNoindexMetadata("Account Settings - ScholarBase");
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";
import Link from "next/link";
import EditProfileForm from "@/components/profile/EditProfileForm";

export default async function ScholarSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (user.id !== id) {
    redirect(`/scholars/${user.id}/settings`);
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href={`/scholars/${id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Profile
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          Account Settings
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Manage your profile and account security.
        </p>
      </div>

      <div className="mb-8 space-y-6">
        <div className="sb-surface-strong p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mx-1">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Profile Information</h2>
              <p className="my-1 text-sm text-slate-500 dark:text-slate-400">
                Update your name, handle, bio, avatar, and profile links.
              </p>
            </div>
          </div>
          <EditProfileForm user={profile} />
        </div>
        <div className="sb-surface-strong p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Security</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Manage your password and account access.
              </p>
            </div>
            <Link
              href="/auth/update-password"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-400/60 dark:hover:text-blue-200"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Update Password
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}