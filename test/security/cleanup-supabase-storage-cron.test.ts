/**
 * `GET /api/cron/cleanup-supabase-storage` — the second half of blog image
 * garbage collection.
 *
 * The lifecycle for a blog image is:
 *
 *   soft delete  -> the row AND its images are kept (30-day recovery window)
 *   30 days pass -> `purge_soft_deleted_records()` hard-deletes the row and
 *                   queues the image URLs into `OrphanedAsset` BEFORE the delete
 *   this cron    -> deletes those objects from Supabase Storage and clears
 *                   the queue
 *
 * This file covers the last step, plus the authorisation gate in front of it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

let authorized = true;

vi.mock("@/lib/cron", () => ({
  verifyCronSecret: vi.fn(async () => authorized),
}));

const deleteBlogImagePathsAsServiceRole = vi.fn(async (_paths: string[]) => {});

vi.mock("@/lib/supabase-storage", () => ({
  BLOG_IMAGE_BUCKET: "blog-images",
  deleteBlogImagePathsAsServiceRole: (paths: string[]) =>
    deleteBlogImagePathsAsServiceRole(paths),
}));

vi.mock("@/utils/supabase/service", () => ({
  hasServiceRoleCredentials: vi.fn(() => true),
}));

const SUPABASE_URL = "https://api.staging.scholarbase.app";

const get = async () => {
  const { GET } = await import(
    "@/app/api/cron/cleanup-supabase-storage/route"
  );
  return GET();
};

function seedOrphan(url: string) {
  fakeDb.seed("orphanedAsset", { id: `oa-${url.length}-${Math.random()}`, url, createdAt: new Date() });
}

beforeEach(() => {
  resetFakeDb();
  vi.clearAllMocks();
  authorized = true;
});

describe("GET /api/cron/cleanup-supabase-storage", () => {
  it("rejects a request without the cron secret", async () => {
    authorized = false;

    const response = await get();

    expect(response.status).toBe(401);
    expect(deleteBlogImagePathsAsServiceRole).not.toHaveBeenCalled();
  });

  it("does nothing when the queue is empty", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      processedCount: 0,
      supabaseDeletedCount: 0,
    });
    expect(deleteBlogImagePathsAsServiceRole).not.toHaveBeenCalled();
  });

  it("deletes the queued object from Supabase Storage and clears the queue", async () => {
    seedOrphan(
      `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/u1/published/cover/abc/file.png`,
    );

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      processedCount: 1,
      supabaseDeletedCount: 1,
    });
    expect(deleteBlogImagePathsAsServiceRole).toHaveBeenCalledWith([
      "users/u1/published/cover/abc/file.png",
    ]);
    expect(fakeDb.rows("orphanedAsset")).toHaveLength(0);
  });

  it("matches by URL PATH, so a custom Supabase domain is collected too", async () => {
    // The deployment serves Storage from a custom domain, not supabase.co —
    // a host-based filter would silently match nothing.
    seedOrphan(
      `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/u1/published/cover/abc/file.png`,
    );

    const response = await get();

    expect(response.status).toBe(200);
    expect(deleteBlogImagePathsAsServiceRole).toHaveBeenCalledWith([
      "users/u1/published/cover/abc/file.png",
    ]);
  });

  it("ignores queued assets that belong to another provider", async () => {
    seedOrphan("https://res.cloudinary.com/demo/image/upload/v1/old.jpg");

    const response = await get();

    expect(response.status).toBe(200);
    expect(deleteBlogImagePathsAsServiceRole).not.toHaveBeenCalled();
  });

  it("clears a queued row whose URL cannot be parsed, so the queue cannot stall", async () => {
    seedOrphan(
      `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/u1/published/cover/abc/file.png`,
    );
    // A second row with a Supabase-looking prefix but an unparseable path.
    fakeDb.seed("orphanedAsset", {
      id: "oa-broken",
      url: "not-a-url supabase.co/storage/v1/object/public/blog-images/x",
      createdAt: new Date(),
    });

    const response = await get();

    expect(response.status).toBe(200);
    // Both rows are processed and cleared.
    expect(fakeDb.rows("orphanedAsset")).toHaveLength(0);
  });
});
