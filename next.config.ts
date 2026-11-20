import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The storefront and admin read live stock from the database on every request.
  reactStrictMode: true,
};

export default nextConfig;
