import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin file-tracing to this project (a stray lockfile in the home dir can
  // otherwise make Next infer the wrong workspace root).
  outputFileTracingRoot: import.meta.dirname,
  // Server Components external packages (native / heavy deps kept out of the bundle).
  // `nodemailer` (pulled in by the Auth.js Nodemailer provider) must be external —
  // it does `require('fs')`, which webpack can't resolve when bundled.
  serverExternalPackages: [
    "postgres",
    "@opensearch-project/opensearch",
    "@clickhouse/client",
    "ioredis",
    "nodemailer",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // S3 / object storage for user & business photos
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.digitaloceanspaces.com" },
      // local MinIO during development (S3 API mapped to host 9100)
      { protocol: "http", hostname: "localhost", port: "9100" },
      // OAuth provider avatars
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
      { protocol: "https", hostname: "graph.facebook.com" },
    ],
  },
  experimental: {
    // Optimize large icon / chart libraries
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  async headers() {
    return [
      {
        // Long-cache immutable vector tiles & static map assets if proxied
        source: "/tiles/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
