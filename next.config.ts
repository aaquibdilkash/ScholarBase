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

// next/file tracing cannot follow the `createRequire(import.meta.url)` call that
// transformers uses for its native ONNX backend. Include only the current
// platform's runtime so the standalone image does not ship every OS/arch
// binary (the full onnxruntime-node package is ~550 MB).
const onnxRuntimePlatform = `${process.platform}/${process.arch}`;

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/cron/embed-content": [
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-common/**/*",
      `./node_modules/onnxruntime-node/bin/napi-v6/${onnxRuntimePlatform}/**/*`,
    ],
  },
  // Model files are downloaded at runtime into EMBEDDING_CACHE_DIR. A local
  // developer cache under node_modules must not leak into the image or make
  // the build non-reproducible.
  outputFileTracingExcludes: {
    "/api/cron/embed-content": [
      "./node_modules/@huggingface/transformers/.cache/**/*",
    ],
  },
  // Bots that parse metadata from the initial HTML `head` instead of waiting
  // for streamed metadata. This mirrors Next.js' built-in list and adds
  // Telegram, which is not included by default: without it Telegram unfurls
  // the root layout's generic title/image instead of the post's own OG tags
  // (WhatsApp is already in the default list, which is why the two apps showed
  // different previews for the same URL).
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|Telegram/i,
  // Pins client bundles to the build that served them, so Server Action requests
  // from an already-open tab reach the matching build after a redeploy.
  // SOURCE_COMMIT is set by the Dockerfile from the git commit being built.
  deploymentId: process.env.SOURCE_COMMIT,
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // ImageUploadField accepts source files up to 5 MB. Server Actions include
    // multipart metadata in their raw request body, so leave headroom above
    // that limit; otherwise Next rejects valid uploads before uploadImage runs.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async redirects() {
    return [
      // Vacancies became Academic Positions; keep old links, bookmarks and
      // search results working.
      {
        source: "/vacancies",
        destination: "/academic-positions",
        permanent: true,
      },
      {
        source: "/vacancies/:path*",
        destination: "/academic-positions/:path*",
        permanent: true,
      },
    ];
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
