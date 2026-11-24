/**
 * Закріплені джерела даних. Зміна версії = свідоме рішення: оновити ref і sha256,
 * перезібрати (`npm run build:data`) і прогнати тести (`npm run test:data`).
 */

/** Natural Earth, тег v5.1.2 (дані 5.1.1). Суспільне надбання. */
const NE_REF = 'f1890d9f152c896d250a77557a5751a93d494776';
const NE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_REF}/geojson`;

/** mledoze/countries. ODbL 1.0 — атрибуція + share-alike для похідної бази. */
const MLEDOZE_REF = '5d15c0ff8c87ef2f1f8e944093522d4b2de2dd5b';

export type Source = { file: string; url: string; sha256: string };

export const SOURCES = {
  /** Кордони 1:10m з точкою зору України (Крим і ОРДЛО — Україна). 1:50m _ukr не існує. */
  borders: {
    file: 'ne_10m_admin_0_countries_ukr.geojson',
    url: `${NE}/ne_10m_admin_0_countries_ukr.geojson`,
    sha256: '28a1a17d7327cad576083d5122b867843f957468b1bb11168ded23fd5aea342e',
  },
  /** Населені пункти 1:10m — міста й назви столиць (є NAME_UK). */
  places: {
    file: 'ne_10m_populated_places.geojson',
    url: `${NE}/ne_10m_populated_places.geojson`,
    sha256: '9b8e3de09048ef00dfc70357dbb9fa324493f214b5e0ae4daf1aa79a8d10116b',
  },
  /** Столиці en, валюти, членство в ООН. */
  countries: {
    file: 'mledoze-countries.json',
    url: `https://raw.githubusercontent.com/mledoze/countries/${MLEDOZE_REF}/countries.json`,
    sha256: 'c48c0d479fc71799c8f5b1b1a6eee4a4a6a86f626c29b9db62b542bf1b8d8741',
  },
} satisfies Record<string, Source>;
