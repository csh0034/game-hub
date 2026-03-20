import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { resolve } from "path";

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8"));

function getCommitHash(): string {
  if (process.env.NEXT_PUBLIC_COMMIT_HASH) {
    return process.env.NEXT_PUBLIC_COMMIT_HASH;
  }
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["@game-hub/shared-types"],
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: rootPkg.version,
    NEXT_PUBLIC_COMMIT_HASH: getCommitHash(),
  },
};

export default nextConfig;
