/**
 * @vitest-environment jsdom
 *
 * Regression: after an admin deleted an account, layout.tsx redirected to
 * /login?error=account-deleted-by-admin. Once the account was recovered, the
 * stale `?error=` query param kept re-rendering the "account deleted" banner on
 * every refresh even though the account could log in again. The notice must be
 * one-time: show it, then strip the param.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

vi.mock("@/components/auth/OtpInput", () => ({
  OTP_LENGTH: 6,
  OtpInput: () => null,
}));

import { LoginForm } from "@/components/auth/LoginForm";

describe("LoginForm stale deletion banner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState(
      null,
      "",
      "/login?error=account-deleted-by-admin",
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.history.replaceState(null, "", "/");
  });

  it("shows the deletion banner once, then clears the ?error= param", async () => {
    await act(async () => {
      root.render(
        <LoginForm returnUrl="/" initialError="account-deleted-by-admin" />,
      );
    });

    // The notice is rendered on the first paint.
    expect(container.textContent).toContain(
      "Your account has been deleted",
    );

    // The transient redirect param is stripped, so a refresh (or a recovered
    // account) no longer re-renders the stale message.
    expect(window.location.search).not.toContain("error=");
  });
});
