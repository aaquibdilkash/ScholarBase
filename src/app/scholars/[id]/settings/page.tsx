import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { buildNoindexMetadata } from "@/lib/seo";
import prisma from "@/lib/db";
import { InstitutionVerificationForm } from "@/components/auth/InstitutionVerificationForm";
import { UpdateEmailForm } from "@/components/auth/UpdateEmailForm";
import { DeleteAccountForm } from "@/components/auth/DeleteAccountForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import EditProfileForm from "@/components/profile/EditProfileForm";

export const metadata: Metadata = buildNoindexMetadata(
  "Account Settings - ScholarBase",
);

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
    <CreateOrEditPageShell
      title="Account Settings"
      description="Manage your profile and account security."
      backHref={`/scholars/${id}`}
      backLabel="← Back to Profile"
      maxWidth="lg"
    >
      <div className="mb-8 space-y-6">
        <section className="sb-surface-strong rounded-2xl p-4 sm:p-6">
          <div className="mb-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Profile Information
            </h2>
            <p className="my-1 text-sm text-slate-500 dark:text-slate-400">
              Update your name, handle, bio, avatar, and profile links.
            </p>
          </div>
          <EditProfileForm user={profile} />
        </section>

        <section className="sb-surface-strong rounded-2xl p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Security
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Manage your password, email, and institutional verification.
              </p>
            </div>
            <Link href="/auth/update-password" className="sb-button-primary gap-2">
              <Lock className="h-4 w-4" aria-hidden="true" />
              Update Password
            </Link>
          </div>
          <UpdateEmailForm currentEmail={profile.email} />
          <InstitutionVerificationForm
            institutionEmail={profile.institutionEmail}
            institutionVerifiedAt={profile.institutionVerifiedAt}
            pendingInstitutionEmail={profile.pendingInstitutionEmail}
          />
          <DeleteAccountForm />
        </section>
      </div>
    </CreateOrEditPageShell>
  );
}
