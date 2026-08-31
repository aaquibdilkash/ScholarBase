"use server";

import { v2 as cloudinary } from "cloudinary";
import { requireCurrentUser } from "@/lib/auth";
import {
  POST_MAX_WIDTH,
  POST_MAX_HEIGHT,
  POST_QUALITY,
  AVATAR_MAX_WIDTH,
  AVATAR_MAX_HEIGHT,
  AVATAR_QUALITY,
  MAX_FILE_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/image-constants";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type UploadKind = "post" | "avatar";

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
  await requireCurrentUser();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Unsupported image type");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Image must be under 5 MB");
  }

  const folder = kind === "avatar" ? "avatars" : "contributions";
  const transformation =
    kind === "avatar"
      ? [
          {
            width: AVATAR_MAX_WIDTH,
            height: AVATAR_MAX_HEIGHT,
            crop: "fill",
            gravity: "auto",
            quality: AVATAR_QUALITY,
            fetch_format: "auto",
            flags: "strip_profile",
          },
        ]
      : [
          {
            width: POST_MAX_WIDTH,
            height: POST_MAX_HEIGHT,
            crop: "limit",
            quality: POST_QUALITY,
            fetch_format: "auto",
            flags: ["strip_profile", "lossy"],
          },
        ];

  const buffer = Buffer.from(await file.arrayBuffer());

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
        transformation,
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

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    format: result.format,
  };
}

/**
 * Extracts the public_id from a Cloudinary URL and deletes the asset.
 * Cloudinary URL format: https://res.cloudinary.com/cloudname/image/upload/v123456/folder/publicid.ext
 * Returns true if deletion was successful or imageUrl is empty, false otherwise.
 */
export async function deleteFromCloudinary(
  imageUrl: string | null | undefined,
): Promise<boolean> {
  if (!imageUrl) return true;

  try {
    const urlParts = imageUrl.split("/");
    const versionIndex = urlParts.findIndex(
      (part) => part.startsWith("v") && /^\d+$/.test(part.slice(1)),
    );

    if (versionIndex === -1) return false;

    const publicIdParts = urlParts.slice(versionIndex + 1);
    const publicIdWithExt = publicIdParts.join("/");
    const publicId = publicIdWithExt.replace(/\.[^.]+$/, "");

    if (!publicId) return false;

    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error("Failed to delete from Cloudinary:", error);
    return false;
  }
}

