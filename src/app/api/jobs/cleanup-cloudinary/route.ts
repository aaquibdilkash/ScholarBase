import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name:
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Extracts the Cloudinary public_id from a secure delivery URL.
 * Handles folder paths and strips transformation / versioning segments.
 *
 * Example:
 * https://res.cloudinary.com/demo/image/upload/v1612345678/users/u123/social/photo.png
 * -> "users/u123/social/photo"
 */
function extractPublicId(url: string): string | null {
  try {
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;

    let path = parts[1];

    // Strip version tag (e.g., v1725800000/)
    const versionMatch = path.match(/v\d+\/(.+)$/);
    if (versionMatch && versionMatch[1]) {
      path = versionMatch[1];
    }

    // Strip file extension
    const lastDotIndex = path.lastIndexOf(".");
    return lastDotIndex !== -1 ? path.substring(0, lastDotIndex) : path;
  } catch {
    return null;
  }
}

async function handler(req: Request) {
  try {
    // 1. Fetch up to 100 orphaned assets to process within Cloudinary's batch limit
    const orphanedAssets = await prisma.orphanedAsset.findMany({
      take: 100,
      orderBy: { createdAt: "asc" },
    });

    if (orphanedAssets.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No orphaned assets pending deletion.",
      });
    }

    // 2. Extract valid public IDs from the stored URLs
    const publicIds: string[] = [];
    for (const asset of orphanedAssets) {
      const publicId = extractPublicId(asset.url);
      if (publicId) {
        publicIds.push(publicId);
      }
    }

    // 3. Delete from Cloudinary in a single batch API call
    if (publicIds.length > 0) {
      await cloudinary.api.delete_resources(publicIds);
    }

    // 4. Remove processed rows from the database (including unparseable URLs to prevent stuck queues)
    await prisma.orphanedAsset.deleteMany({
      where: {
        id: { in: orphanedAssets.map((a) => a.id) },
      },
    });

    return NextResponse.json({
      success: true,
      processedCount: orphanedAssets.length,
      cloudinaryDeletedCount: publicIds.length,
    });
  } catch (error) {
    console.error("[Cleanup Cloudinary Job Error]:", error);
    return NextResponse.json(
      { success: false, error: "Cloudinary cleanup worker failed." },
      { status: 500 }
    );
  }
}

// Secure the endpoint so only QStash can trigger it
export const POST = verifySignatureAppRouter(handler);