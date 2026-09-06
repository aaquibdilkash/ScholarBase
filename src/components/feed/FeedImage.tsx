"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

/**
 * FeedImage
 * ---------
 * A post image that opens the shared ImageLightbox when clicked. Keeps scholars
 * on the page and in their scroll context instead of opening a raw asset in a
 * new tab. Used by the feed detail page (and reusable anywhere a single feed
 * image should be expandable).
 */
export function FeedImage({
  src,
  alt = "",
  width = 800,
  height = 416,
  unoptimized = false,
  className = "block w-full object-contain rounded-xl",
}: {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  unoptimized?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Open image preview"
        title="Click to enlarge"
        className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-left transition hover:opacity-90 dark:bg-slate-900"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          unoptimized={unoptimized}
          className={`${className} transition duration-200 hover:scale-[1.02]`}
        />
      </button>

      {isOpen && (
        <ImageLightbox
          images={[src]}
          index={0}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}