import type { AdminSection } from "@/lib/adminConfig";

interface AdminStatsCardsProps {
  sections: AdminSection[];
  activeSection: string;
  onSelect: (id: string) => void;
  getCount: (id: string) => number;
}

/** Top grid of section count cards. Clicking a card switches the active tab
 *  (mirrors the sidebar). */
export function AdminStatsCards({
  sections,
  activeSection,
  onSelect,
  getCount,
}: AdminStatsCardsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onSelect(section.id)}
          className={`rounded-xl border p-4 text-left transition ${
            activeSection === section.id
              ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {section.title}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {getCount(section.id)}
          </p>
        </button>
      ))}
    </div>
  );
}