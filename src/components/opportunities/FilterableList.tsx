"use client";

import { useState } from "react";

export function FilterableOpportunityList<T>({
  items,
  placeholder,
  filterFn,
  renderItem,
}: {
  items: T[];
  placeholder: string;
  filterFn: (item: T, query: string) => boolean;
  renderItem: (item: T) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");

  const filteredItems = items.filter((item) => filterFn(item, query));

  return (
    <div>
      <div className="mb-8">
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sb-input"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => renderItem(item))}
      </div>
    </div>
  );
}
