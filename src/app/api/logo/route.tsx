// import { ImageResponse } from "next/og";

// export const runtime = "edge";

// export async function GET() {
//   return new ImageResponse(
//     <div
//       style={{
//         width: "100%",
//         height: "100%",
//         display: "flex",
//         flexDirection: "column", // Stack the logo mark and the tagline
//         alignItems: "center",
//         justifyContent: "center", // Perfect centering within the square
//         backgroundColor: "#ffffff", // Solid white for OAuth modals
//         fontFamily: "system-ui, sans-serif", // Modern, clean system font
//         textAlign: "center",
//         padding: "24px", // Adds safe spacing around the content
//       }}
//     >
//       {/* Main Logo Mark (The dominant 'S B') */}
//       <div
//         style={{
//           display: "flex",
//           fontSize: 140, // Very large size for high-quality recognition
//           fontWeight: 900, // Maximum thickness
//           lineHeight: 1, // Tightly spaced letters
//           letterSpacing: "-0.05em", // Slightly closer kerning for impact
//         }}
//       >
//         <span style={{ color: "#020617" }}>S</span>
//         {/* Using a slightly lighter blue (Tailwind blue-500) for better prominence on white */}
//         <span style={{ color: "#3b82f6" }}>B</span>
//       </div>

//       {/* Brand Tagline (Smaller for context below the icon) */}
//       <div
//         style={{
//           display: "flex",
//           fontSize: 28, // Clear readable size
//           fontWeight: 900, // Semi-bold to maintain hierarchy
//           marginTop: 0, // Good spacing between icon and text
//           letterSpacing: "-0.01em",
//         }}
//       >
//         <span style={{ color: "#020617" }}>Scholar</span>
//         <span style={{ color: "#3b82f6" }}>Base</span>
//       </div>
//     </div>,
//     {
//       // High resolution (256x256) for crispness on all displays
//       width: 256,
//       height: 256,
//     },
//   );
// }



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