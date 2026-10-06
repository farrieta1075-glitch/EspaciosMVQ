import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

/** PWA desactivado por defecto: el SW cacheaba mapas/recursos y causaba OOM. */
const enablePwa = process.env.NEXT_PUBLIC_ENABLE_PWA === "true";

const withPWA = withPWAInit({
  dest: "public",
  disable: !enablePwa || process.env.NODE_ENV === "development",
  register: enablePwa,
  reloadOnOnline: enablePwa,
  cacheOnFrontEndNav: false,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/api\/.*/i,
        handler: "NetworkOnly",
        method: "GET",
        options: {
          cacheName: "api-network-only",
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdfjs-dist"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default enablePwa && process.env.NODE_ENV === "production"
  ? withPWA(nextConfig)
  : nextConfig;
