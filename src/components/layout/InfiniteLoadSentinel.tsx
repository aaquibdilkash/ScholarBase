"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function InfiniteLoadSentinel({ hasMore }: { hasMore: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!hasMore) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) return;

      const nextPage = Math.max(1, Number(searchParams.get("page") ?? "1")) + 1;
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(nextPage));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, pathname, router, searchParams]);

  if (!hasMore) return null;

  return <div ref={ref} className="h-10 w-full" aria-hidden="true" />;
}
