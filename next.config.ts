import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
