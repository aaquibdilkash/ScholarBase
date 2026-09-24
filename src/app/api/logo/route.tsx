import { ImageResponse } from "next/og";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// In-memory cache for warm serverless invocations
let cachedLogoFont: ArrayBuffer | null = null;

async function loadLogoFont(): Promise<ArrayBuffer | null> {
  if (cachedLogoFont) return cachedLogoFont;

  const fontPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "public",
    "fonts",
    "DejaVuSans-Bold.ttf"
  );

  try {
    const fontBuffer = await fs.readFile(fontPath);
    cachedLogoFont = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength
    ) as ArrayBuffer;
    return cachedLogoFont;
  } catch {
    return null;
  }
}

export async function GET() {
  const fontData = await loadLogoFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#020617",
          borderRadius: "50%",
          border: "16px solid #1e293b",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 220,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            fontFamily: fontData ? "DejaVu Sans" : "sans-serif",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "#ffffff" }}>S</span>
          <span style={{ color: "#3b82f6" }}>B</span>
        </div>
      </div>
    ),
    {
      width: 512,
      height: 512,
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