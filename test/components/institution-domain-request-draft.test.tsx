/**
 * @vitest-environment jsdom
 *
 * Regression: the institution domain request form had no draft persistence, so
 * a refresh wiped the typed institution details. The fields now use
 * `useFormDraft`, matching every other content form.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { InstitutionDomainRequestForm } from "@/components/auth/InstitutionDomainRequestForm";

vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@/app/actions/institution", () => ({
  requestInstitutionDomain: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/components/ui/FormCancelButton", () => ({
  FormCancelButton: () => null,
}));

const DRAFT_KEY = "draft_institution_domain_request";

describe("InstitutionDomainRequestForm draft", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
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
        <InstitutionDomainRequestForm defaultEmail="me@example.com" />,
      );
    });
  };

  const type = async (id: string, value: string) => {
    const input = container.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(`#${id}`)!;
    const proto =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
    await act(async () => {
      setValue.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("restores typed fields after a remount", async () => {
    await draw();
    await type("institutionName", "Example Institute");
    await type("institutionWebsite", "https://example.edu");
    await type("institutionDetails", "Verification note");

    expect(localStorage.getItem(DRAFT_KEY)).toContain("Example Institute");

    act(() => root.unmount());
    root = createRoot(container);
    await draw();

    expect(
      container.querySelector<HTMLInputElement>("#institutionName")!.value,
    ).toBe("Example Institute");
    expect(
      container.querySelector<HTMLInputElement>("#institutionWebsite")!.value,
    ).toBe("https://example.edu");
    expect(
      container.querySelector<HTMLTextAreaElement>("#institutionDetails")!
        .value,
    ).toBe("Verification note");
  });
});
