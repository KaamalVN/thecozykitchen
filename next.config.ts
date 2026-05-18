import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.pinimg.com",
      },
      {
        protocol: "https",
        hostname: "*.pinterest.com",
      },
    ],
    localPatterns: [
      {
        pathname: "/api/image",
      },
    ],
  },
};

export default nextConfig;
