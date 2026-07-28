"use client";

import { useAuthModal } from "@/components/interactions/AuthModal";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import type { ReactNode } from "react";
import { useUser } from "@/hooks/useUser";

export function SubmitBtnWithAuth({
  children,
  className,
  loadingText,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  loadingText?: string;
  disabled?: boolean;
}) {
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        className={className || "sb-button-accent"}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }

  return (
    <SubmitBtn
      className={className}
      loadingText={loadingText}
      disabled={disabled}
    >
      {children}
    </SubmitBtn>
  );
}
