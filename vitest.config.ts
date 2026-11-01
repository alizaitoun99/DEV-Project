import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/actions/**/*.test.ts", "src/lib/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
});
