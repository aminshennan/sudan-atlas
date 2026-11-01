// Copy the released data from the repository's data/ folder into this package.
// The copy (packages/js/data/) is ignored by git; the originals are the source of truth.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const root = join(pkg, "..", "..");
const target = join(pkg, "data");

rmSync(target, { recursive: true, force: true });
mkdirSync(join(target, "boundaries"), { recursive: true });
for (const name of ["places.json", "variants.json", "variants_osm.json", "normalisation.json"]) {
  const source = join(root, "data", "gazetteer", name);
  if (existsSync(source)) cpSync(source, join(target, name));
}
cpSync(join(root, "data", "boundaries"), join(target, "boundaries"), { recursive: true, filter: (p) => !p.endsWith(".gitkeep") });
for (const name of ["LICENSE", "LICENSE-DATA"]) cpSync(join(root, name), join(pkg, name));
console.log("data copied to packages/js/data");
