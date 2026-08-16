import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        // Reduced to 16 to create padding inside Google's circular mask
        fontSize: 18, 
        background: "#020617",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: 900, 
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1, 
      }}
    >
      <span>S</span>
      <span style={{ color: "#3b82f6" }}>B</span>
    </div>,
    { ...size },
  );
}