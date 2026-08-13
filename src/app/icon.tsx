import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 22, 
        background: "#020617",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        // borderRadius removed: let Google handle the container shape cleanly
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