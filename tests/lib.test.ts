/**
 * Чисті модулі src/lib: список країн, дати, гроші, EXIF, точки з GPS; переклади. Запуск: npm run test:lib
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
import {
  formatMonthYear,
  formatPeriod,
  fromIsoDate,
  lastVisitDate,
  periodDays,
  toIsoDate,
} from '../src/lib/dates.ts';
import { parseCoordinate, parseExifDate, parsePhotoMeta, takenAtDate } from '../src/lib/exif.ts';
import { createCountryLocator, type FeatureCollection } from '../src/lib/geo.ts';
import {
  clusterPhotos,
  haversineKm,
  nearestCity,
  suggestPlaces,
  type GeoPhoto,
} from '../src/lib/photo-clusters.ts';
import { buildMapPoints, countPhotosByPlace } from '../src/lib/places.ts';
import {
  daysBetween,
  daysUntilStart,
  minusDays,
  splitTrips,
  tripPhase,
  tripReminders,
} from '../src/lib/trips.ts';
import {
  amountToInput,
  budgetProgress,
  convert,
  currencyDigits,
  defaultMainCurrency,
  findRate,
  foreignCurrencies,
  formatMoney,
  NUMBER_STYLES,
  parseAmount,
  parseRate,
  rateKey,
  rateToInput,
  summarizeExpenses,
  withRate,
} from '../src/lib/money.ts';

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

describe('дати візитів у картці країни', () => {
  test('toIsoDate / fromIsoDate — за місцевим часом, туди й назад', () => {
    assert.equal(toIsoDate(new Date(2024, 2, 5, 23, 59)), '2024-03-05');
    assert.equal(toIsoDate(fromIsoDate('2024-02-29')), '2024-02-29');
    assert.equal(fromIsoDate('2025-10-26').getHours(), 12);
  });

  test('formatPeriod: один місяць, різні місяці, різні роки, одна дата', () => {
    assert.equal(formatPeriod('2024-03-03', '2024-03-10', ukMonths), '3 – 10 бер. 2024');
    assert.equal(formatPeriod('2024-02-28', '2024-03-03', ukMonths), '28 лют. – 3 бер. 2024');
    assert.equal(formatPeriod('2023-12-30', '2024-01-02', ukMonths), '30 груд. 2023 – 2 січ. 2024');
    assert.equal(formatPeriod('2024-03-03', null, ukMonths), '3 бер. 2024');
    assert.equal(formatPeriod('2024-03-03', '2024-03-03', ukMonths), '3 бер. 2024');
    assert.equal(formatPeriod(null, null, ukMonths), null);
  });

  test('lastVisitDate — найпізніша дата, без дат — null (рядок у списку країн)', () => {
    assert.equal(lastVisitDate(['2024-03-01', null, '2025-08-02', '2023-01-01']), '2025-08-02');
    assert.equal(lastVisitDate([null, null]), null);
    assert.equal(lastVisitDate([]), null);
  });

  test('periodDays рахує дні включно, через кінець місяця й високосний рік', () => {
    assert.equal(periodDays('2024-03-03', '2024-03-10'), 8);
    assert.equal(periodDays('2024-02-28', '2024-03-01'), 3);
    assert.equal(periodDays('2024-05-01', '2024-05-01'), 1);
  });
});

describe('гроші', () => {
  const uk = NUMBER_STYLES.uk;
  const en = NUMBER_STYLES.en;

  test('знаки після коми за ISO 4217', () => {
    assert.equal(currencyDigits('UAH'), 2);
    assert.equal(currencyDigits('JPY'), 0);
    assert.equal(currencyDigits('KWD'), 3);
  });

  test('parseAmount: кома й крапка, пробіли, валюти без копійок', () => {
    assert.equal(parseAmount('12,5', 'UAH'), 1250);
    assert.equal(parseAmount('12.50', 'EUR'), 1250);
    assert.equal(parseAmount('1 200', 'UAH'), 120000);
    assert.equal(parseAmount('1500', 'JPY'), 1500);
    assert.equal(parseAmount('1.234', 'KWD'), 1234);
    assert.equal(parseAmount('0.1', 'USD'), 10);
  });

  test('parseAmount відхиляє нуль, мінус, зайві знаки й сміття', () => {
    for (const text of ['', '0', '0,00', '-5', '12.345', 'abc', '1,2,3', '1e5']) {
      assert.equal(parseAmount(text, 'UAH'), null, text);
    }
    assert.equal(parseAmount('10.5', 'JPY'), null);
  });

  test('amountToInput — зворотне до parseAmount', () => {
    assert.equal(amountToInput(1250, 'UAH'), '12.50');
    assert.equal(amountToInput(5, 'UAH'), '0.05');
    assert.equal(amountToInput(1500, 'JPY'), '1500');
    for (const minor of [1, 99, 100, 123456]) {
      assert.equal(parseAmount(amountToInput(minor, 'EUR'), 'EUR'), minor);
    }
  });

  test('formatMoney: групування розрядів за мовою, без нульових копійок', () => {
    assert.equal(formatMoney(123450, 'UAH', uk), '1 234,50 UAH');
    assert.equal(formatMoney(123450, 'UAH', en), '1,234.50 UAH');
    assert.equal(formatMoney(30000, 'EUR', en), '300 EUR');
    assert.equal(formatMoney(1234567, 'JPY', en), '1,234,567 JPY');
    assert.equal(formatMoney(5, 'USD', en), '0.05 USD');
  });

  test('курси: прямий, обернений, однакова валюта, немає курсу', () => {
    const rates = { [rateKey('EUR', 'UAH')]: 45 };
    assert.equal(findRate(rates, 'EUR', 'UAH'), 45);
    assert.equal(findRate(rates, 'UAH', 'EUR'), 1 / 45);
    assert.equal(findRate(rates, 'USD', 'USD'), 1);
    assert.equal(findRate(rates, 'USD', 'UAH'), null);
  });

  test('convert враховує різну кількість знаків після коми', () => {
    const rates = { 'JPY>UAH': 0.27, 'EUR>UAH': 45 };
    assert.equal(convert(1000, 'JPY', 'UAH', rates), 27000); // 1000 ¥ → 270,00 ₴
    assert.equal(convert(1050, 'EUR', 'UAH', rates), 47250); // 10,50 € → 472,50 ₴
    assert.equal(convert(4500, 'UAH', 'EUR', rates), 100); // обернений курс
    assert.equal(convert(100, 'GBP', 'UAH', rates), null);
  });

  test('withRate: новий курс замінює обернений, null прибирає', () => {
    const base = { 'UAH>EUR': 0.022, 'USD>UAH': 41 };
    assert.deepEqual(withRate(base, 'EUR', 'UAH', 45), { 'USD>UAH': 41, 'EUR>UAH': 45 });
    assert.deepEqual(withRate(base, 'USD', 'UAH', null), { 'UAH>EUR': 0.022 });
    assert.deepEqual(base, { 'UAH>EUR': 0.022, 'USD>UAH': 41 }, 'оригінал не змінюється');
  });

  test('parseRate / rateToInput', () => {
    assert.equal(parseRate('41,5'), 41.5);
    assert.equal(parseRate(' 0.027 '), 0.027);
    for (const text of ['', '0', '-1', 'abc', '1,2,3']) assert.equal(parseRate(text), null, text);
    assert.equal(rateToInput(41.5), '41.5');
    assert.equal(rateToInput(1 / 3), '0.333333');
  });

  test('summarizeExpenses: підсумок в основній валюті, категорії, валюти без курсу окремо', () => {
    const s = summarizeExpenses(
      [
        { amount: 100000, currency: 'UAH', category: 'food' },
        { amount: 2000, currency: 'EUR', category: 'food' },
        { amount: 5000, currency: 'EUR', category: 'lodging' },
        { amount: 3000, currency: 'GBP', category: 'transport' },
        { amount: 1000, currency: 'GBP', category: 'food' },
      ],
      'UAH',
      { 'EUR>UAH': 45 },
    );
    assert.equal(s.currency, 'UAH');
    assert.equal(s.total, 100000 + 90000 + 225000);
    assert.deepEqual(
      [...s.byCategory],
      [
        ['food', 190000],
        ['lodging', 225000],
      ],
    );
    assert.deepEqual([...s.unconverted], [['GBP', 4000]]);
  });

  test('foreignCurrencies і основна валюта за замовчуванням', () => {
    assert.deepEqual(
      foreignCurrencies([{ currency: 'USD' }, { currency: 'EUR' }, { currency: 'UAH' }], 'UAH'),
      ['EUR', 'USD'],
    );
    assert.equal(defaultMainCurrency('UA'), 'UAH');
    assert.equal(defaultMainCurrency('pl'), 'USD');
    assert.equal(defaultMainCurrency(null), 'USD');
  });
});

describe('EXIF фото', () => {
  test('iOS: дата з верхнього рівня, GPS у вкладеному {GPS} з N/S і E/W', () => {
    const meta = parsePhotoMeta({
      DateTimeOriginal: '2024:03:15 14:22:01',
      '{GPS}': { Latitude: 44.952, LatitudeRef: 'N', Longitude: 34.102, LongitudeRef: 'E' },
    });
    assert.deepEqual(meta, { takenAt: '2024-03-15T14:22:01', lat: 44.952, lng: 34.102 });
  });

  test('iOS: південна й західна півкулі дають від’ємні координати', () => {
    const meta = parsePhotoMeta({
      '{Exif}': { DateTimeOriginal: '2023:07:01 09:00:00' },
      '{GPS}': { Latitude: 22.9068, LatitudeRef: 'S', Longitude: 43.1729, LongitudeRef: 'W' },
    });
    assert.deepEqual(meta, { takenAt: '2023-07-01T09:00:00', lat: -22.9068, lng: -43.1729 });
  });

  test('Android: раціональні рядки DMS з GPSLatitudeRef', () => {
    const meta = parsePhotoMeta({
      DateTimeOriginal: '2025:08:15 18:05:30',
      GPSLatitude: '50/1,27/1,0/1',
      GPSLatitudeRef: 'N',
      GPSLongitude: '30/1,31/1,1200/100',
      GPSLongitudeRef: 'E',
    });
    assert.equal(meta.takenAt, '2025-08-15T18:05:30');
    assert.equal(meta.lat, 50.45);
    assert.equal(meta.lng, 30.52);
  });

  test('Android: десяткові числа зі знаком', () => {
    const meta = parsePhotoMeta({ GPSLatitude: -33.8688, GPSLongitude: 151.2093 });
    assert.deepEqual(meta, { takenAt: null, lat: -33.8688, lng: 151.2093 });
  });

  test('немає EXIF, порожній GPS (0,0), биті дати — null', () => {
    const empty = { takenAt: null, lat: null, lng: null };
    assert.deepEqual(parsePhotoMeta(null), empty);
    assert.deepEqual(parsePhotoMeta({ GPSLatitude: 0, GPSLongitude: 0 }), empty);
    assert.equal(parseExifDate('0000:00:00 00:00:00'), null);
    assert.equal(parseExifDate('2024:02:30 10:00:00'), null);
    assert.equal(parsePhotoMeta({ GPSLatitude: 'garbage', GPSLongitude: 10 }).lat, null);
  });

  test('без DateTimeOriginal береться DateTimeDigitized, далі {TIFF}.DateTime', () => {
    assert.equal(
      parsePhotoMeta({ DateTimeDigitized: '2022:01:02 03:04:05' }).takenAt,
      '2022-01-02T03:04:05',
    );
    assert.equal(
      parsePhotoMeta({ '{TIFF}': { DateTime: '2021:05:06 07:08:09' } }).takenAt,
      '2021-05-06T07:08:09',
    );
    assert.equal(takenAtDate('2021-05-06T07:08:09'), '2021-05-06');
  });

  test('parseCoordinate: масив [градуси, хвилини, секунди]', () => {
    assert.equal(parseCoordinate([50, 30, 0]), 50.5);
  });
});

describe('переклади', () => {
  type Tree = { [key: string]: string | string[] | Tree };
  const load = (lang: string) =>
    JSON.parse(readFileSync(join(ROOT, `src/i18n/${lang}.json`), 'utf8')) as Tree;

  /** Ключі з крапками; форми множини (_one, _few, _many, _other) зводяться до одного ключа. */
  function keys(tree: Tree, prefix = ''): Set<string> {
    const out = new Set<string>();
    for (const [k, v] of Object.entries(tree)) {
      const key = prefix + k.replace(/_(zero|one|two|few|many|other)$/, '');
      if (typeof v === 'object' && !Array.isArray(v)) {
        for (const nested of keys(v, `${key}.`)) out.add(nested);
      } else out.add(key);
    }
    return out;
  }

  test('uk.json і en.json мають однакові ключі', () => {
    const uk = keys(load('uk'));
    const en = keys(load('en'));
    assert.deepEqual(
      [...uk].filter((k) => !en.has(k)),
      [],
      'є в uk, немає в en',
    );
    assert.deepEqual(
      [...en].filter((k) => !uk.has(k)),
      [],
      'є в en, немає в uk',
    );
  });

  test('українські форми множини: one, few, many, other', () => {
    const flat = JSON.stringify(load('uk'));
    for (const m of flat.matchAll(/"(\w+)_one"/g)) {
      for (const form of ['few', 'many', 'other']) {
        assert.ok(flat.includes(`"${m[1]}_${form}"`), `${m[1]}_${form}`);
      }
    }
  });
});

describe('точки з фото з GPS', () => {
  const photo = (
    id: string,
    lat: number | null,
    lng: number | null,
    takenAt: string | null = '2025-08-03T10:00:00',
    placeId: string | null = null,
  ): GeoPhoto => ({ id, lat, lng, takenAt, placeId });

  test('haversineKm: Київ — Львів ≈ 470 км', () => {
    const km = haversineKm(50.4501, 30.5234, 49.8397, 24.0297);
    assert.ok(km > 460 && km < 480, String(km));
  });

  test('фото ближче за 1 км в один день — одна група, центр — середнє', () => {
    const clusters = clusterPhotos([
      photo('a', 50.45, 30.52),
      photo('b', 50.454, 30.52), // ~450 м
      photo('c', 50.6, 30.52), // ~17 км — окремо
    ]);
    assert.equal(clusters.length, 2);
    assert.deepEqual(clusters[0].photoIds.sort(), ['a', 'b']);
    assert.equal(clusters[0].lat, 50.452);
    assert.equal(clusters[0].date, '2025-08-03');
    assert.deepEqual(clusters[1].photoIds, ['c']);
  });

  test('ланцюжок: кожне фото поруч із сусіднім — одна група, навіть якщо краї далі за 1 км', () => {
    const clusters = clusterPhotos([
      photo('a', 50.45, 30.52),
      photo('b', 50.458, 30.52), // ~890 м від a
      photo('c', 50.466, 30.52), // ~890 м від b, ~1,8 км від a
    ]);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].photoIds.length, 3);
  });

  test('те саме місце в різні дні — різні точки; фото без GPS і вже в точці не беруться', () => {
    const clusters = clusterPhotos([
      photo('a', 50.45, 30.52, '2025-08-03T10:00:00'),
      photo('b', 50.45, 30.52, '2025-08-04T09:00:00'),
      photo('nogps', null, null),
      photo('placed', 50.45, 30.52, '2025-08-03T11:00:00', 'place-1'),
    ]);
    assert.deepEqual(
      clusters.map((c) => [c.date, c.photoIds]),
      [
        ['2025-08-03', ['a']],
        ['2025-08-04', ['b']],
      ],
    );
  });

  test('фото без дати групуються окремо, з date = null, і йдуть останніми', () => {
    const clusters = clusterPhotos([photo('x', 1, 1, null), photo('y', 2, 2)]);
    assert.deepEqual(
      clusters.map((c) => c.date),
      ['2025-08-03', null],
    );
  });

  test('nearestCity: найближче місто в межах 30 км, інакше null', () => {
    const cities = [
      {
        name: { uk: 'Львів', en: 'Lviv' },
        iso2: 'UA',
        lat: 49.84,
        lng: 24.03,
        capital: false,
        pop: 1,
      },
      {
        name: { uk: 'Київ', en: 'Kyiv' },
        iso2: 'UA',
        lat: 50.45,
        lng: 30.52,
        capital: true,
        pop: 1,
      },
    ];
    assert.equal(nearestCity(cities, 49.85, 24.05)?.name.uk, 'Львів');
    assert.equal(nearestCity(cities, 48.0, 27.0), null);
  });

  test('suggestPlaces: країна за координатами, пропущені фото не пропонуються', () => {
    const suggestions = suggestPlaces({
      photos: [photo('a', 43.7, 7.27), photo('b', 41.9, 12.5), photo('skip', 45.0, 9.0)],
      sourceIso: 'IT',
      skipped: new Set(['skip']),
      cities: [],
      locate: (lng, lat) => (lng < 7.5 && lat > 43.5 ? 'FR' : 'IT'),
    });
    assert.deepEqual(
      suggestions.map((s) => [s.photoIds, s.countryIso, s.sourceIso]),
      [
        [['a'], 'FR', 'IT'],
        [['b'], 'IT', 'IT'],
      ],
    );
  });
});

describe('країна фото за координатами — наші кордони', () => {
  const borders = JSON.parse(
    readFileSync(join(ROOT, 'src/data/borders.geojson'), 'utf8'),
  ) as FeatureCollection<{ iso2: string }>;
  const locate = createCountryLocator(borders.features);

  test('Крим — Україна (Сімферополь, Ялта, Севастополь)', () => {
    assert.equal(locate([34.1, 44.95]), 'UA');
    assert.equal(locate([34.16, 44.5]), 'UA');
    assert.equal(locate([33.52, 44.6]), 'UA');
  });

  test('звичайні міста й узбережжя', () => {
    assert.equal(locate([2.35, 48.86]), 'FR'); // Париж
    assert.equal(locate([12.5, 41.9]), 'IT'); // Рим
    assert.equal(locate([7.27, 43.695]), 'FR'); // Ніцца, набережна
    assert.equal(locate([-30, 30]), null); // Атлантика
  });
});

describe('точки на глобусі', () => {
  test('мініатюра — перше фото за датою зйомки; без фото — null; без координат — немає точки', () => {
    const points = buildMapPoints(
      [
        { id: 'p1', countryIso: 'UA', title: 'A', lat: 50, lng: 30 },
        { id: 'p2', countryIso: 'UA', title: 'B', lat: 49, lng: 24 },
        { id: 'p3', countryIso: 'UA', title: 'C', lat: null, lng: null },
      ],
      [
        {
          id: 'late',
          placeId: 'p1',
          thumbUri: 'photos/late_t.jpg',
          takenAt: '2025-05-02T10:00:00',
          createdAt: '1',
        },
        {
          id: 'early',
          placeId: 'p1',
          thumbUri: 'photos/early_t.jpg',
          takenAt: '2025-05-01T10:00:00',
          createdAt: '2',
        },
        {
          id: 'nodate',
          placeId: 'p1',
          thumbUri: 'photos/nodate_t.jpg',
          takenAt: null,
          createdAt: '0',
        },
      ],
    );
    assert.deepEqual(
      points.map((p) => [p.id, p.thumbnail]),
      [
        ['p1', 'photos/early_t.jpg'],
        ['p2', null],
      ],
    );
  });

  test('countPhotosByPlace', () => {
    const counts = countPhotosByPlace([{ placeId: 'a' }, { placeId: 'a' }, { placeId: null }]);
    assert.deepEqual([...counts], [['a', 2]]);
  });
});

describe('поїздки (чисті функції)', () => {
  const trip = (startDate: string | null, endDate: string | null = null) => ({
    startDate,
    endDate,
  });

  test('фаза: майбутня, триває (включно з днями початку й кінця), минула, без дат', () => {
    assert.equal(tripPhase(trip('2025-12-06', '2025-12-10'), '2025-12-05'), 'upcoming');
    assert.equal(tripPhase(trip('2025-12-06', '2025-12-10'), '2025-12-06'), 'ongoing');
    assert.equal(tripPhase(trip('2025-12-06', '2025-12-10'), '2025-12-10'), 'ongoing');
    assert.equal(tripPhase(trip('2025-12-06', '2025-12-10'), '2025-12-11'), 'past');
    assert.equal(tripPhase(trip('2025-12-06'), '2025-12-07'), 'past', 'одноденна');
    assert.equal(tripPhase(trip(null), '2025-12-07'), 'undated');
  });

  test('днів до початку', () => {
    assert.equal(daysUntilStart(trip('2025-12-06'), '2025-11-24'), 12);
    assert.equal(daysUntilStart(trip('2026-01-01'), '2025-12-31'), 1);
    assert.equal(daysUntilStart(trip('2025-12-06'), '2025-12-06'), null);
    assert.equal(daysUntilStart(trip(null), '2025-12-06'), null);
  });

  test('список: тривають → майбутні (найближча зверху) → без дат; минулі — найсвіжіша зверху', () => {
    const list = [
      { id: 'past-old', ...trip('2024-05-01', '2024-05-03') },
      { id: 'far', ...trip('2026-08-01') },
      { id: 'undated', ...trip(null) },
      { id: 'now', ...trip('2025-12-01', '2025-12-20') },
      { id: 'soon', ...trip('2026-01-10') },
      { id: 'past-new', ...trip('2025-10-01', '2025-10-05') },
    ];
    const { current, past } = splitTrips(list, '2025-12-10');
    assert.deepEqual(
      current.map((x) => x.id),
      ['now', 'soon', 'far', 'undated'],
    );
    assert.deepEqual(
      past.map((x) => x.id),
      ['past-new', 'past-old'],
    );
  });

  test('нагадування: за 30, 7, 3 і 1 день о 9:00, лише майбутні, лише заплановані', () => {
    const trips = [
      { id: 'a', status: 'planned' as const, ...trip('2026-01-10', '2026-01-15') },
      { id: 'b', status: 'done' as const, ...trip('2026-01-10') },
      { id: 'c', status: 'planned' as const, ...trip(null) },
    ];
    assert.deepEqual(
      tripReminders(trips, '2025-12-01', 8).map((r) => [r.id, r.date]),
      [
        ['trip-a-30', '2025-12-11'],
        ['trip-a-7', '2026-01-03'],
        ['trip-a-3', '2026-01-07'],
        ['trip-a-1', '2026-01-09'],
      ],
    );
    // 3 січня: о 8:00 нагадування «за тиждень» ще попереду, о 10:00 — вже ні
    assert.equal(tripReminders(trips, '2026-01-03', 8)[0].daysBefore, 7);
    assert.equal(tripReminders(trips, '2026-01-03', 10)[0].daysBefore, 3);
    assert.deepEqual(tripReminders(trips, '2026-01-10', 8), []);
  });

  test('minusDays і daysBetween через межі місяців і років', () => {
    assert.equal(minusDays('2026-01-01', 1), '2025-12-31');
    assert.equal(minusDays('2024-03-01', 1), '2024-02-29');
    assert.equal(daysBetween('2025-12-31', '2026-01-30'), 30);
  });
});

describe('бюджет поїздки', () => {
  test('витрачено у валюті бюджету за курсами; понад бюджет; валюти без курсу окремо', () => {
    const p = budgetProgress(
      1000_00,
      'EUR',
      [
        { amount: 600_00, currency: 'EUR' },
        { amount: 9000_00, currency: 'UAH' },
        { amount: 50_00, currency: 'GBP' },
      ],
      { 'EUR>UAH': 45 },
    );
    assert.equal(p.spent, 800_00);
    assert.equal(p.ratio, 0.8);
    assert.equal(p.over, 0);
    assert.deepEqual([...p.unconverted], [['GBP', 5000]]);
    const over = budgetProgress(500_00, 'EUR', [{ amount: 600_00, currency: 'EUR' }], {});
    assert.equal(over.over, 100_00);
    assert.ok(over.ratio > 1);
  });
});
