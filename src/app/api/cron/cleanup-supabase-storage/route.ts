import 'server-only';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyCronSecret } from '@/lib/cron';
import { deleteBlogImagePathsAsServiceRole } from '@/lib/supabase-storage';
import { hasServiceRoleCredentials } from '@/utils/supabase/service';

export const revalidate = 0;

/**
 * Extracts the Supabase Storage path from a public URL.
 *
 * Example:
 * https://project.supabase.co/storage/v1/object/public/blog-images/users/u123/published/cover/abc/file.jpg
 * -> "users/u123/published/cover/abc/file.jpg"
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

/**
 * Cron: deletes orphaned Supabase Storage objects.
 *
 * The 30-day trim cron (`purge_soft_deleted_records`) hard-deletes content
 * whose soft delete has aged out, and queues the image URLs those rows
 * referenced into the `OrphanedAsset` table BEFORE the delete. This job
 * removes those objects from Supabase Storage and clears the queue.
 *
 * Scheduled from Coolify (a scheduled task calling this route with the
 * `CRON_SECRET` bearer token), not from QStash, so it runs on a plain
 * interval instead of per-publish.
 *
 * Safe to run repeatedly: rows are removed once processed, and a Storage
 * delete for an object that is already gone is a no-op.
 */
export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // The job deletes published objects belonging to users who are not signed
  // in, so it needs the service role (which bypasses RLS). Without it the
  // delete would be rejected by policy.
  if (!hasServiceRoleCredentials()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'SUPABASE_SERVICE_ROLE_KEY is not configured. The cleanup job needs it to delete orphaned objects.',
      },
      { status: 500 },
    );
  }

  try {
    // 1. Fetch up to 100 orphaned Supabase Storage assets to process
    const orphanedAssets = await prisma.orphanedAsset.findMany({
      take: 100,
      orderBy: { createdAt: 'asc' },
      where: {
        url: {
          // Match the PATH, not the host: the deployment serves Supabase
          // Storage from a custom domain (`api.staging.scholarbase.app`),
          // not `supabase.co`. Only the path segment is stable.
          contains: '/storage/v1/object/public/blog-images',
        },
      },
    });

    if (orphanedAssets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphaned Supabase Storage assets pending deletion.',
        processedCount: 0,
        supabaseDeletedCount: 0,
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
      await deleteBlogImagePathsAsServiceRole(paths);
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
    console.error('[Cron] Failed to clean up Supabase Storage assets:', error);
    return NextResponse.json(
      { success: false, error: 'Supabase Storage cleanup failed.' },
      { status: 500 },
    );
  }
}
