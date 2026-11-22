/**
 * Scholar Suggest cover image wiring.
 *
 * The form uploads to the uploader's draft folder, so create/update must
 * promote the draft before writing the row and collect the replaced cover only
 * after the edit is persisted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { createHelpPost, updateHelpPost } from "@/app/actions/help";
import { promoteContentImages } from "@/lib/content-images";
import {
  deleteContentImagePaths,
  extractCoverImagePath,
} from "@/lib/supabase-storage";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const DRAFT_COVER = "https://cdn.example.org/drafts/help-cover/new.png";
const PUBLISHED_COVER = "https://cdn.example.org/published/help-cover/new.png";
const OLD_COVER = "https://cdn.example.org/published/help-cover/old.png";

let mockCurrentUser: { id: string } | null = null;

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return { frozen: false, user: mockCurrentUser, message: "" };
  }),
  requireCurrentUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  isAuthorizedOrAdmin: vi.fn(
    async (ownerId: string, userId: string) => ownerId === userId,
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: true })),
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    limited: false,
    degraded: false,
  })),
}));

vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
  loadContentPage: vi.fn(async () => []),
}));

vi.mock("@/lib/tri-split/modules/profile-tab", () => ({
  revalidateBookmarkersForDeletedContent: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyFollowersOfActivity: vi.fn(async () => {}),
  deleteAllNotificationsForContent: vi.fn(async () => {}),
}));

vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));

vi.mock("@/lib/content-images", () => ({
  promoteContentImages: vi.fn(),
}));

vi.mock("@/lib/supabase-storage", () => ({
  extractCoverImagePath: vi.fn(),
  deleteContentImagePaths: vi.fn(async () => {}),
}));

const formOf = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
};

const baseFields = (overrides: Record<string, string> = {}) => ({
  title: "Help needed",
  subject: "Question",
  category: "GENERAL",
  message: "<p>Details</p>",
  ...overrides,
});

describe("help post cover image", () => {
  beforeEach(() => {
    resetFakeDb();
    mockCurrentUser = { id: AUTHOR };
    vi.mocked(promoteContentImages).mockReset();
    vi.mocked(deleteContentImagePaths).mockClear();
    vi.mocked(extractCoverImagePath).mockImplementation((url) =>
      url ? url.replace("https://cdn.example.org/", "") : null,
    );
    fakeDb.seed("user", [
      {
        id: AUTHOR,
        isDeleted: false,
        name: "Author",
        handle: "author",
        reputation: 0,
      },
    ]);
  });

  it("promotes the draft cover before creating the post", async () => {
    vi.mocked(promoteContentImages).mockResolvedValueOnce({
      ok: true,
      coverUrl: PUBLISHED_COVER,
      publishedHtml: "<p>Details</p>",
    });

    const result = await createHelpPost(
      formOf(baseFields({ coverImageUrl: DRAFT_COVER })),
    );

    expect(result.success).toBe(true);
    expect(promoteContentImages).toHaveBeenCalledWith({
      coverKind: "help-cover",
      imageUrl: DRAFT_COVER,
      html: "<p>Details</p>",
      userId: AUTHOR,
    });
    expect(fakeDb.rows("helpPost")[0].imageUrl).toBe(PUBLISHED_COVER);
  });

  it("stores the promoted cover on edit and collects the replaced one", async () => {
    fakeDb.seed("helpPost", [
      { id: "help-1", authorId: AUTHOR, imageUrl: OLD_COVER },
    ]);
    vi.mocked(promoteContentImages).mockResolvedValueOnce({
      ok: true,
      coverUrl: PUBLISHED_COVER,
      publishedHtml: "<p>Details</p>",
    });

    const result = await updateHelpPost(
      formOf(baseFields({ coverImageUrl: DRAFT_COVER })),
      "help-1",
    );

    expect(result.success).toBe(true);
    expect(fakeDb.rows("helpPost")[0].imageUrl).toBe(PUBLISHED_COVER);
    expect(deleteContentImagePaths).toHaveBeenCalledWith([
      "published/help-cover/old.png",
    ]);
  });

  it("clears the cover and collects the old image when it is removed", async () => {
    fakeDb.seed("helpPost", [
      { id: "help-1", authorId: AUTHOR, imageUrl: OLD_COVER },
    ]);
    vi.mocked(promoteContentImages).mockResolvedValueOnce({
      ok: true,
      coverUrl: null,
      publishedHtml: "<p>Details</p>",
    });

    const result = await updateHelpPost(formOf(baseFields()), "help-1");

    expect(result.success).toBe(true);
    expect(fakeDb.rows("helpPost")[0].imageUrl).toBeNull();
    expect(deleteContentImagePaths).toHaveBeenCalledWith([
      "published/help-cover/old.png",
    ]);
  });
});
