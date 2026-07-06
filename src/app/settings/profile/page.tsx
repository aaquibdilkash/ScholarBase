import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import EditProfileForm from "@/components/profile/EditProfileForm";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch their current profile from Prisma
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Edit Profile</h1>
        <p className="text-slate-500 mt-2">
          Update your academic information and handle.
        </p>
      </div>

      <EditProfileForm user={profile} />
    </main>
  );
}
