// SPDX-License-Identifier: AGPL-3.0-only
import { build } from "esbuild";

await build({
  entryPoints: ["scripts/house-anchors.ts"],
  outfile: ".house-anchors.cjs",
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
