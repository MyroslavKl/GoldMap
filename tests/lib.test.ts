/**
 * Чисті модулі src/lib: список країн і дати. Запуск: npm run test:lib
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Country } from '../src/data/types.ts';
import {
  buildCountryList,
  groupVisitDates,
  normalizeForSearch,
  type BuildListInput,
} from '../src/lib/country-list.ts';
import { formatMonthYear, formatVisitDates } from '../src/lib/dates.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const countries = JSON.parse(
  readFileSync(join(ROOT, 'src/data/countries.json'), 'utf8'),
) as Country[];
const ukMonths = (
  JSON.parse(readFileSync(join(ROOT, 'src/i18n/uk.json'), 'utf8')) as {
    months: { short: string[] };
  }
).months.short;

const base: BuildListInput = {
  countries,
  visits: new Map(),
  planned: new Set(),
  filter: 'all',
  sort: 'alpha',
  query: '',
  lang: 'uk',
};
const isos = (input: Partial<BuildListInput>) =>
  buildCountryList({ ...base, ...input }).flatMap((s) => s.data.map((r) => r.country.iso2));

describe('dates', () => {
  test('у uk.json 12 скорочених місяців', () => {
    assert.equal(ukMonths.length, 12);
  });

  test('«бер. 2024»', () => {
    assert.equal(formatMonthYear('2024-03-15', ukMonths), `${ukMonths[2]} 2024`);
  });

  test('хронологічно, без повторів місяця, без порожніх дат', () => {
    assert.equal(
      formatVisitDates(['2025-08-02', null, '2024-03-01', '2024-03-20'], ukMonths),
      `${ukMonths[2]} 2024, ${ukMonths[7]} 2025`,
    );
  });

  test('більше трьох — «+N»', () => {
    assert.equal(
      formatVisitDates(
        ['2021-01-01', '2022-01-01', '2023-01-01', '2024-01-01', '2025-01-01'],
        ukMonths,
      ),
      `${ukMonths[0]} 2021, ${ukMonths[0]} 2022, ${ukMonths[0]} 2023, +2`,
    );
  });

  test('немає дат — порожній рядок', () => {
    assert.equal(formatVisitDates([null, null], ukMonths), '');
  });
});

describe('country-list: фільтри', () => {
  const visits = new Map<string, (string | null)[]>([
    ['UA', [null]],
    ['PL', ['2024-03-01']],
  ]);

  test('«Всі» — усі країни й території', () => {
    assert.equal(isos({}).length, countries.length);
  });

  test('«Відвідані» і «Заплановані»', () => {
    assert.deepEqual(isos({ filter: 'visited', visits }).sort(), ['PL', 'UA']);
    assert.deepEqual(isos({ filter: 'planned', planned: new Set(['IT']) }), ['IT']);
  });

  test('рядок знає, чи країна відвідана і запланована', () => {
    const rows = buildCountryList({ ...base, visits, planned: new Set(['PL']) })[0].data;
    const pl = rows.find((r) => r.country.iso2 === 'PL')!;
    assert.equal(pl.visited, true);
    assert.equal(pl.planned, true);
    assert.deepEqual(pl.startDates, ['2024-03-01']);
  });
});

describe('country-list: пошук', () => {
  test('за назвою uk і en, без урахування регістру', () => {
    assert.deepEqual(isos({ query: 'україна' }), ['UA']);
    assert.deepEqual(isos({ query: 'UKRAINE' }), ['UA']);
  });

  test('без діакритики: «cote» знаходить Côte d’Ivoire', () => {
    assert.ok(isos({ query: 'cote' }).includes('CI'));
  });

  test("апостроф будь-якого виду: «Кот-д’Івуар» = «Кот-д'Івуар»", () => {
    assert.ok(isos({ query: 'кот-д’' }).includes('CI'));
    assert.equal(normalizeForSearch('М’янма'), normalizeForSearch("М'янма"));
  });

  test('нічого не знайдено — порожньо', () => {
    assert.deepEqual(buildCountryList({ ...base, query: 'zzzz' }), []);
  });
});

describe('country-list: сортування', () => {
  test('за абеткою в поточній мові', () => {
    const names = buildCountryList({ ...base })[0].data.map((r) => r.country.name.uk);
    const sorted = [...names].sort(new Intl.Collator('uk').compare);
    assert.deepEqual(names, sorted);
  });

  test('за датою: останній візит зверху, без дат — унизу', () => {
    const visits = new Map<string, (string | null)[]>([
      ['FR', ['2020-01-01', '2025-06-01']],
      ['DE', ['2024-01-01']],
      ['UA', [null]],
    ]);
    assert.deepEqual(isos({ filter: 'visited', sort: 'date', visits }), ['FR', 'DE', 'UA']);
  });

  test('за континентом: секції в заданому порядку, всередині — за абеткою', () => {
    const visits = new Map<string, (string | null)[]>([
      ['JP', [null]],
      ['UA', [null]],
      ['PL', [null]],
      ['BR', [null]],
    ]);
    const sections = buildCountryList({ ...base, filter: 'visited', sort: 'continent', visits });
    assert.deepEqual(
      sections.map((s) => s.continent),
      ['europe', 'asia', 'south-america'],
    );
    assert.deepEqual(
      sections[0].data.map((r) => r.country.iso2),
      ['PL', 'UA'], // Польща, Україна
    );
  });
});

describe('groupVisitDates', () => {
  test('групує рядки візитів за країною', () => {
    const map = groupVisitDates([
      { countryIso: 'UA', startDate: null },
      { countryIso: 'PL', startDate: '2024-01-01' },
      { countryIso: 'UA', startDate: '2025-01-01' },
    ]);
    assert.deepEqual(map.get('UA'), [null, '2025-01-01']);
    assert.deepEqual(map.get('PL'), ['2024-01-01']);
  });
});
