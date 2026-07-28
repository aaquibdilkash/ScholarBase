"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLoginButton() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <Link href="/login?callbackUrl=/" className="sb-button-primary">
      Sign In
    </Link>
  );
}
