import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Admin - ScholarBase");
import {
  getAdminStats,
  getAdminInstitutionDomainRequests,
} from "@/app/actions/admin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { createClient } from "@/utils/supabase/server";
import { isUserAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";


export default async function AdminPage() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !(await isUserAdmin(user.id))) {
      redirect("/");
    }
    
  const [stats, initialInstitutionDomainRequests] = await Promise.all([
    getAdminStats(),
    getAdminInstitutionDomainRequests(),
  ]);

  return (
    <main className="-mx-2 -mt-2 min-h-screen bg-slate-50 dark:bg-slate-950 sm:mx-0 sm:mt-0">
      <div className="w-full px-2 py-3 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 px-4 sm:mb-8 sm:px-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Admin Dashboard
          </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Manage content, moderate posts, and control user access
          </p>
        </div>
        <AdminDashboard
          initialStats={stats}
          initialInstitutionDomainRequests={initialInstitutionDomainRequests}
        />
      </div>
    </main>
  );
}
