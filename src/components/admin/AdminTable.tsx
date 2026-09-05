import type { ReactNode } from "react";

/**
 * A single column definition. The `<thead>` and every `<tbody>` row are both
 * rendered from the SAME array of columns, so the header/cell counts can never
 * drift apart — the exact "conditional header / column" mess this was built to
 * replace (RULE-guidance: keep the table purely presentational).
 */
export interface AdminColumn<T> {
  /** Stable id used as the React key for header + cells. */
  key: string;
  /** `<th>` content — a label or a filter control. */
  header: ReactNode;
  /** `<td>` content for a given row. */
  render: (item: T) => ReactNode;
  /** Extra classes merged onto the base `px-4 py-3` cell padding. */
  cellClassName?: string;
}

interface AdminTableProps<T> {
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (item: T) => string;
  /** Shown in a full-width cell (colSpan derived from `columns.length`, never
   *  hardcoded) when `rows` is empty. */
  emptyMessage?: ReactNode;
}

/** Generic, column-definition-driven data table. Purely presentational — zero
 *  data fetching, so it's safe anywhere (the parent owns all polling / React
 *  Query / optimistic state). */
export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No content found",
}: AdminTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((item) => (
              <tr
                key={rowKey(item)}
                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${col.cellClassName ?? ""}`.trim()}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}