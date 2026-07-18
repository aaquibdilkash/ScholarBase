"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function FilterableOpportunityList<T>({
  items,
  placeholder,
  filterFn,
  renderItem,
  initialQuery = "",
  queryParamKey,
  basePath,
  enableClientFiltering = false,
  inputOnly = false,
}: {
  items: T[];
  placeholder: string;
  filterFn: (item: T, query: string) => boolean;
  renderItem: (item: T) => React.ReactNode;
  initialQuery?: string;
  queryParamKey?: string;
  basePath?: string;
  enableClientFiltering?: boolean;
  inputOnly?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const filteredItems = useMemo(() => {
    if (!enableClientFiltering) return items;
    return items.filter((item) => filterFn(item, query));
  }, [enableClientFiltering, filterFn, items, query]);

  return (
    <div>
      <div className="mb-8">
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;

            if (!queryParamKey) return;

            e.preventDefault();
            const trimmed = query.trim();
            const params = new URLSearchParams();
            if (trimmed) params.set(queryParamKey, trimmed);

            router.push(
              `${basePath ?? window.location.pathname}` +
                (params.toString().length > 0 ? `?${params.toString()}` : ""),
            );
          }}
          className="sb-input"
        />
      </div>

      {inputOnly ? null : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => renderItem(item))}
        </div>
      )}
    </div>
  );
}
