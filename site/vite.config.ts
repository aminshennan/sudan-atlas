import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

// Every page shares the same header, coordinate bar and footer. They live once in partials/
// and are stitched into each page at build time, so pages render with no layout shift.
function partials(): Plugin {
  return {
    name: "sudan-atlas-partials",
    transformIndexHtml(html) {
      return html.replace(/<!--\s*include:([a-z-]+)\s*-->/g, (_, name: string) =>
        readFileSync(resolve(here, "partials", `${name}.html`), "utf8"));
    },
  };
}

export default defineConfig({
  plugins: [partials()],
  resolve: {
    // The site uses the package's own source, so its results always match the npm and PyPI packages.
    alias: { "sudan-atlas": resolve(here, "../packages/js/src/index.ts") },
  },
  server: { fs: { allow: [resolve(here, "..")] } },
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        home: resolve(here, "index.html"),
        map: resolve(here, "map/index.html"),
        maker: resolve(here, "maker/index.html"),
        docs: resolve(here, "docs/index.html"),
        sources: resolve(here, "sources/index.html"),
        about: resolve(here, "about/index.html"),
      },
    },
  },
});
