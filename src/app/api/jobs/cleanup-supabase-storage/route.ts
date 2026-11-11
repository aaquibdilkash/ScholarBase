import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { deleteBlogImagePaths } from "@/lib/supabase-storage";

/**
 * Extracts the Supabase Storage path from a public URL.
 *
 * Example:
 * https://project.supabase.co/storage/v1/object/public/blog-images/users/u123/drafts/cover/abc/file.jpg
 * -> "users/u123/drafts/cover/abc/file.jpg"
 */
function extractStoragePath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const prefix = `/public/blog-images/`;
    const idx = parsed.pathname.indexOf(prefix);
    if (idx === -1) return null;
    return parsed.pathname.slice(idx + prefix.length);
  } catch {
    return null;
  }
}

async function handler(_req: Request) {
  try {
    // 1. Fetch up to 100 orphaned Supabase Storage assets to process
    const orphanedAssets = await prisma.orphanedAsset.findMany({
      take: 100,
      orderBy: { createdAt: "asc" },
      where: {
        url: {
          contains: "supabase.co/storage/v1/object/public/blog-images",
        },
      },
    });

    if (orphanedAssets.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No orphaned Supabase Storage assets pending deletion.",
      });
    }

    // 2. Extract valid storage paths from the stored URLs
    const paths: string[] = [];
    for (const asset of orphanedAssets) {
      const path = extractStoragePath(asset.url);
      if (path) {
        paths.push(path);
      }
    }

    // 3. Delete from Supabase Storage in a single batch call
    if (paths.length > 0) {
      await deleteBlogImagePaths(paths);
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
      supabaseDeletedCount: paths.length,
    });
  } catch (error) {
    console.error("[Cleanup Supabase Storage Job Error]:", error);
    return NextResponse.json(
      { success: false, error: "Supabase Storage cleanup worker failed." },
      { status: 500 }
    );
  }
}

// Secure the endpoint so only QStash can trigger it
export const POST = verifySignatureAppRouter(handler);
