// The bundled gazetteer: places, variant spellings and normalisation rules (inlined at build time).
import placesDocument from "../data/places.json";
import variantsDocument from "../data/variants.json";
// OpenStreetMap spellings, kept in their own file under the ODbL (© OpenStreetMap contributors).
import osmVariantsDocument from "../data/variants_osm.json";
import rules from "../data/normalisation.json";
import type { NormalisationRules } from "./normalise.js";

export interface Place {
  pcode: string;
  level: number;
  name_en: string;
  name_ar: string;
  parent_pcode: string;
  point: [number, number];
}

export interface Variant {
  text: string;
  lang: string;
  pcodes: string[];
}

export interface Gazetteer {
  version: string;
  places: Place[];
  variants: Variant[];
  rules: NormalisationRules;
}

export const gazetteer: Gazetteer = {
  version: placesDocument.version,
  places: placesDocument.places as Place[],
  variants: [...variantsDocument.variants, ...osmVariantsDocument.variants] as Variant[],
  rules: rules as unknown as NormalisationRules,
};
