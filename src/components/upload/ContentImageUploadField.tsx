"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import {
  uploadContentImageAction,
  deleteDraftContentImage,
  type ContentUploadKind,
} from "@/app/actions/content-images";
import { compressImageToBudget } from "@/utils/image-compression";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { isValidImageUrl, MAX_FILE_BYTES } from "@/lib/image-constants";

type ContentImageUploadFieldProps = {
  /** Module-scoped folder the image is stored in. */
  kind: ContentUploadKind;
  /** Current image URL (draft or published). */
  value: string;
  onChange: (url: string) => void;
  /** Notified when an upload starts/ends so parents can disable submits. */
  onUploadingChange?: (busy: boolean) => void;
  buttonLabel?: string;
  tooltip?: string;
  previewSize?: number;
  className?: string;
};

/**
 * Image upload field for a content module's cover image, backed by Supabase
 * Storage. Standardized add/replace/remove UX: upload goes to the uploader's
 * own draft folder, replacing deletes the previous draft, and the remove
 * button clears the field. Published assets are left for the 30-day trim cron
 * to clean up.
 */
export function ContentImageUploadField({
  kind,
  value,
  onChange,
  onUploadingChange,
  buttonLabel = "Add Cover Image",
  tooltip,
  previewSize = 120,
  className,
}: ContentImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();
  const { toast } = useToast();

  async function doUpload(file: File) {
    setUploading(true);
    onUploadingChange?.(true);
    setUploadError("");
    try {
      const uploadFile = await compressImageToBudget(file);
      const fd = new FormData();
      fd.append("file", uploadFile);

      const data = await uploadContentImageAction(fd, kind);
      if ("success" in data) {
        setUploadError(data.message);
        toast(data.message, "error");
        return;
      }

      // Replace flow: delete the previous draft if it was a draft URL
      if (value && value !== data.url && value.includes("/drafts/")) {
        await deleteDraftContentImage(value);
      }

      onChange(data.url);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload image.",
      );
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("Image must be under 5 MB.");
      return;
    }

    void doUpload(file);
  }

  async function handleRemove() {
    if (!value || removing) return;
    if (!user) {
      openAuthModal();
      return;
    }

    setRemoving(true);
    try {
      if (value.includes("/drafts/")) {
        const deleted = await deleteDraftContentImage(value);
        if (!deleted) {
          toast("Could not delete the draft image. Please try again.", "error");
          return;
        }
      }
      onChange("");
      setLightboxOpen(false);
      setUploadError("");
    } finally {
      setRemoving(false);
    }
  }

  const buttonClass =
    "flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!user) {
              openAuthModal();
              return;
            }
            fileInputRef.current?.click();
          }}
          disabled={uploading || removing}
          className={buttonClass}
        >
          {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
          {<ImageIcon className="h-5 w-5" aria-hidden="true" />}
          {uploading ? "Uploading..." : buttonLabel}
        </button>
        {tooltip && <InfoTooltip message={tooltip} />}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSelect}
          disabled={uploading}
        />
      </div>

      {value && (
        <div className="relative mt-2 w-fit">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Open image preview"
            title="Click to enlarge"
            className="block cursor-zoom-in border border-slate-200 transition hover:opacity-90 dark:border-slate-700 rounded-lg"
          >
            <Image
              src={value}
              alt="Uploaded image preview"
              width={previewSize}
              height={previewSize}
              unoptimized
              style={{ width: previewSize, height: previewSize }}
              className="block object-cover rounded-lg"
            />
          </button>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove image"
            title="Remove image"
            disabled={removing}
            className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600 disabled:opacity-80"
          >
            {removing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="text-xs font-bold">×</span>
            )}
          </button>
        </div>
      )}

      {lightboxOpen && isValidImageUrl(value) && (
        <ImageLightbox
          images={[value]}
          index={0}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {uploadError && (
        <p className="mt-1 text-xs font-medium text-red-500">{uploadError}</p>
      )}
    </div>
  );
}
