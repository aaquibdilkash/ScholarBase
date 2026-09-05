import type { AdminSection } from "@/lib/adminConfig";

interface AdminSidebarProps {
  sections: AdminSection[];
  activeSection: string;
  onSelect: (id: string) => void;
  /** Resolves the live count badge for a section (from the stats cache). */
  getCount: (id: string) => number;
}

/** Left "Content Sections" navigation rail for the admin dashboard. */
export function AdminSidebar({
  sections,
  activeSection,
  onSelect,
  getCount,
}: AdminSidebarProps) {
  return (
    <aside className="lg:w-64 shrink-0">
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Content Sections
          </h2>
        </div>
        <nav className="p-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition mb-1 ${
                activeSection === section.id
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <span className="flex items-center justify-between">
                {section.title}
                <span className="text-xs font-semibold text-slate-400">
                  {getCount(section.id)}
                </span>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}