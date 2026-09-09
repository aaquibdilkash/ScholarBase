"use client";

import { useRouter } from "next/navigation";

export function FormCancelButton({ href, className = "" }: { href?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (href ? router.push(href) : router.back())}
      className={`sb-button-accent ${className}`}
    >
      Cancel
    </button>
  );
}
