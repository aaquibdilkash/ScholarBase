/**
 * `/scholars/[id]/settings` ownership guard.
 *
 * This page renders `UpdateEmailForm currentEmail={profile.email}`,
 * `InstitutionVerificationForm`, and `DeleteAccountForm`. Without the
 * `user.id !== id` check, `/scholars/<anyone-elses-id>/settings` would serve a
 * stranger's account email and a working delete-account control. The page's
 * only defence is that one redirect, and it had NO test — an entire route
 * reachable by guessing an id.
 *
 * The page is a server component, so it is invoked as a plain async function
 * and the guards are observed through the `redirect()` they throw. That is the
 * whole contract: who may see this page, and where everyone else is sent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

/** Thrown by the mocked `redirect`, carrying where it wanted to go. */
class Redirect extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}

let sessionUser: { id: string } | null = null;

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
  }),
}));

// The browser client is pulled in transitively by one of the forms on this page
// and pulls `@supabase/ssr`, which validates the project URL at import time.
// The page under test never calls it.
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const ALICE = "u-alice";
const BOB = "u-bob";

const seedUsers = () => {
  fakeDb.seed("user", [
    {
      id: ALICE,
      email: "alice@uni.edu",
      name: "Alice",
      handle: "alice",
      isDeleted: false,
    },
    {
      id: BOB,
      email: "bob@uni.edu",
      name: "Bob",
      handle: "bob",
      isDeleted: false,
    },
  ]);
};

/** Runs the page and reports the redirect target, or null if it rendered. */
const run = async (id: string) => {
  const mod = await import("@/app/scholars/[id]/settings/page");
  const Page = mod.default;
  try {
    await Page({ params: Promise.resolve({ id }) });
    return null;
  } catch (error) {
    if (error instanceof Redirect) return error.to;
    throw error;
  }
};

beforeEach(() => {
  resetFakeDb();
  sessionUser = { id: ALICE };
  seedUsers();
});

describe("/scholars/[id]/settings access control", () => {
  it("renders for the owner", async () => {
    // No redirect at all: this is the one path that is allowed through.
    expect(await run(ALICE)).toBeNull();
  });

  it("sends a visitor to their OWN settings instead of someone else's", async () => {
    const to = await run(BOB);

    // Critically, it redirects to the VIEWER's settings, not to Bob's. A
    // redirect to `/scholars/BOB/settings` would be an infinite loop.
    expect(to).toBe(`/scholars/${ALICE}/settings`);
  });

  it("never serves another user's account email", async () => {
    await expect(run(BOB)).resolves.toBe(`/scholars/${ALICE}/settings`);

    // Belt and braces: Bob's email is in the database, and a regression that
    // dropped the guard would render it.
    const bob = fakeDb.rows("user").find((u) => u.id === BOB)!;
    expect(bob.email).toBe("bob@uni.edu");
  });

  it("sends an anonymous visitor to login", async () => {
    sessionUser = null;
    expect(await run(ALICE)).toBe("/login");
  });

  it("sends an anonymous visitor to login even for a guessed id", async () => {
    sessionUser = null;
    expect(await run(BOB)).toBe("/login");
  });

  it("sends an owner to login when their profile row is gone", async () => {
    // Auth session exists but the ScholarBase row does not (e.g. a half-created
    // account). Rendering `profile.email` off a null profile would crash.
    resetFakeDb();
    seedUsers();
    fakeDb.rows("user").splice(
      0,
      fakeDb.rows("user").length,
      ...fakeDb.rows("user").filter((u) => u.id === BOB),
    );

    expect(await run(ALICE)).toBe("/login");
  });
});
