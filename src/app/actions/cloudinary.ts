"use server";

import { v2 as cloudinary } from "cloudinary";
import { requireActiveUser } from "@/lib/auth";
import {
  deleteCloudinaryAsset,
  getCloudinaryPublicId,
  getUserImageFolder,
} from "@/lib/cloudinary";
import {
  POST_MAX_WIDTH,
  POST_MAX_HEIGHT,
  POST_QUALITY,
  AVATAR_MAX_WIDTH,
  AVATAR_MAX_HEIGHT,
  AVATAR_QUALITY,
  MAX_FILE_BYTES,
  MAX_STORED_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/image-constants";

export type UploadKind = "social" | "contribution" | "avatar";

export type UploadResult = {
  url: string;
  publicId: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
};

export async function uploadImage(
  formData: FormData,
  kind: UploadKind,
): Promise<UploadResult> {
  const user = await requireActiveUser();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Unsupported image type");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Image must be under 5 MB");
  }

  const folder = getUserImageFolder(user.id, kind, true);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Compression ladder: every stored asset must land under the storage
  // budget. The first rung preserves current quality; later rungs trade
  // quality and dimensions for size, so well-behaved images still upload
  // exactly once. All rungs share one public_id and overwrite it, so a
  // retry never leaves orphan assets behind in the draft folder.
  const isAvatar = kind === "avatar";
  const baseWidth = isAvatar ? AVATAR_MAX_WIDTH : POST_MAX_WIDTH;
  const baseHeight = isAvatar ? AVATAR_MAX_HEIGHT : POST_MAX_HEIGHT;
  const compressionLadder = [
    {
      quality: isAvatar ? AVATAR_QUALITY : POST_QUALITY,
      width: baseWidth,
      height: baseHeight,
    },
    { quality: "auto:eco" as const, width: baseWidth, height: baseHeight },
    {
      quality: 50,
      width: Math.min(baseWidth, 1280),
      height: Math.min(baseHeight, 1280),
    },
    {
      quality: 30,
      width: Math.min(baseWidth, 1024),
      height: Math.min(baseHeight, 1024),
    },
  ];

  const publicId = crypto.randomUUID();
  let bestBytes = 0;
  for (const attempt of compressionLadder) {
    try {
      const result = await new Promise<{
        secure_url: string;
        public_id: string;
        bytes: number;
        width: number;
        height: number;
        format: string;
      }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: publicId,
            overwrite: true,
            transformation: [
              {
                width: attempt.width,
                height: attempt.height,
                crop: isAvatar ? "fill" : "limit",
                ...(isAvatar ? { gravity: "auto" } : {}),
                quality: attempt.quality,
                fetch_format: "auto",
                flags: isAvatar ? "strip_profile" : ["strip_profile", "lossy"],
              },
            ],
            resource_type: "image",
            invalidate: true,
          },
          (error, res) => {
            if (error || !res) reject(error ?? new Error("Upload failed"));
            else resolve(res as never);
          },
        );
        stream.end(buffer);
      });

      if (result.bytes <= MAX_STORED_BYTES) {
        return {
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format,
        };
      }
      bestBytes = Math.max(bestBytes, result.bytes);
    } catch (error) {
      console.error("[CloudinaryUpload Error]:", error);
      throw new Error(
        "Image upload failed. Please check the image and try again.",
      );
    }
  }

  throw new Error(
    `This image is too large to compress under ${Math.round(MAX_STORED_BYTES / 1024)} KB (closest: ${Math.round(bestBytes / 1024)} KB). Please upload a smaller image.`,
  );
}

export async function deleteDraftImage(
  imageUrl: string | null | undefined,
): Promise<boolean> {
  if (!imageUrl) return true;

  const user = await requireActiveUser("Log in to delete draft images.");
  const publicId = getCloudinaryPublicId(imageUrl);
  const draftFolders = [
    getUserImageFolder(user.id, "avatar", true),
    getUserImageFolder(user.id, "social", true),
    getUserImageFolder(user.id, "contribution", true),
  ];
  if (!publicId || !draftFolders.some((folder) => publicId.startsWith(`${folder}/`))) {
    console.warn(
      "[deleteDraftImage] Rejected URL outside the user's draft folders:",
      { publicId, expectedFolders: draftFolders },
    );
    return false;
  }

  return deleteCloudinaryAsset(imageUrl);
}
