import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff", // Solid background looks best in Google's modal
        fontSize: 20,
        fontWeight: "bold",
        fontFamily: "sans-serif",
      }}
    >
      <span style={{ color: "#020617" }}>Scholar</span>
      <span style={{ color: "#2563eb" }}>Base</span>
    </div>,
    {
      width: 120,
      height: 120,
    },
  );
}
