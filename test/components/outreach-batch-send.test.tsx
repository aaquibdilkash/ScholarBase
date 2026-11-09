/**
 * @vitest-environment jsdom
 *
 * Bulk selection on the admin outreach list.
 *
 * Sending is irreversible and reaches real recipients, so a batch must only
 * ever contain rows whose status matches the mode: Send is pending-only,
 * Resend is already-contacted only, and unsubscribed rows are never selectable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OutreachPanel } from "@/components/admin/OutreachPanel";
import { ToastProvider } from "@/components/ui/Toast";
import type { OutreachContactItem } from "@/app/actions/outreach";

const listOutreachContacts = vi.fn();
const sendOutreachBatch = vi.fn(async () => ({
  success: true,
  data: { sent: 1, skipped: 0, failed: 0, results: [] },
}));

vi.mock("@/app/actions/outreach", () => ({
  listOutreachContacts: (...args: unknown[]) =>
    (listOutreachContacts as (...a: unknown[]) => unknown)(...args),
  sendOutreachBatch: (...args: unknown[]) =>
    (sendOutreachBatch as (...a: unknown[]) => unknown)(...args),
  // Rendered by the panel but never exercised in this test.
  createOutreachContact: vi.fn(),
  previewOutreachImport: vi.fn(),
  importOutreachContacts: vi.fn(),
  sendOutreachEmail: vi.fn(),
  markOutreachStatus: vi.fn(),
  resubscribeOutreachContact: vi.fn(),
  deleteOutreachContact: vi.fn(),
  updateOutreachContact: vi.fn(),
}));

const contact = (
  overrides: Partial<OutreachContactItem> = {},
): OutreachContactItem => ({
  id: "c-1",
  name: "Alice Pending",
  email: "alice@university.edu",
  institution: null,
  role: null,
  source: null,
  notes: null,
  status: "PENDING",
  sendCount: 0,
  outreachedAt: null,
  emailSentAt: null,
  createdAt: new Date("2026-01-01"),
  createdByName: null,
  linkedUserId: null,
  ...overrides,
});

const items: OutreachContactItem[] = [
  contact(),
  contact({
    id: "c-2",
    name: "Bob Contacted",
    email: "bob@university.edu",
    status: "OUTREACHED",
    sendCount: 1,
    outreachedAt: new Date("2026-02-01"),
    emailSentAt: new Date("2026-02-01"),
  }),
  contact({
    id: "c-3",
    name: "Cara Opted Out",
    email: "cara@university.edu",
    status: "UNSUBSCRIBED",
  }),
];

describe("OutreachPanel bulk send", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    sendOutreachBatch.mockClear();
    listOutreachContacts.mockResolvedValue({
      items,
      total: items.length,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  const draw = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <OutreachPanel />
          </ToastProvider>
        </QueryClientProvider>,
      );
    });

    // The list is fetched by React Query on mount, and its notification is
    // batched on a timer. Flush one turn at a time so each render commits.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (
        document.body.querySelector('input[aria-label="Select Alice Pending"]')
      ) {
        return;
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    throw new Error("Outreach rows never rendered");
  };

  const findButton = (label: string) => {
    const button = [...document.body.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    expect(button).toBeTruthy();
    return button as HTMLButtonElement;
  };

  it("selects only pending contacts and sends without a resend flag", async () => {
    await draw();

    const selectAll = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Select all pending contacts on this page"]',
    );
    expect(selectAll).toBeTruthy();

    await act(async () => {
      selectAll?.click();
    });

    const rowCheckboxes = [
      ...document.body.querySelectorAll<HTMLInputElement>(
        'input[aria-label^="Select "]',
      ),
    ];
    const byLabel = (label: string) =>
      rowCheckboxes.find((box) => box.getAttribute("aria-label") === label);

    expect(byLabel("Select Alice Pending")?.checked).toBe(true);
    expect(byLabel("Select Bob Contacted")?.disabled).toBe(true);
    expect(byLabel("Select Cara Opted Out")?.disabled).toBe(true);

    await act(async () => {
      findButton("Send selected").click();
    });

    await act(async () => {
      findButton("Send emails").click();
    });

    expect(sendOutreachBatch).toHaveBeenCalledWith({
      contactIds: ["c-1"],
      resend: false,
    });
  });

  it("selects already-contacted contacts in resend mode", async () => {
    await draw();

    await act(async () => {
      findButton("Resend").click();
    });

    const selectAll = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Select all contacted contacts on this page"]',
    );
    expect(selectAll).toBeTruthy();

    await act(async () => {
      selectAll?.click();
    });

    await act(async () => {
      findButton("Resend selected").click();
    });

    await act(async () => {
      findButton("Resend emails").click();
    });

    expect(sendOutreachBatch).toHaveBeenCalledWith({
      contactIds: ["c-2"],
      resend: true,
    });
  });
});
