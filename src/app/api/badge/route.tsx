import { ImageResponse } from "next/og";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  let fontData: ArrayBuffer | null = null;

  const candidatePaths = [
    path.join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  ];

  for (const fontPath of candidatePaths) {
    try {
      const fontBuffer = await fs.readFile(fontPath);
      // Explicitly cast to ArrayBuffer to satisfy Next.js Satori FontOptions
      fontData = fontBuffer.buffer.slice(
        fontBuffer.byteOffset,
        fontBuffer.byteOffset + fontBuffer.byteLength
      ) as ArrayBuffer;
      break;
    } catch {
      // Continue to next path
    }
  }

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
              style: "normal" as const,
              weight: 700 as const,
            },
          ]
        : undefined,
    }
  );
}