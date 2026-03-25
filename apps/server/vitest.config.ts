import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/socket-test-helpers.ts",
        "src/index.ts",
        "src/storage/interfaces/**",
        "src/storage/redis/index.ts",
        "src/storage/in-memory/index.ts",
        "src/storage/redis-client.ts",
        "src/games/engine-interface.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@game-hub/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts"),
    },
  },
});
