import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    ssr: true,
    target: "node24",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/main.ts",
      output: {
        entryFileNames: "main.js",
        format: "es",
      },
      external: ["node-pty", /^node:/],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
