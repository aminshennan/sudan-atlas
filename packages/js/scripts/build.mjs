// Build dist/index.js (ESM), dist/index.cjs (CommonJS) and dist/types/ (declarations).
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
rmSync(join(pkg, "dist"), { recursive: true, force: true });

const shared = {
  entryPoints: [join(pkg, "src/index.ts")],
  bundle: true,
  platform: "neutral",
  target: "es2022",
  external: ["node:fs/promises", "node:url"],
  legalComments: "none",
  logLevel: "warning",
};
await build({ ...shared, format: "esm", outfile: join(pkg, "dist/index.js") });
await build({
  ...shared,
  format: "cjs",
  outfile: join(pkg, "dist/index.cjs"),
  define: { "import.meta.url": "importMetaUrl" },
  inject: [join(pkg, "scripts/import-meta-url.js")],
});
execFileSync(join(pkg, "node_modules/.bin/tsc"), ["-p", join(pkg, "tsconfig.types.json")], { stdio: "inherit" });
console.log("built dist/index.js, dist/index.cjs and dist/types/");
