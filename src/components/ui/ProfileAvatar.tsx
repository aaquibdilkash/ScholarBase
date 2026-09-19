"use client";

import { useState } from "react";
import { UserAvatar } from "./UserAvatar";
import { ImageLightbox } from "./ImageLightbox";
import { isValidImageUrl } from "@/lib/image-constants";

interface ProfileAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  fallbackClassName?: string;
  imageClassName?: string;
}

export function ProfileAvatar({
  src,
  name,
  size = 96,
  fallbackClassName = "",
  imageClassName = "",
}: ProfileAvatarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (src && isValidImageUrl(src)) {
      setIsOpen(true);
    }
  };

  return (
    <>
      <div
        className="relative cursor-pointer transition duration-200 hover:scale-[1.02]"
        onClick={handleClick}
        style={{ width: size, height: size }}
      >
        <UserAvatar
          src={src}
          name={name}
          fallbackClassName={fallbackClassName}
          imageClassName={imageClassName}
        />
      </div>

      {isOpen && src && isValidImageUrl(src) && (
        <ImageLightbox
          images={[src]}
          index={0}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}