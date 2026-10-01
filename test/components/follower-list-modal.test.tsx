/**
 * @vitest-environment jsdom
 *
 * Followers / Following list on a scholar profile.
 *
 * Regression: the modal rendered as an empty list. `FollowerCount` mounted
 * `UserListModal` conditionally, already open, so `AppendMoreList` received
 * `reloadToken="<id>:followers"` on its very first render. That component only
 * fetches page 1 when the token *changes*, its ref is seeded with the initial
 * value, so the change-check never fired — no fetch, no rows, and an empty list
 * has nothing to scroll to trigger the load-more sentinel either. The profile
 * showed "12 followers" and the modal said "No users found."
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FollowerCount } from "@/app/scholars/[id]/FollowerCount";
import { ToastProvider } from "@/components/ui/Toast";

const FOLLOWERS = [
  { id: "f1", name: "Ada Lovelace", handle: "ada", avatarUrl: null },
  { id: "f2", name: "Grace Hopper", handle: "grace", avatarUrl: null },
];

const getFollowersWithCursor = vi.fn(async () => ({
  users: FOLLOWERS.map((u) => ({ ...u, isFollowing: false })),
  nextCursor: null,
  hasMore: false,
}));

const getFollowingWithCursor = vi.fn(async () => ({
  users: [{ id: "f3", name: "Alan Turing", handle: "alan", avatarUrl: null, isFollowing: true }],
  nextCursor: null,
  hasMore: false,
}));

vi.mock("@/app/actions/follow", () => ({
  getFollowersWithCursor: (...args: unknown[]) =>
    (getFollowersWithCursor as (...a: unknown[]) => unknown)(...args),
  getFollowingWithCursor: (...args: unknown[]) =>
    (getFollowingWithCursor as (...a: unknown[]) => unknown)(...args),
  toggleFollow: vi.fn(async () => ({ success: true, isFollowing: true })),
}));

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/**
 * jsdom ships the `<dialog>` element but not its modal methods, so
 * `showModal`/`close`/`open` are stubbed here. `UserListModal` opens the dialog
 * imperatively and reads `.open` back to decide whether to close it, so the
 * stub has to keep real state rather than just no-op.
 */
const openDialogs = new WeakSet<HTMLDialogElement>();
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "open", {
    configurable: true,
    get(this: HTMLDialogElement) {
      return openDialogs.has(this);
    },
  });
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    openDialogs.add(this);
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    openDialogs.delete(this);
  };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  getFollowersWithCursor.mockClear();
  getFollowingWithCursor.mockClear();
  // @ts-expect-error — test stub for an API jsdom does not provide.
  globalThis.IntersectionObserver = NoopIntersectionObserver;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(props: {
  followerCount: number;
  followingCount: number;
}) {
  await act(async () => {
    root.render(
      <ToastProvider>
        <FollowerCount
          followerCount={props.followerCount}
          followingCount={props.followingCount}
          profileId="u-profile"
          currentUserId="u-viewer"
        />
      </ToastProvider>,
    );
  });
}

/** Click the button whose label starts with the given text. */
async function clickButton(prefix: string) {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.trim().startsWith(prefix),
  );
  if (!button) throw new Error(`no button starting with "${prefix}"`);
  await act(async () => {
    button.click();
  });
}

/** Close the open dialog via its header X button. */
async function closeModal() {
  const closeButton = container.querySelector<HTMLButtonElement>("dialog button");
  if (!closeButton) throw new Error("no close button in dialog");
  await act(async () => {
    closeButton.click();
  });
}

describe("followers / following list", () => {
  it("fetches and renders followers when the modal opens", async () => {
    await render({ followerCount: 2, followingCount: 1 });

    await clickButton("2 followers");

    expect(getFollowersWithCursor).toHaveBeenCalledWith("u-profile", 10, undefined);
    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).toContain("Grace Hopper");
  });

  it("fetches and renders following when that button opens the modal", async () => {
    await render({ followerCount: 2, followingCount: 1 });

    await clickButton("1 following");

    expect(getFollowingWithCursor).toHaveBeenCalledWith("u-profile", 10, undefined);
    expect(container.textContent).toContain("Alan Turing");
  });

  it("does not fetch on mount — only when a list is actually opened", async () => {
    await render({ followerCount: 2, followingCount: 1 });
    expect(getFollowersWithCursor).not.toHaveBeenCalled();
    expect(getFollowingWithCursor).not.toHaveBeenCalled();
  });

  it("refetches followers each time the modal is reopened", async () => {
    await render({ followerCount: 2, followingCount: 1 });

    await clickButton("2 followers");
    expect(getFollowersWithCursor).toHaveBeenCalledTimes(1);

    await closeModal();
    await clickButton("2 followers");
    expect(getFollowersWithCursor).toHaveBeenCalledTimes(2);
  });

  it("swaps content when switching between followers and following", async () => {
    await render({ followerCount: 2, followingCount: 1 });

    await clickButton("2 followers");
    expect(container.textContent).toContain("Ada Lovelace");

    await clickButton("1 following");
    expect(container.textContent).toContain("Alan Turing");
  });
});
