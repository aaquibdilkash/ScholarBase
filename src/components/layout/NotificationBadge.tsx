"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export default function NotificationBadge({
  initialUnreadCount = 0,
}: {
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    const handleRead = (event: Event) => {
      const { delta } = (event as CustomEvent<{ delta: number }>).detail || {};
      if (typeof delta === "number" && delta > 0) {
        setUnreadCount((prev) => Math.max(0, prev - delta));
      }
    };

    const handleAllRead = () => {
      setUnreadCount(0);
    };

    window.addEventListener("notification-read", handleRead);
    window.addEventListener("all-notifications-read", handleAllRead);
    return () => {
      window.removeEventListener("notification-read", handleRead);
      window.removeEventListener("all-notifications-read", handleAllRead);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="sb-button-primary relative p-2"
      aria-label="Notifications"
    >
      <Bell className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
