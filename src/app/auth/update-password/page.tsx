import type { Metadata } from "next";

import { buildNoindexMetadata } from "@/lib/seo";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export const metadata: Metadata = buildNoindexMetadata(
  "Update Password - ScholarBase",
);

export default function UpdatePasswordPage() {
  return (
    <CreateOrEditPageShell
      title="Set a New Password"
      description="Whether you forgot your password or are setting one for the first time, enter your new password below."
      backHref="/login"
      backLabel="← Back to sign in"
      maxWidth="sm"
      className="flex min-h-[calc(100dvh-8rem)] flex-col justify-center"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="sb-surface w-full space-y-6 p-8 md:p-10">
          <div className="text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
              Reset Password
            </div>
          </div>

          <UpdatePasswordForm />
        </div>
      </div>
    </CreateOrEditPageShell>
  );
}
