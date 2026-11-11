/**
 * Blog image upload / delete / promote.
 *
 * These are the write paths behind the Research Blog composer:
 *
 *   uploadBlogImageAction  -> uploads a client-compressed file to Supabase
 *                             Storage under the uploader's own draft folder
 *   deleteDraftBlogImage   -> removes a draft object, refusing anything that
 *                             is not inside the caller's own draft folder
 *   promoteBlogImages      -> copies drafts to the published folder and
 *                             rewrites the HTML body to the published URLs
 *
 * The security-relevant behaviour is the folder scoping: a user must never be
 * able to delete (or publish) an object that belongs to somebody else, and the
 * size ceilings must hold on the server even though the browser compresses
 * first.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  uploadContentImageAction,
  deleteDraftContentImage,
} from "@/app/actions/content-images";
import { promoteContentImages, findRemovedImagePaths } from "@/lib/content-images";

const USER = "u-author";
const OTHER = "u-stranger";
const SUPABASE_URL = "https://storage.test";

let mockCurrentUser: { id: string } | null = null;
let mockFrozen = false;

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    if (mockFrozen) {
      return { frozen: true, message: "Your account is frozen." };
    }
    return { frozen: false, user: mockCurrentUser };
  }),
  requireCurrentUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
}));

const uploadBlogImage = vi.fn(
  async ({
    userId,
    buffer,
    fileName,
    kind,
  }: {
    userId: string;
    buffer: Buffer;
    fileName: string;
    kind: string;
    fileType: string;
  }) => ({
    url: `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${userId}/drafts/${kind}/uuid/${fileName}`,
    path: `users/${userId}/drafts/${kind}/uuid/${fileName}`,
    bytes: buffer.length,
  }),
);

const deleteBlogImagePaths = vi.fn(async (_paths: string[]) => {});
const publishBlogImage = vi.fn(
  async ({ userId, draftPath, kind }: { userId: string; draftPath: string; kind: string }) =>
    `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${userId}/published/${kind}/${draftPath.split("/").slice(-2).join("/")}`,
);

vi.mock("@/lib/supabase-storage", () => ({
  BLOG_IMAGE_BUCKET: "blog-images",
  uploadBlogImage: (args: Parameters<typeof uploadBlogImage>[0]) =>
    uploadBlogImage(args),
  deleteBlogImagePaths: (paths: string[]) => deleteBlogImagePaths(paths),
  publishBlogImage: (args: Parameters<typeof publishBlogImage>[0]) =>
    publishBlogImage(args),
  extractCoverImagePath: (url: string | null | undefined) => {
    if (!url) return null;
    const match = url.match(/\/public\/blog-images\/(.+)$/);
    return match ? match[1] : null;
  },
  extractBlogImageUrlsFromHtml: (html: string) => {
    const refs: { url: string; path: string }[] = [];
    const regex = /<img[^>]+src="([^"]*storage\/v1\/object\/public\/blog-images\/[^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      const path = url.match(/\/public\/blog-images\/(.+)$/);
      if (path) refs.push({ url, path: path[1] });
    }
    return refs;
  },
  extractBlogImagePathsFromHtml: (html: string) => {
    const refs: { url: string; path: string }[] = [];
    const regex = /<img[^>]+src="([^"]*storage\/v1\/object\/public\/blog-images\/[^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      const path = url.match(/\/public\/blog-images\/(.+)$/);
      if (path) refs.push({ url, path: path[1] });
    }
    return refs.map((r) => r.path);
  },
}));

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_STORED_BYTES = 500 * 1024;

function imageFile(
  bytes: number,
  type = "image/png",
  name = "photo.png",
): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function formWith(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCurrentUser = { id: USER };
  mockFrozen = false;
});

describe("uploadBlogImageAction", () => {
  it("uploads an image into the caller's own draft folder", async () => {
    const result = await uploadContentImageAction(
      formWith(imageFile(1024)),
      "article-cover",
    );

    expect(result).not.toHaveProperty("success");
    expect(uploadBlogImage).toHaveBeenCalledTimes(1);
    const args = uploadBlogImage.mock.calls[0][0];
    expect(args.userId).toBe(USER);
    expect(args.kind).toBe("article-cover");
    expect(args.fileName).toBe("photo.png");
    expect(args.fileType).toBe("image/png");
    expect(args.buffer.length).toBe(1024);
  });

  it("passes the real MIME type so Storage stores it as an image", async () => {
    await uploadContentImageAction(formWith(imageFile(64, "image/jpeg", "a.jpg")), "article-inline");

    expect(uploadBlogImage.mock.calls[0][0].fileType).toBe("image/jpeg");
  });

  it("rejects a non-image file type", async () => {
    const result = await uploadContentImageAction(
      formWith(new File(["hello"], "note.txt", { type: "text/plain" })),
      "article-cover",
    );

    expect(result).toMatchObject({ success: false });
    expect(uploadBlogImage).not.toHaveBeenCalled();
  });

  it("rejects a file over the raw 5 MB ceiling", async () => {
    const result = await uploadContentImageAction(
      formWith(imageFile(MAX_FILE_BYTES + 1)),
      "article-cover",
    );

    expect(result).toMatchObject({ success: false });
    expect(uploadBlogImage).not.toHaveBeenCalled();
  });

  it("rejects a file over the stored-byte budget even when it is under the raw ceiling", async () => {
    const result = await uploadContentImageAction(
      formWith(imageFile(MAX_STORED_BYTES + 1)),
      "article-cover",
    );

    expect(result).toMatchObject({ success: false });
    expect(uploadBlogImage).not.toHaveBeenCalled();
  });

  it("rejects a request with no file at all", async () => {
    const result = await uploadContentImageAction(new FormData(), "article-cover");

    expect(result).toMatchObject({ success: false });
    expect(uploadBlogImage).not.toHaveBeenCalled();
  });

  it("refuses a frozen account", async () => {
    mockFrozen = true;

    const result = await uploadContentImageAction(formWith(imageFile(64)), "article-cover");

    expect(result).toMatchObject({ success: false });
    expect(uploadBlogImage).not.toHaveBeenCalled();
  });

  it("allows a frozen account when the caller opts in", async () => {
    mockFrozen = true;

    const result = await uploadContentImageAction(formWith(imageFile(64)), "article-cover", {
      allowFrozen: true,
    });

    expect(result).not.toHaveProperty("success");
    expect(uploadBlogImage).toHaveBeenCalledTimes(1);
  });
});

describe("deleteDraftBlogImage", () => {
  it("is a no-op for a null url", async () => {
    await expect(deleteDraftContentImage(null)).resolves.toBe(true);
    expect(deleteBlogImagePaths).not.toHaveBeenCalled();
  });

  it("deletes an object inside the caller's own draft folder", async () => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${USER}/drafts/cover/uuid/photo.png`;

    await expect(deleteDraftContentImage(url)).resolves.toBe(true);
    expect(deleteBlogImagePaths).toHaveBeenCalledWith([
      `users/${USER}/drafts/cover/uuid/photo.png`,
    ]);
  });

  it("refuses to delete an object in another user's folder", async () => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${OTHER}/drafts/cover/uuid/photo.png`;

    await expect(deleteDraftContentImage(url)).resolves.toBe(false);
    expect(deleteBlogImagePaths).not.toHaveBeenCalled();
  });

  it("refuses to delete an already-published object", async () => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${USER}/published/cover/photo.png`;

    await expect(deleteDraftContentImage(url)).resolves.toBe(false);
    expect(deleteBlogImagePaths).not.toHaveBeenCalled();
  });
});

describe("findRemovedImagePaths", () => {
  const img = (path: string) =>
    `<img src="${SUPABASE_URL}/storage/v1/object/public/blog-images/${path}" />`;

  it("reports nothing when the body did not change", () => {
    const body = `<p>a</p>${img(`users/${USER}/published/inline/fig.png`)}`;

    expect(findRemovedImagePaths(body, body)).toEqual([]);
  });

  it("reports an inline image that was deleted from the body", () => {
    const oldBody = `<p>a</p>${img(`users/${USER}/published/inline/fig.png`)}`;
    const newBody = "<p>a</p>";

    expect(findRemovedImagePaths(oldBody, newBody)).toEqual([
      `users/${USER}/published/inline/fig.png`,
    ]);
  });

  it("keeps an image that is still in the body", () => {
    const kept = img(`users/${USER}/published/inline/fig.png`);
    const oldBody = `${kept}<p>a</p>`;
    const newBody = `<p>a</p>${kept}`;

    expect(findRemovedImagePaths(oldBody, newBody)).toEqual([]);
  });

  it("reports only the image that was removed when one of two is deleted", () => {
    const keep = img(`users/${USER}/published/inline/keep.png`);
    const drop = img(`users/${USER}/published/inline/drop.png`);

    expect(findRemovedImagePaths(keep + drop, keep)).toEqual([
      `users/${USER}/published/inline/drop.png`,
    ]);
  });

  it("recognises a legacy escaped image as removed", () => {
    const oldBody = `&lt;img src="${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${USER}/published/inline/fig.png" /&gt;`;

    expect(findRemovedImagePaths(oldBody, "<p>a</p>")).toEqual([
      `users/${USER}/published/inline/fig.png`,
    ]);
  });

  it("does not treat a legacy escaped image as newly added", () => {
    const body = `&lt;img src="${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${USER}/published/inline/fig.png" /&gt;`;

    expect(findRemovedImagePaths(body, body)).toEqual([]);
  });
});

describe("promoteContentImages", () => {
  it("publishes the cover image and returns the published url", async () => {
    const coverUrl = `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${USER}/drafts/cover/uuid/photo.png`;

    const result = await promoteContentImages({
      coverKind: "article-cover",
      imageUrl: coverUrl,
      html: "<p>hello</p>",
      userId: USER,
    });

    expect(publishBlogImage).toHaveBeenCalledWith({
      userId: USER,
      draftPath: `users/${USER}/drafts/cover/uuid/photo.png`,
      kind: "article-cover",
    });
    expect(result.coverUrl).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${USER}/published/article-cover/uuid/photo.png`,
    );
    expect(result.publishedHtml).toBe("<p>hello</p>");
  });

  it("leaves a non-Supabase cover url untouched", async () => {
    const result = await promoteContentImages({
      coverKind: "article-cover",
      imageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
      html: "<p>hello</p>",
      userId: USER,
    });

    expect(result.coverUrl).toBe("https://res.cloudinary.com/demo/image/upload/old.jpg");
    expect(publishBlogImage).not.toHaveBeenCalled();
  });

  it("does not re-publish an already published cover image", async () => {
    // Editing an article without replacing the cover sends the PUBLISHED url
    // back. Re-copying it onto its own published path fails with
    // "The resource already exists", so it must be left alone.
    const publishedCover = `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${USER}/published/cover/photo.png`;

    const result = await promoteContentImages({
      coverKind: "article-cover",
      imageUrl: publishedCover,
      html: "<p>hello</p>",
      userId: USER,
    });

    expect(publishBlogImage).not.toHaveBeenCalled();
    expect(result.coverUrl).toBe(publishedCover);
  });

  it("does not re-publish an inline image that is already published", async () => {
    const publishedSrc = `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${USER}/published/inline/fig.png`;
    const html = `<img src="${publishedSrc}" alt="fig" />`;

    const result = await promoteContentImages({
      coverKind: "article-cover",
      inlineKind: "article-inline",
      imageUrl: null,
      html,
      userId: USER,
    });

    expect(publishBlogImage).not.toHaveBeenCalled();
    expect(result.publishedHtml).toBe(html);
  });

  it("rewrites inline draft image urls in the body to their published urls", async () => {
    const draftSrc = `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${USER}/drafts/inline/uuid/fig.png`;
    const html = `<p>before</p><img src="${draftSrc}" alt="fig" />`;

    const result = await promoteContentImages({
      coverKind: "article-cover",
      inlineKind: "article-inline",
      imageUrl: null,
      html,
      userId: USER,
    });

    expect(publishBlogImage).toHaveBeenCalledWith({
      userId: USER,
      draftPath: `users/${USER}/drafts/inline/uuid/fig.png`,
      kind: "article-inline",
    });
    expect(result.publishedHtml).not.toContain("/drafts/");
    expect(result.publishedHtml).toContain(
      `/published/article-inline/uuid/fig.png`,
    );
    expect(result.publishedHtml).toContain("<p>before</p>");
  });

  it("returns a null cover when no image was supplied", async () => {
    const result = await promoteContentImages({
      coverKind: "article-cover",
      imageUrl: null,
      html: "<p>hello</p>",
      userId: USER,
    });

    expect(result.coverUrl).toBeNull();
    expect(result.publishedHtml).toBe("<p>hello</p>");
  });
});
