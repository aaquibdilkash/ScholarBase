"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavLoginButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname === "/login") return null;

  const callbackUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return (
    <Link prefetch={false} href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="sb-button-primary px-3 py-2 text-[11px] sm:px-4 sm:py-2.5 sm:text-xs md:px-5 md:py-3 md:text-sm">
      Sign In
    </Link>
  );
}
