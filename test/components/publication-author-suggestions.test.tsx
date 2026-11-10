/**
 * @vitest-environment jsdom
 *
 * Regression: author suggestions showed an "Invite <name> to ScholarBase"
 * action next to every result, even though every result comes from
 * `searchScholarsForPicker` and is therefore already on ScholarBase. The
 * standalone invite link stays available for co-authors who are not found.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PublicationLinkedPeopleFields } from "@/components/publications/PublicationLinkedPeopleFields";

const SCHOLAR = {
  id: "user-10",
  name: "10 Kahksha Dilish",
  handle: "10_kahksha_dilish",
  avatarUrl: null,
};

vi.mock("@/app/actions/scholars", () => ({
  searchScholarsForPicker: vi.fn(async () => [SCHOLAR]),
}));
vi.mock("@/app/actions/journals", () => ({
  searchJournalsForPicker: vi.fn(async () => []),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/interactions/ShareButton", () => ({
  ShareButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

describe("PublicationLinkedPeopleFields author suggestions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    queryClient.clear();
    vi.useRealTimers();
  });

  const render = (props: React.ComponentProps<typeof PublicationLinkedPeopleFields>) =>
    act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <PublicationLinkedPeopleFields {...props} />
        </QueryClientProvider>,
      );
    });

  it("does not offer to invite a scholar who is already on ScholarBase", async () => {
    await render({
      authorNames: [],
      journal: "",
      onAuthorNamesChange: vi.fn(),
      onJournalChange: vi.fn(),
      authorIds: [],
      onAuthorIdsChange: vi.fn(),
      journalId: "",
      onJournalIdChange: vi.fn(),
    });

    const input = container.querySelector<HTMLInputElement>(
      "#publication-authors",
    )!;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setValue.call(input, "kahk");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await vi.waitFor(() =>
        expect(container.textContent).toContain("10 Kahksha Dilish"),
      );
    });
    expect(container.textContent).not.toContain(
      "Invite 10 Kahksha Dilish to ScholarBase",
    );
  });

  it("removes only the author whose chip was clicked", async () => {
    const onAuthorIdsChange = vi.fn();
    const onAuthorNamesChange = vi.fn();

    await render({
      authorNames: ["10 Kahksha Dilish", "Second Scholar"],
      journal: "",
      onAuthorNamesChange,
      onJournalChange: vi.fn(),
      authorIds: ["user-10", "user-11"],
      onAuthorIdsChange,
      journalId: "",
      onJournalIdChange: vi.fn(),
    });

    const remove = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove 10 Kahksha Dilish"]',
    )!;
    await act(async () => {
      remove.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onAuthorIdsChange).toHaveBeenCalledWith(["user-11"]);
    expect(onAuthorNamesChange).toHaveBeenCalledWith(["Second Scholar"]);
  });
});
