"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * ImageLightbox
 * ------------
 * A dimmed-backdrop modal (the industry-standard "lightbox") for viewing an
 * image (or a gallery of images) in place, so scholars never leave the feed or
 * lose their scroll context.
 *
 * Behaviour
 *   - Open by rendering it with a non-null `index`.
 *   - Close on: backdrop click, the ✕ button, or the Escape key.
 *   - With multiple images: navigate with the prev/next buttons, or the
 *     left/right arrow keys. A small "n / total" counter is shown.
 *   - While open, `body` scrolling is locked and the close button is focused.
 *
 * The parent owns the open state so callers can render the trigger. Use:
 *
 *   {openIndex !== null && (
 *     <ImageLightbox
 *       images={images}
 *       index={openIndex}
 *       onClose={() => setOpenIndex(null)}
 *       onNavigate={(idx) => setOpenIndex(idx)}
 *     />
 *   )}
 */
export function ImageLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  /** Image URLs to display. A single-entry array works for one image. */
  images: string[];
  /** Currently displayed image index, or null while the lightbox is hidden. */
  index: number | null;
  onClose: () => void;
  /** Called with the index of the newly focused image (prev/next). */
  onNavigate?: (nextIndex: number) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleNavigate = useMemo(
    () => onNavigate ?? (() => {}),
    [onNavigate],
  );

  const count = images.length;
  const isOpen = index !== null && count > 0;
  const currentIndex = isOpen ? index % count : null;
  const hasMultiple = count > 1;

  // Lock body scroll + wire keyboard controls for the duration of the overlay.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const idx = currentIndex ?? 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (!hasMultiple) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNavigate((idx + 1) % count);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleNavigate((idx - 1 + count) % count);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, hasMultiple, count, currentIndex, onClose, handleNavigate]);

  if (!isOpen || currentIndex === null) return null;

  const src = images[currentIndex];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        // Close only when the backdrop itself (not inner content) is clicked.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Explicit close button (top-right) */}
      <button
        ref={closeButtonRef}
        type="button"
        aria-label="Close image preview"
        title="Close (Esc)"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 active:bg-white/40"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Previous image (multi-image only) */}
      {hasMultiple && (
        <button
          type="button"
          aria-label="Previous image"
          title="Previous (Left arrow)"
          onClick={() => handleNavigate((currentIndex - 1 + count) % count)}
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 active:bg-white/40"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next image (multi-image only) */}
      {hasMultiple && (
        <button
          type="button"
          aria-label="Next image"
          title="Next (Right arrow)"
          onClick={() => handleNavigate((currentIndex + 1) % count)}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 active:bg-white/40"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Responsive image - scales to fit the viewport preserving aspect ratio */}
      <div
        className="flex min-h-0 min-w-0 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> so the
            lightbox can scale freely inside the viewport without preset dims. */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="block max-h-[90vh] max-w-[90vw] object-contain"
        />
      </div>

      {/* Gallery counter (multi-image only) */}
      {hasMultiple && (
        <div
          aria-live="polite"
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white"
        >
          {currentIndex + 1} / {count}
        </div>
      )}
    </div>,
    document.body,
  );
}