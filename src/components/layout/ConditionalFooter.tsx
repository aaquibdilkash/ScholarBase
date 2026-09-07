"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  const isMessagesRoute = pathname?.startsWith("/messages");

  return (
    <div className={isMessagesRoute ? "hidden" : undefined}>
      <Footer />
    </div>
  );
}