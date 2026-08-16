import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Update Password - ScholarBase");
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="sb-surface w-full max-w-md space-y-6 p-8 md:p-10">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            Reset Password
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Set a New Password
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Whether you forgot your password or are setting one for the first
            time, enter your new password below.
          </p>
        </div>

        <UpdatePasswordForm />
      </div>
    </main>
  );
}
