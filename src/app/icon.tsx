import { ImageResponse } from "next/og";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default async function Icon() {
  let fontData: ArrayBuffer | null = null;

  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf");
    const fontBuffer = await fs.readFile(fontPath);
    fontData = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength
    ) as ArrayBuffer;
  } catch {
    // Fallback if font file is missing
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
          backgroundColor: "#020617",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap:0,// Clean separation matching the first image
            fontSize: 27,
            fontWeight: 700,
            fontFamily: fontData ? "DejaVu Sans" : "sans-serif",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#ffffff" }}>S</span>
          <span style={{ color: "#3b82f6" }}>B</span>
        </div>
      </div>
    ),
    {
      ...size,
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