"use client";

import { useRouter } from "next/navigation";

export function FormCancelButton({ href }: { href?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (href ? router.push(href) : router.back())}
      className="sb-button-accent"
    >
      Cancel
    </button>
  );
}