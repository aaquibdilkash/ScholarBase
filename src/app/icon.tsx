import { ImageResponse } from "next/og";

// 🔥 Increased to 48x48 to meet Google's exact Search requirements
export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: "#020617",
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
          fontSize: 22, // Scaled carefully to survive the circular crop
          color: "white",
          fontWeight: 900,
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1,
          letterSpacing: "-1px", // Pulls the S and B away from the dangerous edges
        }}
      >
        <span>S</span>
        <span style={{ color: "#3b82f6" }}>B</span>
      </div>
    </div>,
    { ...size },
  );
}