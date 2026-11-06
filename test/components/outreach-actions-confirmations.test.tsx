/**
 * @vitest-environment jsdom
 *
 * Row actions on the admin outreach list.
 *
 * Resend / subscribe / unsubscribe / delete are irreversible or reach a real
 * recipient, so each one must go through the shared ConfirmationModal — the same
 * gate delete already used. These tests click through the kebab menu and assert
 * the mutation only fires after the modal is confirmed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OutreachActionsDropdown } from "@/components/admin/OutreachActionsDropdown";
import { ToastProvider } from "@/components/ui/Toast";
import { outreachQueryKey } from "@/utils/outreach-cache";
import type { OutreachContactItem } from "@/app/actions/outreach";

const sendOutreachEmail = vi.fn(async () => ({ success: true, data: { id: "c-1" } }));
const markOutreachStatus = vi.fn(async () => ({
  success: true,
  data: { id: "c-1", status: "UNSUBSCRIBED" },
}));
const resubscribeOutreachContact = vi.fn(async () => ({
  success: true,
  data: { id: "c-1", status: "OUTREACHED" },
}));
const deleteOutreachContact = vi.fn(async () => ({
  success: true,
  data: { id: "c-1" },
}));

vi.mock("@/app/actions/outreach", () => ({
  sendOutreachEmail: (...args: unknown[]) =>
    (sendOutreachEmail as (...a: unknown[]) => unknown)(...args),
  markOutreachStatus: (...args: unknown[]) =>
    (markOutreachStatus as (...a: unknown[]) => unknown)(...args),
  resubscribeOutreachContact: (...args: unknown[]) =>
    (resubscribeOutreachContact as (...a: unknown[]) => unknown)(...args),
  deleteOutreachContact: (...args: unknown[]) =>
    (deleteOutreachContact as (...a: unknown[]) => unknown)(...args),
  updateOutreachContact: vi.fn(async () => ({
    success: true,
    data: { id: "c-1" },
  })),
}));

const contact = (
  overrides: Partial<OutreachContactItem> = {},
): OutreachContactItem => ({
  id: "c-1",
  name: "Jane Scholar",
  email: "jane@university.edu",
  institution: null,
  role: null,
  source: null,
  notes: null,
  status: "OUTREACHED",
  sendCount: 2,
  outreachedAt: new Date("2026-02-01"),
  emailSentAt: new Date("2026-02-01"),
  createdAt: new Date("2026-01-01"),
  createdByName: null,
  linkedUserId: null,
  ...overrides,
});

describe("OutreachActionsDropdown confirmations", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    sendOutreachEmail.mockClear();
    markOutreachStatus.mockClear();
    resubscribeOutreachContact.mockClear();
    deleteOutreachContact.mockClear();

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

  const draw = (item: OutreachContactItem = contact(), page = 1) =>
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <OutreachActionsDropdown contact={item} page={page} />
          </ToastProvider>
        </QueryClientProvider>,
      );
    });

  const openMenu = () =>
    act(() => {
      const trigger = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Jane Scholar"]',
      );
      expect(trigger).toBeTruthy();
      trigger?.click();
    });

  const button = (label: string) => {
    const match = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    expect(match, `button "${label}"`).toBeTruthy();
    return match as HTMLButtonElement;
  };

  const click = async (label: string) => {
    await act(async () => {
      button(label).click();
    });
  };

  it("asks before resending an email", async () => {
    draw();
    openMenu();

    await click("Resend email");

    expect(sendOutreachEmail).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Resend outreach email?");

    await click("Resend email");

    expect(sendOutreachEmail).toHaveBeenCalledWith({
      contactId: "c-1",
      resend: true,
    });
    expect(document.body.textContent).not.toContain("Resend outreach email?");
  });

  it("asks before marking a contact unsubscribed", async () => {
    draw();
    openMenu();

    await click("Mark unsubscribed");

    expect(markOutreachStatus).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Mark contact as unsubscribed?");

    await click("Mark unsubscribed");

    expect(markOutreachStatus).toHaveBeenCalledWith({
      contactId: "c-1",
      status: "UNSUBSCRIBED",
    });
  });

  it("asks before subscribing a contact again", async () => {
    draw(contact({ status: "UNSUBSCRIBED" }));
    openMenu();

    await click("Mark as subscribed");

    expect(resubscribeOutreachContact).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Mark contact as subscribed?");

    await click("Mark as subscribed");

    expect(resubscribeOutreachContact).toHaveBeenCalledWith({
      contactId: "c-1",
    });
  });

  it("keeps the delete confirmation", async () => {
    draw();
    openMenu();

    await click("Delete contact");

    expect(deleteOutreachContact).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Remove outreach contact?");

    await click("Delete contact");

    expect(deleteOutreachContact).toHaveBeenCalledWith({ contactId: "c-1" });
  });

  it("does nothing when the confirmation is cancelled", async () => {
    draw();
    openMenu();

    await click("Mark unsubscribed");
    await click("Cancel");

    expect(markOutreachStatus).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(
      "Mark contact as unsubscribed?",
    );
  });

  it("patches only the cache entry for its own page", async () => {
    const item = contact();
    queryClient.setQueryData(outreachQueryKey(2), { items: [item], total: 1 });
    queryClient.setQueryData(outreachQueryKey(1), { items: [], total: 1 });

    draw(item, 2);
    openMenu();

    await click("Mark unsubscribed");
    await click("Mark unsubscribed");

    const page2 = queryClient.getQueryData<{
      items: OutreachContactItem[];
      total: number;
    }>(outreachQueryKey(2));
    const page1 = queryClient.getQueryData<{
      items: OutreachContactItem[];
      total: number;
    }>(outreachQueryKey(1));

    expect(page2?.items[0].status).toBe("UNSUBSCRIBED");
    // Page 1 is a different list slice; it must not be touched by a row action.
    expect(page1?.items).toEqual([]);
  });
});
