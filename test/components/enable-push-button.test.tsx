/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PushStatus } from "@/components/push/PushNotificationProvider";
import { EnablePushButton } from "@/components/push/EnablePushButton";

// The real provider probes `navigator.serviceWorker` and `Notification`, which
// jsdom does not provide. Mocking the context hook keeps these tests pointed at
// what actually matters — that every variant reads the same shared state and
// calls the same toggle — without standing up a service worker.
const toggle = vi.fn();
let status: PushStatus = "disabled";
let isWorking = false;

vi.mock("@/components/push/PushNotificationProvider", () => ({
  usePushNotifications: () => ({
    status,
    isWorking,
    isEnabled: status === "enabled",
    toggle,
  }),
}));

describe("EnablePushButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Required for `act` to flush React updates synchronously in a jsdom env
    // that does not set it globally.
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    toggle.mockClear();
    status = "disabled";
    isWorking = false;
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

  /** The single control this component renders, if it rendered one at all. */
  const control = () => container.querySelector("button");

  it("shows the off state and calls toggle when clicked", () => {
    draw(<EnablePushButton variant="settings" />);

    const button = control()!;
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("Off");

    act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("reflects the enabled state", () => {
    status = "enabled";
    draw(<EnablePushButton variant="settings" />);

    expect(control()!.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("On");
  });

  // The navbar icon, /notifications and the settings row are separate mounts of
  // this component over one provider. If state were ever stored per-instance,
  // toggling in settings would leave the navbar stale — this pins that every
  // variant reads the single source of truth.
  it("renders every variant from the same shared state", () => {
    status = "enabled";
    draw(
      <>
        <EnablePushButton variant="settings" />
        <EnablePushButton variant="default" />
        <EnablePushButton variant="navbar" />
        <EnablePushButton variant="menu" />
      </>,
    );

    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(4);
    // The `menu` variant is a `menuitemcheckbox` and reports via `aria-checked`
    //; the others are buttons reporting `aria-pressed`. Either way all four
    // must read as "on" — that is the shared state showing through.
    for (const b of buttons) {
      const pressed = b.getAttribute("aria-pressed");
      const checked = b.getAttribute("aria-checked");
      expect(pressed ?? checked).toBe("true");
    }
  });

  it("disables the control while a toggle is in flight", () => {
    isWorking = true;
    draw(<EnablePushButton variant="settings" />);

    const button = control()!;
    expect(button.disabled).toBe(true);
    expect(container.textContent).toContain("Updating...");

    act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(toggle).not.toHaveBeenCalled();
  });

  // Renders nothing while probing or on a browser without Push support, so a
  // settings row never appears as a dead control.
  it.each(["checking", "unsupported"] as const)(
    "renders nothing while %s",
    (s) => {
      status = s;
      draw(<EnablePushButton variant="settings" />);
      expect(container.innerHTML).toBe("");
    },
  );

  it("labels the settings row so it is not just an icon", () => {
    draw(<EnablePushButton variant="settings" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Message alerts");
    expect(text).toContain("Push notifications");
  });
});