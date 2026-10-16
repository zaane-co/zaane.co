import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Baseline security headers for every page: no MIME sniffing, no framing by other sites, trimmed referrers,
  // and the browser features ZARN needs (microphone and camera for calls) limited to this site.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), payment=()" },
      ],
    }];
  },
  async redirects() {
    return [{ source: "/pricing", destination: "/contact", permanent: true }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Cloudflare R2 (admin uploads) and the legacy Supabase bucket.
      { protocol: "https", hostname: "pub-7eb76f5f3b634af39a7afa0abc478d22.r2.dev" },
      { protocol: "https", hostname: "hflvyfpfoaguustuywqz.supabase.co" },
    ],
  },
};

export default nextConfig;
