import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@game-hub/shared-types": "../../packages/shared-types/src",
    },
  },
});
