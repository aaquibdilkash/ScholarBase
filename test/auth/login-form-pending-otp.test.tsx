/**
 * @vitest-environment jsdom
 *
 * Regression: the OTP step is restored from sessionStorage after a reload.
 * "Change email" cleared the React step but left that marker behind, so the
 * next refresh reopened the OTP screen for the address the user had just
 * abandoned — even after they cleared the email field.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/actions/auth", () => ({
  login: vi.fn(),
  signup: vi.fn(),
  verifySignupOtp: vi.fn(),
  resendSignupOtp: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/auth/ForgotPasswordForm", () => ({
  ForgotPasswordForm: () => null,
}));

// The test is about LoginForm clearing the persisted marker, not OtpInput's
// digit handling, so a minimal probe makes the back action explicit.
vi.mock("@/components/auth/OtpInput", () => ({
  OTP_LENGTH: 6,
  OtpInput: ({ email, onBack }: { email: string; onBack?: () => void }) => (
    <div>
      <p data-testid="otp-email">{email}</p>
      <button type="button" onClick={onBack}>
        ← Change email
      </button>
    </div>
  ),
}));

import { LoginForm } from "@/components/auth/LoginForm";

const PENDING_KEY = "sb_pending_otp_email";

describe("LoginForm pending OTP restore", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    push.mockClear();
    sessionStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    sessionStorage.clear();
  });

  const draw = async () => {
    await act(async () => {
      root.render(<LoginForm returnUrl="/" />);
    });
  };

  const clickButton = async (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(label),
    );
    if (!button) throw new Error(`no button containing "${label}"`);
    await act(async () => {
      button.click();
    });
  };

  it("clears the restore marker when the user changes email", async () => {
    sessionStorage.setItem(PENDING_KEY, "old@university.edu");

    await draw();
    expect(container.textContent).toContain("old@university.edu");

    await clickButton("Change email");

    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    expect(container.querySelector("#email")).not.toBeNull();

    // Simulate the refresh that previously reopened the OTP step.
    act(() => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await draw();

    expect(container.querySelector("#email")).not.toBeNull();
    expect(container.textContent).not.toContain("old@university.edu");
  });
});
