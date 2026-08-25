"use server";

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function generateSignature(folder: string) {
  const timestamp = Math.round(new Date().getTime() / 1000);

  const paramsToSign = {
    timestamp,
    folder,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!,
  );

  return {
    timestamp,
    signature,
    apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
    folder,
  };
}

export async function generateCloudinarySignature() {
  return generateSignature("contributions");
}

export async function generateAvatarSignature() {
  return generateSignature("avatars");
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
    // Parse public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/cloudname/image/upload/v123456/folder/public_id.ext
    const urlParts = imageUrl.split("/");
    const versionIndex = urlParts.findIndex(
      (part) => part.startsWith("v") && /^\d+$/.test(part.slice(1)),
    );

    if (versionIndex === -1) return false;

    // Everything after the version is the public_id (with extension)
    const publicIdParts = urlParts.slice(versionIndex + 1);
    const publicIdWithExt = publicIdParts.join("/");
    // Remove file extension
    const publicId = publicIdWithExt.replace(/\.[^.]+$/, "");

    if (!publicId) return false;

    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error("Failed to delete from Cloudinary:", error);
    return false;
  }
}
