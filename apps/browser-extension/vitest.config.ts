import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.html",
        "src/manifest.json",
        "src/popup/**",
        "src/options/**",
        "src/content/index.ts",
        "src/lib/storage.ts",
      ],
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
