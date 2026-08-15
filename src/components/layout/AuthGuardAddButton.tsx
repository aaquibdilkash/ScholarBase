"use client";

import Link from "next/link";
import { useAuthModal } from "@/components/interactions/AuthModal";

export function AuthGuardAddButton({
  href,
  label,
  isAuthenticated,
}: {
  href: string;
  label: string;
  isAuthenticated: boolean;
}) {
  const { openAuthModal } = useAuthModal();

  const buttonClass = "sb-button-primary whitespace-nowrap";

  if (isAuthenticated) {
    return (
      <Link href={href} className={buttonClass}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openAuthModal(href)}
      className={buttonClass}
    >
      {label}
    </button>
  );
}
