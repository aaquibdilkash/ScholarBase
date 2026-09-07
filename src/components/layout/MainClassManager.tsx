"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MainClassManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/messages")) {
      document.documentElement.classList.add("sb-route-messages");
    } else {
      document.documentElement.classList.remove("sb-route-messages");
    }
  }, [pathname]);

  return null;
}