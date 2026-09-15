import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "ScholarBase";
export const size = { width: 1200, height: 630 };
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
            fontSize: 300, // Proportional scale for 1200x630
            color: "white",
            fontWeight: 900,
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
            letterSpacing: "-12px",
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