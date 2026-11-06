/**
 * @vitest-environment jsdom
 *
 * The Add Outreach Contact form keeps a draft, matching every other content
 * form. A half-typed contact should survive a refresh, then be cleared once the
 * contact is actually created.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OutreachForm } from "@/components/admin/OutreachForm";
import { MAX_OUTREACH_NAME } from "@/lib/constants";

const createOutreachContact = vi.fn(async () => ({
  success: true as const,
  data: { id: "c-1" },
}));

vi.mock("@/app/actions/outreach", () => ({
  createOutreachContact: (...args: unknown[]) =>
    (createOutreachContact as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const DRAFT_KEY = "admin-outreach-contact-draft-v1";

describe("OutreachForm draft", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    localStorage.clear();
    createOutreachContact.mockClear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  const draw = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OutreachForm />
        </QueryClientProvider>,
      );
    });
  };

  const open = async () => {
    const trigger = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add Contact",
    );
    expect(trigger).toBeTruthy();
    await act(async () => {
      trigger?.click();
    });
  };

  const type = async (placeholder: string, value: string) => {
    const input = container.querySelector<HTMLInputElement>(
      `input[placeholder="${placeholder}"]`,
    );
    expect(input, `input "${placeholder}"`).toBeTruthy();
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setValue.call(input!, value);
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("shows tooltips and live character counts for each field", async () => {
    await draw();
    await open();

    // Name, email, institution, role, source, notes.
    expect(
      container.querySelectorAll('button[aria-label="More information"]'),
    ).toHaveLength(6);
    expect(container.textContent).toContain(`0/${MAX_OUTREACH_NAME} characters`);

    await type("Jane Scholar", "Ada");

    expect(container.textContent).toContain(`3/${MAX_OUTREACH_NAME} characters`);
    expect(
      container.querySelector<HTMLInputElement>(
        'input[placeholder="Jane Scholar"]',
      )!.maxLength,
    ).toBe(MAX_OUTREACH_NAME);
  });

  it("restores a half-typed contact after a remount", async () => {
    await draw();
    await open();
    await type("Jane Scholar", "Ada Lovelace");
    await type("jane@university.edu", "ada@example.edu");

    expect(localStorage.getItem(DRAFT_KEY)).toContain("Ada Lovelace");

    act(() => root.unmount());
    root = createRoot(container);
    await draw();
    await open();

    expect(
      container.querySelector<HTMLInputElement>(
        'input[placeholder="Jane Scholar"]',
      )!.value,
    ).toBe("Ada Lovelace");
    expect(
      container.querySelector<HTMLInputElement>(
        'input[placeholder="jane@university.edu"]',
      )!.value,
    ).toBe("ada@example.edu");
  });

  it("clears the draft once the contact is created", async () => {
    await draw();
    await open();
    await type("Jane Scholar", "Ada Lovelace");
    await type("jane@university.edu", "ada@example.edu");

    const form = container.querySelector("form")!;
    await act(async () => {
      form.requestSubmit();
    });

    expect(createOutreachContact).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ada Lovelace",
        email: "ada@example.edu",
      }),
    );
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
