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

  if (isAuthenticated) {
    return (
      <Link href={href} className="sb-button-accent whitespace-nowrap">
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openAuthModal()}
      className="sb-button-accent whitespace-nowrap cursor-pointer"
    >
      {label}
    </button>
  );
}
