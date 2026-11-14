/**
 * @vitest-environment jsdom
 *
 * Regression: the list card collapsed its cover into a short, zoomed strip with
 * `object-cover`, so a portrait cover rendered as a cropped band instead of the
 * image shown on the detail page.
 *
 * Collapsed and expanded now share ONE contained rendering (natural aspect
 * ratio, never stretched past its own pixels). Collapsed shows only the top
 * 25% of the cover; expanded shows all of it, so expanding reveals the hidden
 * bottom ("unfurl") with no scale jump.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CollapsibleMediaBody } from "@/components/cards/CollapsibleMediaBody";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    style,
    onLoad,
  }: {
    src: string;
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    onLoad?: React.ReactEventHandler<HTMLImageElement>;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test stub for next/image
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onLoad={onLoad}
    />
  ),
}));

// Portrait cover: 2x taller than wide, so it is always cut off by the frame.
const PORTRAIT = { width: 400, height: 800 };
const FRAME_WIDTH = 800;

describe("CollapsibleMediaBody stacked image frame", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    // jsdom has no layout: give the measured frame a real width so the
    // "is the image cut off?" check can run.
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(FRAME_WIDTH);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const draw = async () => {
    await act(async () => {
      root.render(
        <CollapsibleMediaBody
          href="/admissions/1"
          imageUrl="https://example.com/cover.jpg"
          contentKey="cover"
          text="A short admission summary."
        />,
      );
    });
  };

  const imageFrame = () =>
    container.querySelector<HTMLButtonElement>(
      '[aria-label="Open image preview"]',
    );

  const image = () => container.querySelector("img");

  const reportNaturalSize = async ({
    width = PORTRAIT.width,
    height = PORTRAIT.height,
  }: { width?: number; height?: number } = {}) => {
    const img = image();
    expect(img).not.toBeNull();
    const el = img as HTMLImageElement;
    Object.defineProperty(el, "naturalWidth", {
      configurable: true,
      value: width,
    });
    Object.defineProperty(el, "naturalHeight", {
      configurable: true,
      value: height,
    });
    await act(async () => {
      el.dispatchEvent(new Event("load"));
    });
  };

  const findToggle = (label: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === label,
    );

  it("renders the cover contained at its natural ratio, without object-cover", async () => {
    await draw();

    const img = image();
    expect(img).not.toBeNull();
    const classes = img!.className.split(/\s+/);
    expect(classes).toContain("w-auto");
    expect(classes).toContain("max-w-full");
    expect(classes).not.toContain("w-full");
    expect(classes).not.toContain("object-cover");
    expect((img as HTMLImageElement).style.maxHeight).toBe("300px");
  });

  it("shows only the top quarter of a short cover when collapsed", async () => {
    await draw();

    // 3:1 image: renders 100px tall at this width, so the collapsed frame that
    // shows its top quarter is 25px — the same 25% rule for every cover.
    await reportNaturalSize({ width: 300, height: 100 });

    expect(imageFrame()!.style.maxHeight).toBe("25px");
  });

  it("unfurls the same image from 75px to 300px when expanded", async () => {
    await draw();
    // 25% of the 300px cap before the image reports its size.
    expect(imageFrame()!.style.maxHeight).toBe("75px");
    const collapsedImage = image();

    await reportNaturalSize();

    const viewMore = findToggle("View more");
    expect(viewMore).toBeDefined();

    await act(async () => {
      viewMore!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Taller box, identical image: the hidden bottom is revealed and the
    // rendered image element is unchanged (no re-crop, no rescale).
    expect(imageFrame()!.style.maxHeight).toBe("300px");
    expect(image()).toBe(collapsedImage);
    expect(container.textContent).toContain("View less");
  });
});
