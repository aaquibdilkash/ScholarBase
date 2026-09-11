"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { uploadImage, deleteDraftImage } from "@/app/actions/cloudinary";
import { compressImageToBudget } from "@/utils/image-compression";
import AvatarCropperDialog from "@/components/profile/AvatarCropperDialog";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { MAX_FILE_BYTES } from "@/lib/image-constants";

export type ImageUploadKind = "social" | "contribution" | "avatar";

type ImageUploadFieldProps = {
  kind: ImageUploadKind;
  /** Current image URL (draft or published). */
  value: string;
  onChange: (url: string) => void;
  /** Notified when an upload starts/ends so parents can disable submits. */
  onUploadingChange?: (busy: boolean) => void;
  buttonLabel?: string;
  buttonVariant?: "solid" | "dashed";
  tooltip?: string;
  /** Green text shown while a value is set. */
  successHint?: string;
  hint?: string;
  previewSize?: number;
  circular?: boolean;
  /** Opens the crop dialog before uploading (avatar flow). */
  crop?: boolean;
  className?: string;
};

/**
 * Shared image upload field for social posts, contribution screenshots, and
 * avatars. Standardizes the add/replace/remove UX: the upload button is
 * auth-guarded, selecting a file compresses it client-side and uploads into
 * the caller's draft folder, replacing an image deletes the previous draft
 * asset, and the remove button (with spinner) deletes the asset when it is
 * still a draft and clears the field for published assets — whose server-side
 * deletion is deferred to the authorized save mutation.
 */
export function ImageUploadField({
  kind,
  value,
  onChange,
  onUploadingChange,
  buttonLabel = "Add Image",
  buttonVariant = "solid",
  tooltip,
  successHint,
  hint,
  previewSize = 80,
  circular = false,
  crop = false,
  className,
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Raw file pending crop in the dialog; the upload only starts after the
  // user confirms their crop selection.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
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

      const data = await uploadImage(fd, kind);

      // Replace flow: the previously selected draft is deleted. The strict
      // folder check makes this a no-op for published assets (they live
      // outside /draft/), so this is safe in every create/edit/profile flow.
      if (value && value !== data.url) {
        await deleteDraftImage(value);
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
    // Reset first so picking the same file again re-triggers onChange —
    // but only AFTER the file is captured, since resetting the input
    // clears its FileList.
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

    // The crop dialog uploads via doUpload on confirm and surfaces its own
    // errors, keeping the dialog open for retry/cancel.
    if (crop) setPendingFile(file);
    else void doUpload(file);
  }

  async function handleRemove() {
    if (!value || removing) return;
    if (!user) {
      openAuthModal();
      return;
    }

    setRemoving(true);
    try {
      const deleted = await deleteDraftImage(value);
      // False means "not in the user's draft folders" — published asset whose
      // deletion is deferred to the save mutation — unless it looks like a
      // draft, in which case surface the failure and keep the image.
      if (!deleted && value.includes("/draft/")) {
        toast("Could not delete the draft image. Please try again.", "error");
        return;
      }
      onChange("");
      setUploadError("");
    } finally {
      setRemoving(false);
    }
  }

  const buttonClass =
    buttonVariant === "dashed"
      ? "cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-80"
      : "flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-80";

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
          {buttonVariant === "solid" && !uploading && (
            <ImageIcon className="h-5 w-5" aria-hidden="true" />
          )}
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
        <div className="relative group mt-2 w-fit">
          <Image
            src={value}
            alt="Uploaded image preview"
            width={previewSize}
            height={previewSize}
            unoptimized
            style={{ width: previewSize, height: previewSize }}
            className={`object-cover border ${
              circular ? "rounded-full border-2" : "rounded-lg"
            } border-slate-200 dark:border-slate-700`}
          />
          {/* Always-visible remove button (works on touch/mobile) */}
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove image"
            disabled={removing}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 disabled:opacity-80"
          >
            {removing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="text-xs font-bold">×</span>
            )}
          </button>
          {/* Hover overlay: Remove image (desktop) */}
          <div
            onClick={handleRemove}
            className={`absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 ${
              circular ? "rounded-full" : "rounded-lg"
            }`}
          >
            <span className="text-xs font-semibold text-white">Remove</span>
          </div>
        </div>
      )}

      {value && successHint && (
        <p className="mt-1 text-xs font-semibold text-green-600">
          {successHint}
        </p>
      )}
      {uploadError && (
        <p className="mt-1 text-xs font-medium text-red-500">{uploadError}</p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}

      {crop && pendingFile && (
        <AvatarCropperDialog
          file={pendingFile}
          onClose={() => setPendingFile(null)}
          onConfirm={(cropped) => doUpload(cropped)}
        />
      )}
    </div>
  );
}


