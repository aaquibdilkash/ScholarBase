import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking by forbidding embedding in iframes
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Prevent MIME-sniffing vulnerabilities
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Control referrer information sent in outbound links
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Enforce HTTPS and preloading across domains and subdomains
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Restrict access to device hardware/APIs
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Optimize DNS lookups for outbound external links
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;