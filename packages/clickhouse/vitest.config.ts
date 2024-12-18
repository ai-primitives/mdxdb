import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 60000,
    globalSetup: ["./test/global-setup.ts"],
    include: [
      "test/**/*.test.ts",
      "test/**/*.spec.ts",
      "src/**/*.test.ts",
      "src/**/__tests__/**/*.ts"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"]
    }
  }
});
