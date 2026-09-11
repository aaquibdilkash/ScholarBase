import "server-only";

import { v2 as cloudinary } from "cloudinary";

export type CloudinaryImageKind = "avatar" | "social" | "contribution";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function deleteCloudinaryAsset(
  imageUrl: string | null | undefined,
): Promise<boolean> {
  if (!imageUrl) return true;

  try {
    const urlParts = imageUrl.split("/");
    const versionIndex = urlParts.findIndex(
      (part) => part.startsWith("v") && /^\d+$/.test(part.slice(1)),
    );

    if (versionIndex === -1) return false;

    const publicIdWithExt = urlParts.slice(versionIndex + 1).join("/");
    const publicId = publicIdWithExt.replace(/\.[^.]+$/, "");
    if (!publicId) return false;

    const result = await cloudinary.uploader.destroy(publicId);
    // "not found" means the asset is already gone — deletion is idempotent.
    if (result.result === "not found") return true;
    if (result.result !== "ok") {
      console.error("Cloudinary destroy returned unexpected result:", result.result, publicId);
    }
    return result.result === "ok";
  } catch (error) {
    console.error("Failed to delete from Cloudinary:", error);
    return false;
  }
}

export function getCloudinaryPublicId(imageUrl: string): string | null {
  try {
    const parsed = new URL(imageUrl);
    if (!parsed.hostname.endsWith(".cloudinary.com")) return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null;

    const assetParts = parts.slice(uploadIndex + 1);
    if (assetParts[0]?.startsWith("v") && /^v\d+$/.test(assetParts[0])) {
      assetParts.shift();
    }

    const publicIdWithExtension = assetParts.join("/");
    return publicIdWithExtension.replace(/\.[^.]+$/, "") || null;
  } catch {
    return null;
  }
}

export function getUserImageFolder(
  userId: string,
  kind: CloudinaryImageKind,
  draft = false,
): string {
  const folder = kind === "avatar" ? "avatar" : `${kind}s`;
  return `users/${userId}/${folder}${draft ? "/draft" : ""}`;
}

export async function promoteDraftCloudinaryAsset(
  imageUrl: string,
  userId: string,
  kind: CloudinaryImageKind,
): Promise<string | null> {
  const sourcePublicId = getCloudinaryPublicId(imageUrl);
  const draftFolder = getUserImageFolder(userId, kind, true);
  if (!sourcePublicId?.startsWith(`${draftFolder}/`)) return null;

  const fileName = sourcePublicId.slice(draftFolder.length + 1);
  const destinationPublicId = `${getUserImageFolder(userId, kind)}/${fileName}`;

  try {
    await cloudinary.uploader.rename(sourcePublicId, destinationPublicId, {
      resource_type: "image",
      type: "upload",
      invalidate: true,
    });
    return cloudinary.url(destinationPublicId, {
      secure: true,
      resource_type: "image",
      type: "upload",
    });
  } catch (error) {
    console.error("Failed to promote Cloudinary draft:", error);
    return null;
  }
}
