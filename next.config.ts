import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    const headers: { source: string; headers: { key: string; value: string }[] }[] = [
      {
        // 港データは内容が変わらない限り長めにキャッシュさせる
        source: "/data/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];

    // 埋め込みを許可するオリジン（未設定なら制限なし＝どこからでもiframe可）
    const frameAncestors = process.env.EMBED_FRAME_ANCESTORS;
    if (frameAncestors) {
      headers.push({
        source: "/embed",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors}` }],
      });
    }

    return headers;
  },
};

export default nextConfig;
