import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
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
    // Evita errores "Array buffer allocation failed" por caché corrupta en Windows.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default process.env.NODE_ENV === "production"
  ? withPWA(nextConfig)
  : nextConfig;
