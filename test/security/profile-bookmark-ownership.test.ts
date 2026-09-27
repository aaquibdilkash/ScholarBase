/**
 * The bookmarks tab is own-profile only.
 *
 * That was enforced purely in the client: `ProfileTabs` hides the tab and
 * redirects, but `getProfileBookmarkSections` and `getProfileBookmarkSection`
 * are `"use server"` exports, so they are public HTTP endpoints. Before this
 * was fixed, either one would hand any caller any user's bookmarked content —
 * titles, bodies, and the viewer's own vote/bookmark state on top of it —
 * simply by passing someone else's id.
 *
 * These tests pin the server-side rule: the session decides whose bookmarks
 * are read, and the `profileId` argument cannot widen that.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let viewer: { id: string } | null = { id: "u-viewer" };

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => viewer),
  requireActiveUser: vi.fn(async () => {
    throw new Error("not used");
  }),
}));

// `profile.ts` imports these for the edit-profile path, which none of these
// tests touch; they pull in `server-only` and the scholars cache respectively.
vi.mock("@/lib/cloudinary", () => ({
  deleteCloudinaryAsset: vi.fn(async () => {}),
  promoteDraftCloudinaryAsset: vi.fn(async () => null),
}));
vi.mock("@/lib/tri-split/modules/scholar", () => ({
  revalidateScholars: vi.fn(),
}));

const findMany = vi.fn(async (_args?: { where?: { userId?: string } }) => []);
const counters = { articleCount: 0, socialPostCount: 0 };

vi.mock("@/lib/db", () => ({
  default: {
    user: { findUnique: vi.fn(async () => counters) },
    articleBookmark: { findMany, count: vi.fn(async () => 0) },
  },
}));

// The tabs are built by the Tri-Split cached loaders, so the boundary that has
// to be pinned is the arguments `profile.ts` hands them: the owner of the
// bookmark rows, and the viewer whose state is overlaid. Both must come from the
// session — never from the caller's `profileId`.
const loadProfileBookmarkTab = vi.fn(
  async (_args: { ownerId: string; take?: number; viewerId: string | null }) => ({
    items: {},
    counts: {},
  }),
);
const loadProfileContentTab = vi.fn(
  async (_args: { profileId: string; take?: number; viewerId: string | null }) => ({
    sections: {},
    counts: {},
  }),
);

vi.mock("@/lib/tri-split/modules/profile-tab", () => ({
  loadProfileBookmarkTab: (args: never) => loadProfileBookmarkTab(args),
  loadProfileContentTab: (args: never) => loadProfileContentTab(args),
}));

// Imported after the mocks so the module graph picks them up.
const {
  getProfileBookmarkSections,
  getProfileBookmarkSection,
  getProfileSections,
} = await import("@/app/actions/profile");

const VIEWER = "u-viewer";
const VICTIM = "u-victim";

describe("bookmark ownership is decided by the session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewer = { id: VIEWER };
  });

  it("reads the viewer's own bookmarks, not the requested profile's", async () => {
    await getProfileBookmarkSections(VICTIM);

    // The owner passed to the cached loader is the session user. Passing VICTIM
    // here is exactly the attack the client-side tab gate used to permit.
    expect(loadProfileBookmarkTab).toHaveBeenCalledTimes(1);
    const bookmarkArgs = loadProfileBookmarkTab.mock.calls[0][0];
    expect(bookmarkArgs.ownerId).toBe(VIEWER);
    // And the viewer whose state gets overlaid is the session user too.
    expect(bookmarkArgs.viewerId).toBe(VIEWER);
  });

  it("paginates the viewer's own bookmarks too", async () => {
    await getProfileBookmarkSection(VICTIM, "articles");

    // The Prisma path scopes by `userId`; this is the value it used.
    expect(findMany).toHaveBeenCalledTimes(1);
    const callArg = findMany.mock.calls[0][0] as { where?: { userId?: string } };
    expect(callArg.where?.userId).toBe(VIEWER);
  });

  it("returns nothing to a signed-out caller", async () => {
    viewer = null;

    const sections = await getProfileBookmarkSections(VICTIM);
    const page = await getProfileBookmarkSection(VICTIM, "articles");

    expect(page).toEqual([]);
    // No query at all — a null session must not fall back to the argument.
    expect(loadProfileBookmarkTab).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
    expect(Object.values(sections.counts).every((n) => n === 0)).toBe(true);
  });

  it("still returns a full, empty section shape when signed out", async () => {
    // The tab renders 17 headings from these keys; a sparse object would render
    // as `undefined` counts rather than zero.
    viewer = null;
    const sections = await getProfileBookmarkSections(VIEWER);

    for (const key of ["articles", "socialPosts", "journalReviews", "courses"]) {
      expect(sections, key).toHaveProperty(key);
      expect((sections as Record<string, unknown>)[key], key).toEqual([]);
    }
  });
});

describe("content tab identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewer = { id: VIEWER };
  });

  it("overlays the session viewer's state, ignoring any caller-supplied id", async () => {
    // Content is public, so `profileId` is legitimately caller-chosen — but
    // the viewer's vote/bookmark overlay must still come from the session.
    await getProfileSections(VICTIM, 1);

    expect(loadProfileContentTab).toHaveBeenCalledTimes(1);
    const contentCall = loadProfileContentTab.mock.calls[0][0];
    // Content is public, so the profile id stays the caller's — but the overlay
    // is resolved for the session viewer, never for the id in the request.
    expect(contentCall.profileId).toBe(VICTIM);
    expect(contentCall.viewerId).toBe(VIEWER);
  });
});
