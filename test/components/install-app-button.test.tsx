/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { InstallStatus } from "@/components/pwa/PwaInstallProvider";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";

// The real provider waits on the browser's `beforeinstallprompt`, which jsdom
// never fires. Mocking the context hook keeps these tests aimed at what actually
// matters — that the button offers the right affordance per status, calls the
// right handler, and disappears rather than rendering a dead control.
const install = vi.fn();
let status: InstallStatus = "installable";
let isWorking = false;
// Kept separate from `status` so a test can express "installed" without also
// having to reason about which status value that implies.
let installed = false;
let canInstall = true;

vi.mock("@/components/pwa/PwaInstallProvider", () => ({
  usePwaInstall: () => ({
    status,
    isWorking,
    isInstalled: installed,
    canPrompt: canInstall && status === "installable",
    canNeverInstall: !canInstall,
    isManualOnly: status === "manual",
    install,
  }),
}));

describe("InstallAppButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    install.mockClear();
    status = "installable";
    isWorking = false;
    installed = false;
    canInstall = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const draw = (element: React.ReactElement) =>
    act(() => {
      root.render(element);
    });

  const control = () => container.querySelector("button");

  it("offers a one-click install when the browser can install", () => {
    draw(<InstallAppButton variant="settings" />);

    expect(control()).not.toBeNull();
    expect(container.textContent).toContain("Install app");
  });

  it("calls install when clicked", async () => {
    draw(<InstallAppButton variant="settings" />);

    await act(async () => {
      control()!.click();
    });

    expect(install).toHaveBeenCalledTimes(1);
  });

  // The core of the request: a dismissed prompt must not leave a button that
  // does nothing, and an already-installed app must not be offered again.
  // "Can never install" is the only state that removes the row entirely.
  it("renders nothing when the browser can never offer an install", () => {
    status = "unavailable";
    canInstall = false;
    draw(<InstallAppButton variant="settings" />);

    expect(control()).toBeNull();
  });

  // Already installed is now a positive confirmation, not a vanished button:
  // the user reported being offered a download they could not act on.
  it("confirms the install instead of hiding when already installed", () => {
    status = "unavailable";
    installed = true;
    draw(<InstallAppButton variant="settings" />);

    expect(container.textContent).toContain(
      "ScholarBase is installed on this device.",
    );
    expect(container.textContent).toContain("Installed");
  });

  it("does not offer an inert click once installed", () => {
    status = "unavailable";
    installed = true;
    draw(<InstallAppButton variant="settings" />);

    // A row that looks clickable but does nothing is the exact complaint.
    expect(control()!.hasAttribute("disabled")).toBe(true);
  });

  // The installed state used to REPLACE the download glyph with a lone check,
  // which read as a verified/unknown marker rather than "installed". It is now
  // a corner tick on the same control, matching the notification count badge.
  it("keeps the install icon and adds a corner tick when installed", () => {
    status = "unavailable";
    installed = true;
    draw(<InstallAppButton variant="navbar" />);

    const button = control()!;
    // The download glyph is still there: the control stays recognisable.
    expect(button.querySelector(".lucide-download")).not.toBeNull();
    // The tick is a corner badge, positioned exactly like the unread-count one.
    const tick = button.querySelector("span.absolute")!;
    expect(tick.className).toContain("-right-0.5");
    expect(tick.className).toContain("-top-0.5");
    expect(tick.querySelector(".lucide-check")).not.toBeNull();
  });

  it("names the navbar control as installed for assistive tech", () => {
    status = "unavailable";
    installed = true;
    draw(<InstallAppButton variant="navbar" />);

    expect(control()!.getAttribute("aria-label")).toBe(
      "ScholarBase is installed on this device",
    );
    expect(control()!.getAttribute("title")).toBe(
      "ScholarBase is installed on this device",
    );
  });

  it("shows no corner tick when not installed", () => {
    status = "installable";
    draw(<InstallAppButton variant="navbar" />);

    expect(control()!.querySelector("span.absolute")).toBeNull();
  });

  it("cannot open the help popover once installed", async () => {
    // The control is disabled when installed, so no dead popover can appear.
    status = "unavailable";
    installed = true;
    draw(<InstallAppButton variant="navbar" />);

    await act(async () => {
      control()!.click();
    });

    expect(container.textContent).not.toContain("address bar");
    expect(control()!.hasAttribute("disabled")).toBe(true);
  });

  it("shows a non-interactive installed row in the overflow menu", () => {
    status = "unavailable";
    installed = true;
    draw(<InstallAppButton variant="menu" />);

    expect(container.textContent).toContain("ScholarBase installed");
  });

  it("shows manual instructions instead of a one-click install on iOS", async () => {
    status = "manual";
    draw(<InstallAppButton variant="settings" />);

    expect(control()).not.toBeNull();
    expect(container.textContent).toContain(
      "Add ScholarBase to your home screen",
    );

    // iOS has no prompt() to call — clicking reveals instructions, and must NOT
    // attempt a programmatic install.
    await act(async () => {
      control()!.click();
    });

    expect(install).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Add to Home Screen");
  });

  it("is disabled and reports progress while installing", () => {
    isWorking = true;
    draw(<InstallAppButton variant="settings" />);

    expect(control()!.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).toContain("Installing...");
  });

  it("renders the compact variant too", () => {
    draw(<InstallAppButton />);

    expect(control()).not.toBeNull();
  });

  // The navbar icon is the primary entry point, so it must be self-describing
  // to a screen reader even though it is icon-only.
  it("labels the icon-only navbar variant for assistive tech", () => {
    draw(<InstallAppButton variant="navbar" />);

    const button = control()!;
    expect(button.getAttribute("aria-label")).toBe("Install ScholarBase app");
    expect(button.getAttribute("title")).toBe("Install ScholarBase app");
    expect((button.textContent ?? "").trim()).toBe("");
  });

  it("still installs from the navbar variant", async () => {
    draw(<InstallAppButton variant="navbar" />);

    await act(async () => {
      control()!.click();
    });

    expect(install).toHaveBeenCalledTimes(1);
  });

  it("offers the share-sheet instructions from the navbar on iOS", () => {
    status = "manual";
    draw(<InstallAppButton variant="navbar" />);

    expect(control()!.getAttribute("aria-label")).toBe(
      "Add ScholarBase to your home screen",
    );
  });

  // The reported bug: the button vanished whenever Chrome had not (yet) issued a
  // `beforeinstallprompt`. Since Chrome issues it only once per install cycle,
  // that made the control disappear permanently on every reload, leaving no way
  // to install. It must now stay on screen and degrade to instructions instead.
  it("stays visible while the browser is still checking", () => {
    status = "checking";
    draw(<InstallAppButton variant="navbar" />);

    expect(control()).not.toBeNull();
  });

  // The dead-click bug: the navbar variant rendered a button wired to toggle a
  // help panel it never rendered, so the icon looked broken on every reload
  // where Chrome had not issued a fresh prompt.
  it("reveals install instructions when the navbar icon is clicked with no prompt", async () => {
    status = "checking";
    draw(<InstallAppButton variant="navbar" />);

    expect(container.textContent).not.toContain("address bar");

    await act(async () => {
      control()!.click();
    });

    // A click must always do something observable.
    expect(container.textContent).toContain("address bar");
    expect(container.textContent).toContain("Install ScholarBase");
  });

  it("does not open the help popover when a real prompt is available", async () => {
    status = "installable";
    draw(<InstallAppButton variant="navbar" />);

    await act(async () => {
      control()!.click();
    });

    expect(container.textContent).not.toContain("address bar");
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("closes the navbar popover on Escape", async () => {
    status = "checking";
    draw(<InstallAppButton variant="navbar" />);

    await act(async () => {
      control()!.click();
    });
    expect(container.textContent).toContain("address bar");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(container.textContent).not.toContain("address bar");
  });

  it("shows the navbar popover for iOS with share-sheet steps", async () => {
    status = "manual";
    draw(<InstallAppButton variant="navbar" />);

    await act(async () => {
      control()!.click();
    });

    expect(container.textContent).toContain("Add to Home Screen");
    expect(install).not.toHaveBeenCalled();
  });

  it("stays visible in the App tab while the browser is still checking", () => {
    status = "checking";
    draw(<InstallAppButton variant="settings" />);

    expect(control()).not.toBeNull();
    expect(container.textContent).toContain("Install app");
  });

  it("explains the manual route instead of doing nothing when no prompt is held", async () => {
    status = "checking";
    draw(<InstallAppButton variant="settings" />);

    await act(async () => {
      control()!.click();
    });

    // The whole reason the button remains: a click is never a dead click.
    expect(container.textContent).toContain("address");
    expect(container.textContent).toContain("Install app");
  });

  it("invites a one-click install when a prompt is actually available", () => {
    status = "installable";
    draw(<InstallAppButton variant="settings" />);

    expect(container.textContent).toContain("Install");
    expect(container.textContent).not.toContain("How to install");
  });

  it("renders the overflow-menu row with a spoken label", () => {
    status = "installable";
    draw(<InstallAppButton variant="menu" />);

    const button = control()!;
    expect(button.getAttribute("role")).toBe("menuitem");
    expect(container.textContent).toContain("Install ScholarBase");
  });

  it("never renders a dead row in the overflow menu", async () => {
    status = "checking";
    draw(<InstallAppButton variant="menu" />);

    await act(async () => {
      control()!.click();
    });

    expect(container.textContent).toContain("address bar");
  });

  it("renders every variant from one shared state", () => {
    draw(
      <>
        <InstallAppButton variant="navbar" />
        <InstallAppButton variant="settings" />
        <InstallAppButton />
      </>,
    );

    // One provider means the navbar icon and the App tab cannot disagree about
    // whether the app is installed.
    expect(container.querySelectorAll("button")).toHaveLength(3);
  });
});
