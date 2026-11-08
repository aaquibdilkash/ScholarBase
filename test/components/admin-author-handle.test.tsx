/**
 * @vitest-environment jsdom
 *
 * Regression: the admin Feed Management "Author" column rendered the mutable
 * display name, so two scholars named "Kahkasha" were indistinguishable. The
 * column must show the unique handle (matching the rest of the app) and only
 * fall back to the name when a handle is missing.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildContentColumns,
  type AdminColumnsCtx,
} from "@/components/admin/columns";
import type { AdminContentItem } from "@/types/admin";

const ctx: AdminColumnsCtx = {
  activeTab: "feed",
  view: "posts",
  isPending: false,
  onApprove: () => {},
  onReject: () => {},
  onAppealMutated: () => {},
};

function renderAuthor(item: AdminContentItem): string {
  const column = buildContentColumns(ctx).find((col) => col.key === "author");
  if (!column) throw new Error("author column missing");
  return renderToStaticMarkup(<>{column.render(item)}</>);
}

describe("admin author column", () => {
  it("shows the unique handle instead of the display name", () => {
    const html = renderAuthor({
      id: "p-1",
      author: {
        id: "u-1",
        name: "Kahkasha",
        handle: "kahkasha069",
        email: "kahkasha@university.edu",
      },
    });

    expect(html).toContain("@kahkasha069");
    expect(html).not.toContain(">Kahkasha<");
  });

  it("falls back to the name when a handle is unavailable", () => {
    const html = renderAuthor({
      id: "p-2",
      author: {
        id: "u-2",
        name: "Legacy Scholar",
        handle: null,
        email: "legacy@university.edu",
      },
    });

    expect(html).toContain("Legacy Scholar");
  });
});
