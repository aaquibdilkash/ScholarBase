"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";

export function TruncatedCardBody({
  children,
  detailPageHref,
  className,
  noBodyLink,
}: {
  children: ReactNode;
  detailPageHref: string;
  className?: string;
  noBodyLink: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const updateTruncation = () => {
      setIsTruncated(body.scrollHeight > body.clientHeight + 1);
    };
    updateTruncation();
    const observer = new ResizeObserver(updateTruncation);
    observer.observe(body);
    return () => observer.disconnect();
  }, [children]);

  const content = (
    <div ref={bodyRef} className={isExpanded ? "overflow-visible" : "max-h-30 min-w-0 overflow-hidden"}>
      {children}
    </div>
  );

  return (
    <>
      {noBodyLink ? (
        <div className={className}>{content}</div>
      ) : (
        <Link href={detailPageHref} className={className}>
          {content}
        </Link>
      )}
      {isTruncated || isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="mt-3 inline-flex text-sm font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
        >
          {isExpanded ? "View less" : "View more"}
        </button>
      ) : null}
    </>
  );
}
