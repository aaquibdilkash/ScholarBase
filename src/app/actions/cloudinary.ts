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

  try {

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Unsupported image type");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Image must be under 5 MB");
  }

  const folder = getUserImageFolder(user.id, kind, true);
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
  } catch (error) {
    console.error("[CloudinaryUpload Error]:", error);
    throw new Error("Image upload failed. Please check the image and try again.");
  }
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
