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
import { EDIT_PAGE_TEXT } from "@/constants/seo";
import EditProfileForm from "@/components/profile/EditProfileForm";
import { DigestPreferenceForm } from "@/components/notifications/DigestPreferenceForm";
import { EnablePushButton } from "@/components/push/EnablePushButton";
import { InstallAppButton, InstallStatusNote } from "@/components/pwa/InstallAppButton";
import {
  SettingsTabs,
  resolveSettingsTab,
} from "@/components/settings/SettingsTabs";
import type { DigestPreference } from "@prisma/client";

export const metadata: Metadata = buildNoindexMetadata(
  "Account Settings - ScholarBase",
);

export default async function ScholarSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const { tab } = (await searchParams) ?? {};
  const activeTab = resolveSettingsTab(tab);
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
      title={EDIT_PAGE_TEXT.settings.title}
      description={EDIT_PAGE_TEXT.settings.description}
      backHref={`/scholars/${id}`}
      backLabel="Back to Profile"
      maxWidth="lg"
    >
      <SettingsTabs active={activeTab} basePath={`/scholars/${id}/settings`} />

      {/* Only the active panel renders, so the other forms never mount. */}
      <div className="mt-6 space-y-6">
        {activeTab === "profile" ? (
          <section
            aria-label="Profile information"
            className="sb-surface-strong rounded-2xl p-4 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Profile Information
            </h2>
            <p className="my-1 text-sm text-slate-500 dark:text-slate-400">
              Update your name, handle, bio, avatar, and profile links.
            </p>
            <EditProfileForm user={profile} />
          </section>
        ) : null}

        {activeTab === "security" ? (
          <section
            aria-label="Security"
            className="sb-surface-strong space-y-1 rounded-2xl p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  Security
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Manage your password, email, and institutional verification.
                </p>
              </div>
              <Link
                prefetch={false}
                href="/auth/update-password"
                className="sb-button-primary gap-2"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                Update Password
              </Link>
            </div>
            <UpdateEmailForm currentEmail={profile.email} />
            <InstitutionVerificationForm
              institutionEmail={profile.institutionEmail}
              institutionVerifiedAt={profile.institutionVerifiedAt}
              pendingInstitutionEmail={profile.pendingInstitutionEmail}
              institutionVerificationExpiresAt={
                profile.institutionVerificationExpiresAt
              }
            />
            <DeleteAccountForm />
          </section>
        ) : null}

        {activeTab === "notifications" ? (
          <section
            aria-label="Notifications"
            className="sb-surface-strong rounded-2xl p-4 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Notifications
            </h2>
            <p className="my-1 text-sm text-slate-500 dark:text-slate-400">
              In-app notifications are always on. Choose whether you also get
              push alerts on this device, and whether you want your activity
              summarised by email.
            </p>

            {/* Push is device-scoped, not account-scoped: the subscription row
                is keyed on the browser endpoint, so this reflects *this* device
                only. Sign in on another device and it must be enabled there too.
                Reuses EnablePushButton so the navbar icon, /notifications, and
                this row read from one provider and cannot disagree. */}
            <div className="mt-4">
              <EnablePushButton variant="settings" />
            </div>

            {/* The digest cadence is opt-IN (see the P0-2 entry), so it has to
                be reachable from settings — the only other writer is the link
                inside a digest email, which a user on "Off" never receives. */}
            <DigestPreferenceForm
              current={profile.digestPreference as DigestPreference}
            />
          </section>
        ) : null}

        {activeTab === "app" ? (
          <section
            aria-label="App"
            className="sb-surface-strong rounded-2xl p-4 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              App
            </h2>
            <p className="my-1 text-sm text-slate-500 dark:text-slate-400">
              Install ScholarBase to open it like a normal app, launch it from
              your home screen or desktop, and let it load faster. Installing is
              per-device, and is separate from your notification settings — you
              can install without enabling alerts, or the reverse.
            </p>

            {/* Device-scoped, exactly like the push subscription above: it
                describes the browser this tab is open in, not the account, so it
                lives in its own panel rather than under Notifications. Renders
                nothing once installed, so there is no dead row here either. */}
            <div className="mt-4">
              <InstallAppButton variant="settings" />
              {/* The install row is hidden while the browser decides and once
                  the app is installed, so without this the panel would be a
                  blank box. Saying which state we are in beats an empty area. */}
              <InstallStatusNote />
            </div>
          </section>
        ) : null}
      </div>
    </CreateOrEditPageShell>
  );
}
