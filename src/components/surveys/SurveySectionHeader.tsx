/**
 * Section header shown above a page of respondent questions.
 * Shared by the live response form and the builder preview so the builder
 * always shows the section rhythm the respondent will actually see.
 */
export function SurveySectionHeader({
  title,
  sectionIndex,
  sectionCount,
}: {
  title: string;
  sectionIndex: number | null;
  sectionCount: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        {sectionIndex
          ? `Section ${sectionIndex} of ${sectionCount}`
          : "Section"}
      </p>
      <h3 className="mt-1 break-words text-base font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
    </div>
  );
}
