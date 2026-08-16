"use client";

import { useEffect, useRef } from "react";

export function LoadMoreSentinel({
  onVisible,
  disabled,
}: {
  onVisible: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onVisible();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled, onVisible]);

  if (disabled) return null;
  return <div ref={ref} className="h-8 w-full" aria-hidden="true" />;
}
