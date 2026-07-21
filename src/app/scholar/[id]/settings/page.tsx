import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
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
    redirect(`/scholar/${user.id}/settings`);
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-5xl py-6 px-4">
      <Link
        href={`/scholar/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-6"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Profile
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Profile
        </h1>
        <p className="mt-2 text-slate-600">
          Update your academic information and handle.
        </p>
      </div>

      <EditProfileForm user={profile} />
    </main>
  );
}
