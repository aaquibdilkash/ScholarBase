"use client";

import { useState } from "react";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  /** Extra classes for the <img> when it renders (e.g. object-fit). */
  imageClassName?: string;
  /** Classes for the initials fallback. */
  fallbackClassName?: string;
}

/**
 * Robust avatar with a graceful initials fallback.
 *
 * - `referrerPolicy="no-referrer"` prevents Google OAuth avatar hosts
 *   (lh3.googleusercontent.com) from rejecting hot-linked images with 403.
 * - If the image fails to load (network drop, expired upload, 403), a styled
 *   initials fallback renders instead of the browser's broken-image icon.
 * - Fills its parent, which must establish the circular boundary and size
 *   (e.g. `h-10 w-10 rounded-full overflow-hidden`).
 */
export function UserAvatar({
  src,
  name,
  email,
  imageClassName = "",
  fallbackClassName = "",
}: UserAvatarProps) {
  const [hasFailed, setHasFailed] = useState(false);

  // Reset the failure state if the source changes (e.g. avatar upload).
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setHasFailed(false);
  }

  const showImage = Boolean(src) && !hasFailed;
  const initials =
    (name || email || "SB").trim().slice(0, 2).toUpperCase() || "SB";

  if (!showImage) {
    return (
      <span
        aria-hidden
        className={`flex h-full w-full select-none items-center justify-center uppercase ${fallbackClassName}`}
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src as string}
      alt={name || email || "Avatar"}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setHasFailed(true)}
      className={`h-full w-full object-cover ${imageClassName}`}
    />
  );
}