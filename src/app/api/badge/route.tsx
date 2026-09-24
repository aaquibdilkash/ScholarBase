import { ImageResponse } from "next/og";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

let cachedBadgeFont: ArrayBuffer | null = null;

async function loadBadgeFont(): Promise<ArrayBuffer | null> {
  if (cachedBadgeFont) return cachedBadgeFont;

  try {
    const fontBuffer = await fs.readFile(
      path.join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf")
    );
    cachedBadgeFont = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength
    ) as ArrayBuffer;
    return cachedBadgeFont;
  } catch {
    return null;
  }
}

export async function GET() {
  const fontData = await loadBadgeFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 70,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            fontFamily: fontData ? "DejaVu Sans" : "sans-serif",
            fontWeight: 700,
          }}
        >
          {/* 'S' in pure 100% solid white */}
          <span style={{ color: "#ffffff" }}>S</span>
          {/* 'B' in 65% translucent frosted white for two-tone contrast */}
          <span style={{ color: "rgba(255, 255, 255, 0.65)" }}>B</span>
        </div>
      </div>
    ),
    {
      width: 96,
      height: 96,
      fonts: fontData
        ? [
            {
              name: "DejaVu Sans",
              data: fontData,
              style: "normal",
              weight: 700,
            },
          ]
        : undefined,
    }
  );
}