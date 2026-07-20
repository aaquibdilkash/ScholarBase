import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import EditProfileForm from "@/components/profile/EditProfileForm";

export default async function ScholarSettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
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
