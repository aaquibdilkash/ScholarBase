import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/actions";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="border-b border-slate-200/60 bg-white sticky top-0 z-10">
      {/* Changed max-w-5xl to w-full and px-8 to perfectly align with your main content padding */}
      <div className="w-full px-8 h-16 flex items-center justify-between">
        
        {/* Left Side: Empty or Breadcrumbs (since Logo is in Sidebar) 
            I left the logo here just in case you need it for mobile later, 
            but in a desktop view, you might want to hide it using 'md:hidden' 
        */}
        <div className="font-semibold text-slate-800">
          {/* You can leave this blank or add page context later */}
        </div>

        {/* Right Side: Auth State */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-5">
              <span className="text-sm font-medium text-slate-600 truncate max-w-[200px]">
                {user.email}
              </span>
              <form action={signOut}>
                <button className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
                  Sign Out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200"
            >
              Log In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}