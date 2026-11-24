/**
 * Логіка вкладки «Країни»: фільтр, пошук, сортування, секції за континентами.
 * Чистий модуль (без React/Expo) — тестується в Node.
 */
import type { Continent, Country } from '../data/types.ts';

export type ListFilter = 'visited' | 'planned' | 'all';
export type ListSort = 'date' | 'alpha' | 'continent';
export type Lang = 'uk' | 'en';

export const CONTINENT_ORDER: readonly Continent[] = [
  'europe',
  'asia',
  'africa',
  'north-america',
  'south-america',
  'oceania',
  'antarctica',
];

export type CountryRowData = {
  country: Country;
  visited: boolean;
  planned: boolean;
  /** Дати початку візитів (можуть бути null — візит без дат) */
  startDates: (string | null)[];
};

export type CountrySection = {
  /** null — одна секція без заголовка */
  continent: Continent | null;
  data: CountryRowData[];
};

export type BuildListInput = {
  countries: readonly Country[];
  /** iso2 → дати початку активних візитів (країна відвідана, якщо ключ є) */
  visits: ReadonlyMap<string, (string | null)[]>;
  planned: ReadonlySet<string>;
  filter: ListFilter;
  sort: ListSort;
  query: string;
  lang: Lang;
};

/** Нормалізація для пошуку: регістр, діакритика (Côte → cote), апострофи. */
export function normalizeForSearch(s: string): string {
  let out = s.toLowerCase();
  try {
    out = out.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    // Рушій без normalize — шукаємо без зняття діакритики.
  }
  return out.replace(/[’ʼ`']/g, "'").trim();
}

function matches(country: Country, q: string): boolean {
  if (!q) return true;
  return [country.name.uk, country.name.en, country.iso2].some((v) =>
    normalizeForSearch(v).includes(q),
  );
}

/** Остання відома дата візиту, або '' якщо дат немає. */
function lastDate(dates: readonly (string | null)[]): string {
  let max = '';
  for (const d of dates) if (d && d > max) max = d;
  return max;
}

export function buildCountryList(input: BuildListInput): CountrySection[] {
  const q = normalizeForSearch(input.query);
  const collator = new Intl.Collator(input.lang, { sensitivity: 'base' });
  const byName = (a: CountryRowData, b: CountryRowData) =>
    collator.compare(a.country.name[input.lang], b.country.name[input.lang]);

  const rows: CountryRowData[] = [];
  for (const country of input.countries) {
    const startDates = input.visits.get(country.iso2);
    const visited = startDates !== undefined;
    const planned = input.planned.has(country.iso2);
    if (input.filter === 'visited' && !visited) continue;
    if (input.filter === 'planned' && !planned) continue;
    if (!matches(country, q)) continue;
    rows.push({ country, visited, planned, startDates: startDates ?? [] });
  }

  if (input.sort === 'continent') {
    return CONTINENT_ORDER.map((continent) => ({
      continent,
      data: rows.filter((r) => r.country.continent === continent).sort(byName),
    })).filter((s) => s.data.length > 0);
  }

  if (input.sort === 'date') {
    rows.sort((a, b) => {
      const da = lastDate(a.startDates);
      const db = lastDate(b.startDates);
      if (da !== db) return da < db ? 1 : -1; // новіші зверху, без дат ('') — внизу
      return byName(a, b);
    });
  } else {
    rows.sort(byName);
  }
  return rows.length ? [{ continent: null, data: rows }] : [];
}

/** iso2 → дати з рядків activeVisitDatesQuery. */
export function groupVisitDates(
  rows: readonly { countryIso: string; startDate: string | null }[],
): Map<string, (string | null)[]> {
  const map = new Map<string, (string | null)[]>();
  for (const { countryIso, startDate } of rows) {
    const list = map.get(countryIso);
    if (list) list.push(startDate);
    else map.set(countryIso, [startDate]);
  }
  return map;
}
