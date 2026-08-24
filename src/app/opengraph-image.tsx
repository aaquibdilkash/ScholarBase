import { ImageResponse } from "next/og";

export const runtime = "edge";

// Image metadata for Next.js conventions (if used as apple-touch-icon.tsx)
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#020617", // Exact Tailwind slate-950
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 240, // Mathematically scaled from the 48px favicon
            color: "white",
            fontWeight: 900, // Maximum valid CSS font weight
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
            letterSpacing: "-10px", // Scaled negative tracking to pull S and B together
          }}
        >
          <span>S</span>
          <span style={{ color: "#3b82f6" }}>B</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}