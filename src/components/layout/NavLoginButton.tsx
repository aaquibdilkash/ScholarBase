"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavLoginButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname === "/login") return null;

  const callbackUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return (
    <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="sb-button-primary">
      Sign In
    </Link>
  );
}
