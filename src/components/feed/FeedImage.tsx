"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import {
  CONTENT_IMAGE_MAX_HEIGHT,
  isValidImageUrl,
} from "@/lib/image-constants";

/**
 * FeedImage
 * ---------
 * A post image that opens the shared ImageLightbox when clicked. Keeps scholars
 * on the page and in their scroll context instead of opening a raw asset in a
 * new tab. Used by the feed detail page (and reusable anywhere a single feed
 * image should be expandable).
 *
 * The cover sits in the same boxed, contained frame as an expanded list card:
 * fixed maximum height, natural aspect ratio, centred, and the box shrinks to
 * the image when it is shorter than the cap. The lightbox shows it in full.
 */
export function FeedImage({
  src,
  alt = "",
  width = 800,
  height = 416,
  unoptimized = false,
  className = "block h-auto w-auto max-w-full",
}: {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  unoptimized?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!src || !isValidImageUrl(src)) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Open image preview"
        title="Click to enlarge"
        className="flex w-full cursor-pointer items-start justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-left transition hover:opacity-90 dark:bg-slate-900"
        style={{ maxHeight: CONTENT_IMAGE_MAX_HEIGHT }}
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
          style={{ maxHeight: CONTENT_IMAGE_MAX_HEIGHT }}
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