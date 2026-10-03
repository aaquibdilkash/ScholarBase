/**
 * @vitest-environment jsdom
 *
 * The real `PwaInstallProvider`, unmocked.
 *
 * This file exists because of a bug the mocked unit tests could never catch: the
 * provider used to give up waiting for `beforeinstallprompt` after 3 seconds and
 * report `unavailable`, which made the navbar icon and the App tab render
 * `null` on any browser slower than that. Every test in
 * `install-app-button.test.tsx` mocks the context hook, so they all passed while
 * the control was invisible in the product. Asserting on the real event flow is
 * the only way to pin timing behaviour like this.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PwaInstallProvider, usePwaInstall } from "@/components/pwa/PwaInstallProvider";
import { InstallAppButton, InstallStatusNote } from "@/components/pwa/InstallAppButton";
import { ToastProvider } from "@/components/ui/Toast";

/** A minimal stand-in for the non-standard Chromium event. */
function makeBeforeInstallPromptEvent(): Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
} {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = () => Promise.resolve();
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  return event;
}

/** Renders the real button + note so we assert on actual output, not context. */
function Harness() {
  const { status } = usePwaInstall();
  return (
    <>
      <span data-testid="status">{status}</span>
      <InstallAppButton variant="settings" />
      <InstallStatusNote />
    </>
  );
}

describe("PwaInstallProvider (event timing)", () => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * Overrides properties on the REAL navigator object.
   *
   * `Object.create(navigator)` looks tidier but produces an object that is not a
   * real Navigator, so jsdom's own accessors (`get userAgent`) throw
   * "'called on an object that is not a valid instance of Navigator" the moment
   * the provider probes the UA. Defining the property in place keeps the
   * instance valid. `afterEach` restores it.
   */
  const patchNavigator = (props: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(props)) {
      const original = Object.getOwnPropertyDescriptor(navigator, key);
      Object.defineProperty(navigator, key, {
        value,
        configurable: true,
        writable: true,
      });
      originals.push([key, original]);
    }
  };
  const originals: [string, PropertyDescriptor | undefined][] = [];

  /**
   * Models a browser whose service worker is registered but still activating.
   * The install criteria may yet be met, so the provider must keep waiting
   * rather than concluding "cannot install".
   */
  const stubWorkerThatNeverActivates = () => {
    patchNavigator({
      serviceWorker: {
        ready: new Promise(() => {}),
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  };

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as unknown as { __sbInstallPrompt?: unknown }).__sbInstallPrompt;
    window.localStorage.clear();
    for (const [key, descriptor] of originals.splice(0)) {
      if (descriptor) {
        Object.defineProperty(navigator, key, descriptor);
      } else {
        delete (navigator as unknown as Record<string, unknown>)[key];
      }
    }
  });

  const draw = () =>
    act(() => {
      root.render(
        <ToastProvider>
          <PwaInstallProvider>
            <Harness />
          </PwaInstallProvider>
        </ToastProvider>,
      );
    });

  const status = () => container.querySelector('[data-testid="status"]')?.textContent;
  const text = () => container.textContent ?? "";

  it("keeps listening for as long as the page is open", () => {
    // The regression behind the reported flake: a countdown used to flip this
    // to "unavailable" and hide the button. Nothing may time out any more.
    stubWorkerThatNeverActivates();
    draw();

    for (const ms of [8_000, 60_000, 600_000]) {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    }

    expect(status()).toBe("checking");
    // The "waiting" copy was removed: it could promise something Chrome would
    // never deliver after a dismissal. The button itself stays usable instead.
    expect(text()).not.toContain("Waiting for your browser");
  });

  it("never claims a service-worker-capable browser cannot install", () => {
    // The exact user-visible bug: a perfectly capable browser being told it
    // "cannot install ScholarBase" because a timer expired. A worker that is
    // already active (i.e. every page refresh after the first) is precisely the
    // case that used to trip it.
    stubWorkerThatNeverActivates();
    draw();

    act(() => {
      vi.advanceTimersByTime(3_600_000);
    });

    expect(status()).not.toBe("unavailable");
    expect(text()).not.toContain("cannot install ScholarBase");
  });

  it("shows the button when beforeinstallprompt arrives at any point", () => {
    stubWorkerThatNeverActivates();
    draw();

    for (const ms of [100, 5_000, 30_000, 120_000]) {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    }
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    expect(status()).toBe("installable");
    expect(text()).toContain("Install app");
  });

  it("prevents the browser's own mini-infobar", () => {
    stubWorkerThatNeverActivates();
    draw();
    const event = makeBeforeInstallPromptEvent();
    const preventDefault = vi.spyOn(event, "preventDefault");

    act(() => {
      window.dispatchEvent(event);
    });

    // Otherwise Chromium shows a second prompt and the user installs twice.
    expect(preventDefault).toHaveBeenCalled();
  });

  it("hides the button and confirms the install once appinstalled fires", () => {
    stubWorkerThatNeverActivates();
    draw();
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(text()).toContain("Install app");

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    // The row stays, but as a confirmation rather than an actionable download.
    expect(text()).toContain("ScholarBase is installed on this device.");
    expect(text()).toContain("Installed");
  });

  it("offers iOS instructions immediately rather than waiting for an event", async () => {
    patchNavigator({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    draw();

    // iOS has no programmatic install at all, so waiting would strand the user
    // on a permanently empty panel.
    expect(status()).toBe("manual");
    expect(text()).toContain("home screen");

    // The full step-by-step is behind a click, so it must actually be reachable.
    await act(async () => {
      container.querySelector("button")!.click();
    });
    expect(text()).toContain("Add to Home Screen");
  });

  it("reports an unsupportable browser, decided from the absence of support", () => {
    // A browser with no service worker support can never install. This is a
    // fact about the platform, not a timeout, so it is safe to conclude at once.
    patchNavigator({ serviceWorker: undefined });
    draw();

    expect(status()).toBe("unavailable");
    // Wording was softened: this is a recommendation, not a verdict, and the
    // browser may still support installing via its own menu.
    expect(text()).toContain("cannot install apps");
  });

  it("adopts a prompt that the head script captured before hydration", () => {
    // The race this pins: `beforeinstallprompt` fires once and can beat React
    // hydration, so the provider mounted with the event already gone and showed
    // "How to install" until some later navigation remounted it. The inline
    // head script stashes the event on `window`; we must pick that up on mount.
    const early = makeBeforeInstallPromptEvent();
    (window as unknown as { __sbInstallPrompt?: Event }).__sbInstallPrompt = early;
    stubWorkerThatNeverActivates();
    draw();

    expect(status()).toBe("installable");
    expect(text()).toContain("Install app");
  });

  it("adopts a prompt re-broadcast by the head script after mount", () => {
    // The other ordering: hydration wins the race, then the real event fires.
    stubWorkerThatNeverActivates();
    draw();
    expect(status()).toBe("checking");

    (window as unknown as { __sbInstallPrompt?: Event }).__sbInstallPrompt =
      makeBeforeInstallPromptEvent();
    act(() => {
      window.dispatchEvent(new Event("sb:beforeinstallprompt"));
    });

    expect(status()).toBe("installable");
  });

  it("treats getInstalledRelatedApps reporting an install as installed", async () => {
    // The case the user reported: ScholarBase is installed, but the site was
    // opened in an ordinary browser tab, so display-mode is "browser" and the
    // download button kept being offered for an app already on the device.
    patchNavigator({
      serviceWorker: { ready: new Promise(() => {}), addEventListener: () => {}, removeEventListener: () => {} },
      getInstalledRelatedApps: () => Promise.resolve([{ platform: "web", id: "/", url: "/feed" }]),
    });
    draw();

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(status()).toBe("unavailable");
    expect(text()).toContain("Install app");
  });

  it("keeps the install option when the browser cannot report installed apps", async () => {
    // Firefox and Safari do not implement getInstalledRelatedApps. That must
    // read as "unknown", NOT as "not installed" — otherwise every non-Chromium
    // user silently loses the install button.
    patchNavigator({
      serviceWorker: { ready: new Promise(() => {}), addEventListener: () => {}, removeEventListener: () => {} },
    });
    draw();

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(status()).toBe("checking");
    expect(text()).toContain("Install app");
  });

  it("survives a getInstalledRelatedApps that rejects", async () => {
    // The API can throw (permissions, opaque origin). A failure must not take
    // down the provider or hide the button.
    patchNavigator({
      serviceWorker: { ready: new Promise(() => {}), addEventListener: () => {}, removeEventListener: () => {} },
      getInstalledRelatedApps: () => Promise.reject(new Error("denied")),
    });
    draw();

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(status()).toBe("checking");
  });

  it("keeps a recorded install when the browser reports no install", async () => {
    // The regression the user hit: `getInstalledRelatedApps()` returning an
    // EMPTY array was read as "not installed" and wiped the recorded state, so
    // a genuinely installed app (installed from another origin — e.g. a
    // production install viewed from a localhost dev tab — or simply a Chromium
    // false negative) started showing "Install app" again. An empty result is
    // NOT proof of absence, so it must leave the install state alone.
    window.localStorage.setItem("sb:pwa-installed", "1");
    patchNavigator({
      serviceWorker: { ready: new Promise(() => {}), addEventListener: () => {}, removeEventListener: () => {} },
      getInstalledRelatedApps: () => Promise.resolve([]),
    });
    draw();

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Still installed — the empty result changed nothing.
    expect(status()).toBe("unavailable");
    expect(text()).toContain("installed on this device");
    expect(window.localStorage.getItem("sb:pwa-installed")).toBe("1");
  });

  it("remembers an install recorded locally on a browser with no install API", () => {
    // Firefox and Safari expose neither getInstalledRelatedApps nor anything
    // else that can detect "installed but opened in a normal tab". The local
    // flag, written when `appinstalled` fired, is the only signal available, so
    // it has to survive across page loads.
    window.localStorage.setItem("sb:pwa-installed", "1");
    stubWorkerThatNeverActivates();
    draw();

    expect(status()).toBe("unavailable");
    expect(text()).toContain("installed on this device");
  });

  it("persists the flag when the browser reports a successful install", async () => {
    stubWorkerThatNeverActivates();
    draw();
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    await act(async () => {
      await container
        .querySelector("button")!
        .click();
    });
    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(window.localStorage.getItem("sb:pwa-installed")).toBe("1");
  });

  it("stops responding to events after unmount", () => {
    stubWorkerThatNeverActivates();
    draw();
    act(() => root.unmount());
    const before = container.innerHTML;

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    expect(container.innerHTML).toBe(before);
  });
});
