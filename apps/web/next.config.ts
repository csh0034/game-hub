import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8"));

const nextConfig: NextConfig = {
  transpilePackages: ["@game-hub/shared-types"],
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: rootPkg.version,
  },
};

export default nextConfig;
