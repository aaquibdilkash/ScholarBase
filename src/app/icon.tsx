import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 22, // Increased from 18 to fill the box
        background: "#020617",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        borderRadius: "8px",
        fontWeight: 900, // Max thickness
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1, // Keeps the larger text perfectly vertically centered
      }}
    >
      <span>S</span>
      <span style={{ color: "#3b82f6" }}>B</span>
    </div>,
    { ...size },
  );
}
