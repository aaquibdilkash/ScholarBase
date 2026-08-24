



import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#020617", // Deep luxury dark background
          borderRadius: "50%", // Perfect circle for social media profile pictures
          border: "16px solid #1e293b", // Sleek dark metallic/slate outer ring
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 220, // Massive, high-fidelity scale for crisp rendering
            fontWeight: 1200,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <span style={{ color: "#ffffff" }}>S</span>
          <span style={{ color: "#3b82f6" }}>B</span>
        </div>
      </div>
    ),
    {
      // 512x512 pixels: High resolution so it never gets pixelated when zoomed in 
      // on WhatsApp, Telegram, Gmail, or Twitter/X profile pictures.
      width: 512,
      height: 512,
    },
  );
}