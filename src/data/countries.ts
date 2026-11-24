import rawCountries from './countries.json';
import type { Country } from './types';

export type { City, Continent, Country, LocalizedName } from './types';

/** Довідник країн і територій (згенерований, див. src/data/LICENSE-DATA.md). */
export const COUNTRIES = rawCountries as Country[];

const byIso = new Map(COUNTRIES.map((c) => [c.iso2, c]));

export function getCountry(iso2: string): Country | undefined {
  return byIso.get(iso2);
}

export type CountryListMode = 'un' | 'extended';

const UN_ISOS: ReadonlySet<string> = new Set(
  COUNTRIES.filter((c) => c.unMember).map((c) => c.iso2),
);
const ALL_ISOS: ReadonlySet<string> = new Set(COUNTRIES.map((c) => c.iso2));

/** Країни, що йдуть у знаменник лічильника: 193 члени ООН або всі території. */
export function countableIsos(mode: CountryListMode): ReadonlySet<string> {
  return mode === 'un' ? UN_ISOS : ALL_ISOS;
}
