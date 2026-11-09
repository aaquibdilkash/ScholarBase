/**
 * @vitest-environment jsdom
 *
 * The importer must explain its required columns before an upload, let the
 * admin pick a worksheet in a multi-tab workbook, and keep parse failures
 * inline so "no header row" stays on screen while they fix the file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OutreachImport } from "@/components/admin/OutreachImport";
import { ToastProvider } from "@/components/ui/Toast";
import type { OutreachImportRow } from "@/lib/outreach/import";
import { previewOutreachImport } from "@/app/actions/outreach";

vi.mock("@/app/actions/outreach", () => ({
  previewOutreachImport: vi.fn(),
  importOutreachContacts: vi.fn(),
}));

const previewMock = vi.mocked(previewOutreachImport);

const importRow = (email: string): OutreachImportRow => ({
  row: 2,
  name: "Jane",
  email,
  institution: "",
  role: "",
  source: "",
  notes: "",
});

describe("OutreachImport modal", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    previewMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient();
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    queryClient.clear();
  });

  const openModal = () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <OutreachImport />
          </ToastProvider>
        </QueryClientProvider>,
      );
    });

    const trigger = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Import CSV / Excel"),
    );
    if (!trigger) throw new Error("Import button not rendered");

    act(() => trigger.click());
  };

  const chooseFile = async (file: File) => {
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("File input not rendered");

    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  it("lists the required and optional columns before a file is chosen", () => {
    openModal();

    const text = container.textContent ?? "";
    expect(text).toContain("Columns — a header row is required");
    expect(text).toContain("Email Address");
    expect(text).toContain("Full Name");
    expect(text).toContain("jane@university.edu,Jane Doe");
    expect(text).toContain("is required");
    expect(text).toContain("skipped");
  });

  it("lets the admin choose a worksheet and re-reads it", async () => {
    const file = new File(["workbook"], "contacts.xlsx");

    previewMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          fileName: "contacts.xlsx",
          sheets: ["October", "November"],
          sheetName: "October",
          rows: [importRow("jane@university.edu")],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          fileName: "contacts.xlsx",
          sheets: ["October", "November"],
          sheetName: "November",
          rows: [importRow("bob@university.edu")],
        },
      });

    openModal();
    await chooseFile(file);

    const select = container.querySelector("#outreach-import-sheet");
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("Sheet picker not rendered");
    }
    expect(select.value).toBe("October");
    expect(container.textContent).toContain("jane@university.edu");

    await act(async () => {
      select.value = "November";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const [formData] = previewMock.mock.calls[1]!;
    expect((formData as FormData).get("sheet")).toBe("November");
    expect(container.textContent).toContain("bob@university.edu");
  });

  it("shows a parse failure inline and keeps the chosen file", async () => {
    previewMock.mockResolvedValueOnce({
      success: false,
      error: "No header row found. Add a header row with at least an Email column.",
    });

    openModal();
    await chooseFile(new File(["Name,Phone\nJane,123"], "contacts.csv"));

    const text = container.textContent ?? "";
    expect(text).toContain("No header row found");
    expect(text).toContain("contacts.csv");
  });
});
