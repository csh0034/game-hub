import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@game-hub/shared-types"],
};

export default nextConfig;
