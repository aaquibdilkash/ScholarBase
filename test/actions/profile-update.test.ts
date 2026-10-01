/**
 * `updateProfile` had no test and sat in `PENDING_ACTION_TESTS`.
 *
 * It is the widest-blast-radius write in the app: a profile row feeds the
 * scholar directory, the author block embedded in EVERY cached content list
 * (name / handle / avatar are denormalised into those cards), and the
 * institution badge. A bad write here is not confined to one page.
 *
 * The return shape here is deliberately `{ success, message }` and NOT
 * `{ success, data }`: `EditProfileForm` toasts and then navigates to the
 * profile route, which re-fetches from the server. There is no cached list to
 * splice, so RULE 1's `setQueryData` contract does not apply. What DOES apply
 * is that the write must not silently destroy identity fields.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { updateProfile } from "@/app/actions/profile";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const USER = "u-author";

let mockCurrentUser: { id: string } | null = null;
const revalidateContent = vi.fn();
const deleteCloudinaryAsset = vi.fn(async (_url: string) => {});
const promoteDraftCloudinaryAsset = vi.fn(async (url: string) => url);

vi.mock("@/lib/auth", () => ({
  requireActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  isUserAdmin: vi.fn(async () => false),
}));
vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: (...args: unknown[]) => revalidateContent(...(args as [])),
  loadContentPage: vi.fn(async () => []),
}));
vi.mock("@/lib/cloudinary", () => ({
  deleteCloudinaryAsset: (url: string) => deleteCloudinaryAsset(url),
  promoteDraftCloudinaryAsset: (url: string) =>
    promoteDraftCloudinaryAsset(url),
  extractCloudinaryPublicId: vi.fn(() => null),
}));
vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

const row = () => fakeDb.rows("user").find((u) => u.id === USER)!;

beforeEach(() => {
  resetFakeDb();
  revalidateContent.mockClear();
  deleteCloudinaryAsset.mockClear();
  promoteDraftCloudinaryAsset.mockClear();
  mockCurrentUser = { id: USER };
  fakeDb.seed("user", {
    id: USER,
    name: "Ada Lovelace",
    handle: "ada",
    bio: "Mathematician",
    avatarUrl: null,
    githubUrl: "https://github.com/ada",
    orcidUrl: null,
    linkedinUrl: null,
    googleScholarUrl: null,
    reputation: 100,
    followersCount: 3,
    followingCount: 2,
    articleCount: 1,
    socialPostCount: 1,
    isDeleted: false,
  });
});

describe("updateProfile", () => {
  it("updates the editable fields and reports success", async () => {
    const result = await updateProfile(
      form({ name: "Ada L.", bio: "Analytical engines" }),
    );

    expect(result.success).toBe(true);
    expect(row().name).toBe("Ada L.");
    expect(row().bio).toBe("Analytical engines");
  });

  it("does not touch reputation or any materialized counter", async () => {
    // A profile edit is not a community event. If reputation moved here, the
    // vote-only reputation model would be corrupted with no vote involved.
    await updateProfile(form({ name: "Renamed" }));

    expect(row().reputation).toBe(100);
    expect(row().followersCount).toBe(3);
    expect(row().followingCount).toBe(2);
    expect(row().articleCount).toBe(1);
    expect(row().socialPostCount).toBe(1);
  });

  it("purges the cached scholar directory for this user", async () => {
    // Name / handle / avatar are denormalised into the cached directory AND
    // into the author block of every cached content list, so a stale tag here
    // shows the old name everywhere until the TTL.
    await updateProfile(form({ name: "Renamed" }));

    expect(revalidateContent).toHaveBeenCalledWith("SCHOLAR_DIRECTORY", USER);
  });

  it("normalises the handle (strips @, lowercases, trims)", async () => {
    await updateProfile(form({ handle: "  @AdaL  " }));
    expect(row().handle).toBe("adal");
  });

  it("refuses a handle already taken by another user", async () => {
    fakeDb.seed("user", { id: "u-other", handle: "taken", isDeleted: false });

    const result = await updateProfile(form({ handle: "taken" }));

    expect(result.success).toBe(false);
    expect(row().handle).toBe("ada");
  });

  it("lets a user keep their OWN handle without being blocked", async () => {
    const result = await updateProfile(form({ handle: "ada" }));

    expect(result.success).toBe(true);
    expect(row().handle).toBe("ada");
  });

  it("KEEPS the existing handle when the handle field is left blank", async () => {
    // The form always submits `handle`, so clearing that input must not wipe
    // the user's identity. A blank field means "no change", not "set null".
    const result = await updateProfile(form({ name: "Ada L.", handle: "" }));

    expect(result.success).toBe(true);
    expect(row().handle).toBe("ada");
  });

  it("still lets a user clear their bio and social links", async () => {
    // Blank-means-clear IS correct for these: emptying a bio or a link is a
    // deliberate action, and the handle case is the outlier because an empty
    // handle is not a valid identity at all.
    await updateProfile(form({ bio: "", githubUrl: "" }));

    expect(row().bio).toBe("");
    expect(row().githubUrl).toBeNull();
    expect(row().handle).toBe("ada");
  });

  it("rejects an external link that is not a valid URL", async () => {
    await expect(
      updateProfile(form({ githubUrl: "javascript:alert(1)" })),
    ).rejects.toThrow();
  });

  it("deletes the replaced avatar from Cloudinary", async () => {
    // Mutate the seeded row rather than re-seeding: seeding a second row with
    // the same id does not overwrite the first, so the assertion would pass for
    // the wrong reason.
    row().avatarUrl = "https://res.cloudinary.com/x/old.jpg";

    await updateProfile(form({ avatarUrl: "https://res.cloudinary.com/x/new.jpg" }));

    expect(promoteDraftCloudinaryAsset).toHaveBeenCalled();
    expect(deleteCloudinaryAsset).toHaveBeenCalledWith(
      "https://res.cloudinary.com/x/old.jpg",
    );
  });

  it("does not delete a Cloudinary asset when the avatar is unchanged", async () => {
    row().avatarUrl = "https://res.cloudinary.com/x/same.jpg";

    await updateProfile(form({ avatarUrl: "https://res.cloudinary.com/x/same.jpg" }));

    expect(deleteCloudinaryAsset).not.toHaveBeenCalled();
  });

  it("rejects an anonymous caller and writes nothing", async () => {
    mockCurrentUser = null;

    await expect(updateProfile(form({ name: "Hacker" }))).rejects.toThrow();
    expect(row().name).toBe("Ada Lovelace");
  });

  it("rejects an over-long bio rather than truncating it", async () => {
    await expect(
      updateProfile(form({ bio: "x".repeat(5000) })),
    ).rejects.toThrow(/exceeds/i);
  });
});
