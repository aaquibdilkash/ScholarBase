import {
  getAdminStats,
  getAdminContent,
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
    
  const [stats, initialContent] = await Promise.all([
    getAdminStats(),
    getAdminContent("feed"),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sb-shell py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Manage content, moderate posts, and control user access
          </p>
        </div>
        <AdminDashboard initialStats={stats} initialContent={initialContent} />
      </div>
    </main>
  );
}
