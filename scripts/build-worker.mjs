// SPDX-License-Identifier: AGPL-3.0-only
import { build } from "esbuild";

// Bundles the worker into one CommonJS file for the production image.
await build({
  entryPoints: ["worker/index.ts"],
  outfile: ".worker.cjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  sourcemap: true,
  external: ["pg-native"],
  alias: { "server-only": "./worker/empty.ts" },
  jsx: "automatic",
  logLevel: "warning",
});
