/**
 * @vitest-environment jsdom
 *
 * Regression: the "Select at least one ScholarBase author" error was rendered
 * after the whole linked-people block, so it appeared under the Journal field
 * and made scholars think the journal selection was wrong. It also showed
 * before any submit attempt. The error now belongs to the Authors field and
 * only appears once the scholar tries to submit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import PublicationForm from "@/components/publications/PublicationForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
}));

const submit = vi.fn();
vi.mock("@/hooks/useFormSubmit", () => ({
  useFormSubmit: () => ({ submitting: false, submit }),
}));

vi.mock("@/app/actions/publications", () => ({
  createPublication: vi.fn(),
  updatePublication: vi.fn(),
}));
vi.mock("@/app/actions/journals", () => ({
  searchJournalsForPicker: vi.fn(async () => []),
}));
vi.mock("@/app/actions/scholars", () => ({
  searchScholarsForPicker: vi.fn(async () => []),
}));
vi.mock("@/utils/cacheMutation", () => ({ upsertToList: vi.fn() }));
vi.mock("@/components/ui/Editor", () => ({ Editor: () => null }));
vi.mock("@/components/ui/CautionNote", () => ({ CautionNote: () => null }));
vi.mock("@/components/ui/InfoTooltip", () => ({ InfoTooltip: () => null }));
vi.mock("@/components/ui/FormCancelButton", () => ({
  FormCancelButton: () => null,
}));
vi.mock("@/components/publications/KeywordChipsInput", () => ({
  KeywordChipsInput: () => null,
}));
vi.mock("@/components/interactions/ScholarSuggestionDropdown", () => ({
  ScholarSuggestionDropdown: () => null,
}));
vi.mock("@/components/interactions/ShareButton", () => ({
  ShareButton: () => null,
}));
vi.mock("@/components/ui/SubmitBtnWithAuth", async () => {
  const React = await import("react");
  return {
    SubmitBtnWithAuth: ({
      children,
      disabled,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
    }) => React.createElement("button", { type: "submit", disabled }, children),
  };
});

const AUTHOR_ERROR = "Select at least one ScholarBase author before submitting.";
const ABSTRACT_ERROR = "Abstract is required.";
const JOURNAL_LABEL = "Journal / Conference / Book";

describe("PublicationForm validation errors", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    submit.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("waits for a submit attempt and renders the error under Authors, not Journal", async () => {
    await act(async () => {
      root.render(<PublicationForm mode="create" />);
    });

    expect(container.textContent).not.toContain(AUTHOR_ERROR);

    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(AUTHOR_ERROR);
    expect(submit).not.toHaveBeenCalled();

    // The error must come before the Journal section in document order.
    const text = container.textContent ?? "";
    expect(text.indexOf(AUTHOR_ERROR)).toBeLessThan(
      text.indexOf(JOURNAL_LABEL),
    );
  });

  it("reports a missing abstract under the Abstract field", async () => {
    await act(async () => {
      root.render(<PublicationForm mode="create" />);
    });

    expect(container.textContent).not.toContain(ABSTRACT_ERROR);

    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain(ABSTRACT_ERROR);
    expect(text.indexOf(ABSTRACT_ERROR)).toBeGreaterThan(
      text.indexOf("Abstract / Description"),
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps Add Publication clickable so the missing field can be reported", async () => {
    await act(async () => {
      root.render(<PublicationForm mode="create" />);
    });

    const button = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
