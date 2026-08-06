import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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
          Edit Profile
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Update your academic information and handle.
        </p>
      </div>

      <EditProfileForm user={profile} />
    </main>
  );
}