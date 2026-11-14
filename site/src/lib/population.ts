// Estimated population per state and locality, mid-2025 (UNFPA and CBS Sudan, COD-PS 2025, via
// OCHA HDX). Projections, not counts; see data/population/ and the data page for the caveats.
import DATA from "../data/population.json"; // written by `make population` from data/population/

const POPULATION = DATA.population as Record<string, number>;

/** The estimated population of a state or locality, or undefined (the Abyei PCA area has none). */
export const populationOf = (pcode: string): number | undefined => POPULATION[pcode];
export const POPULATION_SOURCE = "UNFPA & CBS Sudan, COD-PS 2025 (estimates, mid-2025)";
export const POPULATION_SOURCE_AR = "صندوق الأمم المتحدة للسكان والجهاز المركزي للإحصاء، COD-PS 2025 (تقديرات منتصف 2025)";
