"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ImageLightbox } from "@/components/ui/ImageLightbox";
import {
  CONTENT_IMAGE_COLLAPSED_RATIO,
  CONTENT_IMAGE_MAX_HEIGHT,
  isValidImageUrl,
} from "@/lib/image-constants";

/**
 * Inline styles for a native CSS line clamp. Unlike a rigid pixel-height
 * (`overflow: hidden`) container, a line clamp clips only at whole lines, so
 * text is never sliced in half mid-line.
 */
const lineClampStyle = (lines: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

/**
 * Text line cap in the collapsed state. The image sits BELOW the text, so the
 * text takes its natural clamped height instead of a fixed box (a fixed box
 * left a visible hole between a one-line post and its image).
 */
const STACKED_COLLAPSED_LINES = 2;

/**
 * The collapsed and expanded frames render the SAME contained image — natural
 * aspect ratio, centred, capped at CONTENT_IMAGE_MAX_HEIGHT — and only the
 * frame height changes: collapsed shows the top
 * CONTENT_IMAGE_COLLAPSED_RATIO of it, expanded shows all of it. Expanding
 * therefore reveals the hidden bottom ("unfurls") without changing width or
 * scale.
 */

export type CollapsibleMediaBodyProps = {
  /** Detail page the collapsed body links to. */
  href: string;
  /** Card image URL. When absent the body renders as a full-width text block. */
  imageUrl?: string | null;
  /** Body text. Clamped in the collapsed state, fully visible when expanded. */
  text: ReactNode;
  /**
   * Optional always-visible heading rendered above the text/image row inside
   * the same link (e.g. a blog post's title).
   */
  header?: ReactNode;
  /**
   * Stable identity for the measured text, used to re-run truncation
   * measurement when the content actually changes (not on every render).
   */
  contentKey: string;
  /** Eagerly load the image (first card in a list). */
  priority?: boolean;
  /** Extra classes for the clamped text element. */
  textClassName?: string;
};

/**
 * CollapsibleMediaBody
 * --------------------
 * The shared "text with an image, collapsed" card body, used by every content
 * module that grows an `imageUrl` column so they render the exact same collapse
 * behaviour instead of re-implementing it:
 *
 *   collapsed  ->  text full width (clamped to STACKED_COLLAPSED_LINES), then
 *                  the cover contained (aspect ratio kept) in a frame showing
 *                  its top CONTENT_IMAGE_COLLAPSED_RATIO.
 *   expanded   ->  text full width, then the SAME cover in a taller frame, so
 *                  the hidden bottom is revealed without rescaling.
 *
 * "View more" appears whenever the text is truncated or the cover is taller
 * than the collapsed frame, and "View less" collapses it back. The image opens
 * the shared ImageLightbox on click.
 */
export function CollapsibleMediaBody({
  href,
  imageUrl,
  text,
  header,
  contentKey,
  priority = false,
  textClassName,
}: CollapsibleMediaBodyProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  // Intrinsic dimensions of the full-size image, used to compute how tall the
  // cover renders and therefore how much of it the collapsed frame shows.
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(
    null,
  );
  // Frame width, used to compute the contained image's rendered height.
  const [thumbnailWidth, setThumbnailWidth] = useState(0);

  const bodyRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  // Track the previous expansion state so we only scroll on the
  // expanded → collapsed transition (when "View less" is clicked).
  const prevExpanded = useRef(isExpanded);

  const hasImage = isValidImageUrl(imageUrl);

  // Whether the full text exceeds the collapsed line cap (real truncation ->
  // show the toggle).
  const updateCollapsedMetrics = useCallback(() => {
    const body = bodyRef.current;
    const measure = measureRef.current;
    if (!body || !measure) {
      setIsTruncated(false);
      return;
    }
    const lineHeightPx = parseFloat(getComputedStyle(body).lineHeight) || 0;
    const visibleHeight = lineHeightPx * STACKED_COLLAPSED_LINES;
    setIsTruncated(measure.getBoundingClientRect().height > visibleHeight + 1);
  }, []);

  useEffect(() => {
    updateCollapsedMetrics();
    const observer = new ResizeObserver(updateCollapsedMetrics);
    if (bodyRef.current) observer.observe(bodyRef.current);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [contentKey, imageUrl, updateCollapsedMetrics]);

  // When collapsing ("View less"), scroll the card header back to the top of
  // the viewport so the user can see the title/author of the same card again
  // (and re-expand it) without hunting for the button.
  useEffect(() => {
    if (prevExpanded.current && !isExpanded && toggleButtonRef.current) {
      const card = toggleButtonRef.current.closest(".sb-card");
      (card ?? toggleButtonRef.current).scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    prevExpanded.current = isExpanded;
  }, [isExpanded]);

  // Track the cover frame width so the contained image's rendered height — and
  // therefore the collapsed frame height — can be computed. Refs must not be
  // read during render, so the width lives in state, kept fresh by an observer.
  useEffect(() => {
    const el = imageButtonRef.current;
    if (!el) return;
    const updateWidth = () => setThumbnailWidth(el.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [imageUrl]);

  // Height the contained image actually occupies: its natural size scaled down
  // to fit the frame width and the CONTENT_IMAGE_MAX_HEIGHT cap (never
  // upscaled past its own pixels).
  const containedImageHeight =
    imageNatural && thumbnailWidth > 0
      ? imageNatural.h *
        Math.min(
          1,
          thumbnailWidth / imageNatural.w,
          CONTENT_IMAGE_MAX_HEIGHT / imageNatural.h,
        )
      : 0;
  // Collapsed frame height: the top CONTENT_IMAGE_COLLAPSED_RATIO of the
  // contained image. Before the image reports its size, fall back to the same
  // ratio of the cap so the card does not jump on load.
  const collapsedImageHeight =
    containedImageHeight > 0
      ? Math.round(containedImageHeight * CONTENT_IMAGE_COLLAPSED_RATIO)
      : Math.round(CONTENT_IMAGE_MAX_HEIGHT * CONTENT_IMAGE_COLLAPSED_RATIO);
  const imageFrameHeight = isExpanded
    ? CONTENT_IMAGE_MAX_HEIGHT
    : collapsedImageHeight;
  // If the contained image is taller than the collapsed frame, its bottom is
  // hidden -> show "View more" so the user can reveal it.
  const imageIsCut =
    !isExpanded && containedImageHeight > collapsedImageHeight + 1;
  const showToggle = isExpanded || isTruncated || imageIsCut;

  return (
    <>
      {/* Text first, cover below. The expansion toggle and the lightbox button
          are siblings OUTSIDE this Link so they never navigate. */}
      <Link
        href={href}
        prefetch={false}
        className="group flex min-w-0 flex-col"
      >
        {header}
        <div className="relative w-full min-w-0">
          {/* A <div>, not a <p>: the body can be rich content that renders
              block elements (RichContent is a <div>), and a <div> inside a <p>
              is invalid HTML — the browser reparents it, which breaks
              hydration. */}
          <div
            ref={bodyRef}
            className={`mb-3 whitespace-pre-wrap break-words leading-relaxed text-slate-800 [overflow-wrap:anywhere] transition-colors group-hover:text-slate-600 ${
              isExpanded ? "" : "overflow-hidden"
            } ${textClassName ?? ""}`}
            style={
              isExpanded ? undefined : lineClampStyle(STACKED_COLLAPSED_LINES)
            }
          >
            {text}
          </div>
          {/* Hidden, non-clamped copy used purely for truncation measurement.
              It must share the body's exact text-layout classes so it
              wraps/breaks identically and gives an accurate height
              comparison. */}
          <div
            ref={measureRef}
            inert
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 w-full whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]"
            style={{ visibility: "hidden" }}
          >
            {text}
          </div>
        </div>
        {hasImage && (
          <button
            ref={imageButtonRef}
            type="button"
            aria-label="Open image preview"
            className="mb-3 flex w-full cursor-pointer items-start justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-left transition-all duration-300 ease-out hover:opacity-90 dark:bg-slate-900"
            style={{ maxHeight: imageFrameHeight }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent?.stopImmediatePropagation();
              setOpenIndex(0);
            }}
          >
            <Image
              src={imageUrl as string}
              alt=""
              width={800}
              height={400}
              unoptimized
              loading={priority ? "eager" : "lazy"}
              onLoad={(e) => {
                const el = e.currentTarget;
                if (el.naturalWidth && el.naturalHeight) {
                  setImageNatural({ w: el.naturalWidth, h: el.naturalHeight });
                }
              }}
              // Natural aspect ratio, centred, capped at CONTENT_IMAGE_MAX_HEIGHT
              // so a portrait screenshot cannot take over the card. The frame
              // clips the bottom while collapsed and reveals it when expanded,
              // without ever rescaling the image.
              className="mx-auto block h-auto w-auto max-w-full transition duration-200 hover:scale-[1.02]"
              style={{ maxHeight: CONTENT_IMAGE_MAX_HEIGHT }}
            />
          </button>
        )}
      </Link>

      {showToggle && (
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={(e) => {
            // This button sits OUTSIDE the <Link prefetch={false}>, so it never
            // navigates; this also guards against any parent
            // <Link prefetch={false}>/wrapper bubbling.
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded((current) => !current);
          }}
          className="mt-2 inline-flex text-sm font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
        >
          {isExpanded ? "View less" : "View more"}
        </button>
      )}

      {openIndex !== null && (
        <ImageLightbox
          images={[imageUrl as string]}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={(idx) => setOpenIndex(idx)}
        />
      )}
    </>
  );
}
