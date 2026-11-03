import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/support/server-only.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Agent worktrees are full checkouts of other branches.
    exclude: ["**/node_modules/**"],
    fileParallelism: false,
    testTimeout: 20000,
    // next-intl imports `next/server` without an extension; let Vite resolve it.
    server: { deps: { inline: [/next-intl/, /use-intl/] } },
  },
});
