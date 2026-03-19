import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@game-hub/shared-types"],
  output: "standalone",
};

export default nextConfig;
