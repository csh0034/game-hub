import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@game-hub/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts"),
    },
  },
});
