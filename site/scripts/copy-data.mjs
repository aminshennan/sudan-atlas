// Copy the boundary files the site draws into public/atlas-data/ (ignored by git).
// The originals in the repository's data/ folder are the source of truth.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(site, "..");
const target = join(site, "public", "atlas-data");

rmSync(target, { recursive: true, force: true });
for (const resolution of ["medium", "light"]) {
  mkdirSync(join(target, "boundaries", resolution), { recursive: true });
  for (const file of ["adm1.topojson", "adm2.topojson", "adm1.geojson", "adm2.geojson"]) {
    cpSync(join(root, "data", "boundaries", resolution, file), join(target, "boundaries", resolution, file));
  }
}
console.log("site data copied to public/atlas-data");
