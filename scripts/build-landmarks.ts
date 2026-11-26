/**
 * Збирає src/data/landmarks.json — «варто побачити» для кожної країни (етап 8).
 * Запуск: npm run build:landmarks   (потрібен інтернет; у додаток нічого не тягнеться)
 *
 * Джерело — Wikidata (CC0). Беремо об'єкти визначних класів з координатами й назвами uk/en,
 * рейтинг — кількість мовних версій статей у Вікіпедії (wikibase:sitelinks).
 * Країну місця визначаємо за НАШИМИ кордонами (точка в полігоні, Natural Earth `_ukr`),
 * а не за полем «країна» з Wikidata: Ластівчине гніздо — Україна.
 *
 * Сирі відповіді кешуються в scripts/.cache/wikidata/ (видаліть, щоб оновити). Wikidata
 * змінюється — відтворюваність дає закомічений результат; перезбирати свідомо.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BorderProps, Country, Landmark, LandmarksFile } from '../src/data/types.ts';
import { createCountryLocator, type FeatureCollection } from './lib/geo.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts', '.cache', 'wikidata');
const OUT = join(ROOT, 'src', 'data', 'landmarks.json');

const ENDPOINT = 'https://query.wikidata.org/sparql';
/** Загальний User-Agent (правила Wikimedia вимагають його), без даних автора */
const USER_AGENT = 'GoldmapDataBuild/1.0 (offline travel-tracker data build; CC0 landmarks)';
/** Найменше мовних версій, щоб об'єкт узагалі розглядався */
const MIN_SITELINKS = 8;
/** Скільки місць на країну */
export const PER_COUNTRY = 15;
/** Полігон, менший за це (град²), — мікродержава; навколо неї запас TINY_PAD_DEG (~300 м) */
const TINY_AREA_DEG2 = 0.0001;
const TINY_PAD_DEG = 0.003;
/** Місце ближче за це до вже взятого (інша сутність того ж об'єкта) — дублікат, км */
const DUPLICATE_KM = 0.3;

/** Класи визначних місць (wdt:P31 напряму — без P279*, інакше запит не вкладається в ліміт). */
const CLASSES: Record<string, string> = {
  Q23413: 'castle',
  Q16560: 'palace',
  Q2977: 'cathedral',
  Q163687: 'basilica',
  Q16970: 'church building',
  Q32815: 'mosque',
  Q44539: 'temple',
  Q842402: 'Hindu temple',
  Q5393308: 'Buddhist temple',
  Q44613: 'monastery',
  Q33506: 'museum',
  Q207694: 'art museum',
  Q46169: 'national park',
  Q8502: 'mountain',
  Q8072: 'volcano',
  Q34038: 'waterfall',
  Q23397: 'lake',
  Q12280: 'bridge',
  Q12518: 'tower',
  Q4989906: 'monument',
  Q839954: 'archaeological site',
  Q1785071: 'fortress',
  Q57821: 'fortification',
  Q174782: 'square',
  Q11303: 'skyscraper',
  Q179700: 'statue',
  Q150784: 'canyon',
  Q35509: 'cave',
  Q39715: 'lighthouse',
  Q194195: 'amusement park',
  Q43501: 'zoo',
  Q153562: 'opera house',
  Q22698: 'park',
  Q109607: 'ruins',
  Q12516: 'pyramid',
  Q162875: 'mausoleum',
  Q641226: 'triumphal arch',
  Q167346: 'botanical garden',
  Q570116: 'tourist attraction',
};

/** Великі класи (тисячі гір і озер) — вищий поріг, щоб запит уклався в ліміт часу Wikidata */
const MIN_SITELINKS_BY_CLASS: Record<string, number> = { Q8502: 25, Q23397: 25, Q22698: 15 };

/** Пам'ятки Світової спадщини ЮНЕСКО (P1435 = Q9259) — окремим запитом */
const HERITAGE = 'Q9259';

type Row = { id: string; uk?: string; en?: string; lat: number; lng: number; links: number };
type Binding = Record<string, { value: string } | undefined>;

function query(where: string, minLinks = MIN_SITELINKS): string {
  return `SELECT ?item ?uk ?en ?coord ?links WHERE {
  ${where}
  ?item wdt:P625 ?coord; wikibase:sitelinks ?links.
  FILTER(?links >= ${minLinks})
  OPTIONAL { ?item rdfs:label ?uk FILTER(LANG(?uk) = "uk") }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
}`;
}

async function fetchRows(key: string, sparql: string): Promise<Row[]> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `${key}.json`);
  if (!existsSync(path)) {
    console.log(`↓ ${key}`);
    const get = () =>
      fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
      });
    let res = await get();
    if (res.status === 504 || res.status === 502 || res.status === 503 || res.status === 429) {
      console.log(`  ${res.status} — повтор через 10 с`);
      await new Promise((r) => setTimeout(r, 10_000));
      res = await get();
    }
    if (!res.ok) throw new Error(`${res.status} ${key}: ${(await res.text()).slice(0, 300)}`);
    writeFileSync(path, await res.text());
    await new Promise((r) => setTimeout(r, 1500)); // ввічливо до сервісу
  }
  const json = JSON.parse(readFileSync(path, 'utf8')) as { results: { bindings: Binding[] } };
  const rows: Row[] = [];
  for (const b of json.results.bindings) {
    const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(b.coord?.value ?? '');
    if (!m || !b.item) continue;
    rows.push({
      id: b.item.value.replace('http://www.wikidata.org/entity/', ''),
      uk: b.uk?.value,
      en: b.en?.value,
      lng: Number(m[1]),
      lat: Number(m[2]),
      links: Number(b.links?.value ?? 0),
    });
  }
  return rows;
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * 6371;
}

/** Назва з Wikidata без службового «Q123» замість мітки. */
function cleanName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed && !/^Q\d+$/.test(trimmed) ? trimmed : undefined;
}

async function main() {
  const borders = JSON.parse(
    readFileSync(join(ROOT, 'src', 'data', 'borders.geojson'), 'utf8'),
  ) as FeatureCollection<BorderProps>;
  const countries = JSON.parse(
    readFileSync(join(ROOT, 'src', 'data', 'countries.json'), 'utf8'),
  ) as Country[];
  const known = new Set(countries.map((c) => c.iso2));
  // Сама країна (Ватикан, Монако) — не «місце в країні»
  const countryNames = new Set(countries.flatMap((c) => [c.name.uk, c.name.en]));
  // Прибережні пам'ятки (маяки, фортеці на мисах) — найближча країна в межах ~10 км
  const locateByPolygon = createCountryLocator(borders.features, 0.1);
  // Мікродержави (Ватикан, Монако) після спрощення кордонів — крихітні прямокутники, і
  // їхні пам'ятки (Музеї Ватикану) лежать трохи поза ними. Для таких — запас ~300 м.
  const tiny = borders.features
    .map((f) => {
      const ring =
        f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
      const xs = ring.map((p) => p[0]);
      const ys = ring.map((p) => p[1]);
      return {
        iso2: f.properties.iso2,
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      };
    })
    .filter(({ box }) => (box[2] - box[0]) * (box[3] - box[1]) < TINY_AREA_DEG2);
  const locate = ([lng, lat]: [number, number]) =>
    tiny.find(
      ({ box }) =>
        lng >= box[0] - TINY_PAD_DEG &&
        lng <= box[2] + TINY_PAD_DEG &&
        lat >= box[1] - TINY_PAD_DEG &&
        lat <= box[3] + TINY_PAD_DEG,
    )?.iso2 ?? locateByPolygon([lng, lat]);

  const all = new Map<string, Row & { kind: string }>();
  for (const [qid, kind] of Object.entries(CLASSES)) {
    const rows = await fetchRows(
      `class-${qid}`,
      query(`?item wdt:P31 wd:${qid}.`, MIN_SITELINKS_BY_CLASS[qid]),
    );
    console.log(`  ${kind.padEnd(20)} ${rows.length}`);
    for (const r of rows) if (!all.has(r.id)) all.set(r.id, { ...r, kind });
  }
  const heritage = await fetchRows('heritage', query(`?item wdt:P1435 wd:${HERITAGE}.`));
  console.log(`  ${'UNESCO'.padEnd(20)} ${heritage.length}`);
  for (const r of heritage) if (!all.has(r.id)) all.set(r.id, { ...r, kind: 'UNESCO' });

  const byCountry = new Map<string, Landmark[]>();
  let outside = 0;
  for (const r of [...all.values()].sort((a, b) => b.links - a.links || a.id.localeCompare(b.id))) {
    const uk = cleanName(r.uk);
    const en = cleanName(r.en);
    if (!uk && !en) continue;
    if ((uk && countryNames.has(uk)) || (en && countryNames.has(en))) continue;
    const iso2 = locate([r.lng, r.lat]);
    if (!iso2 || !known.has(iso2)) {
      outside++;
      continue;
    }
    const list = byCountry.get(iso2) ?? [];
    if (list.length >= PER_COUNTRY) continue;
    if (list.some((l) => km(l, r) < DUPLICATE_KM)) continue;
    list.push({
      id: r.id,
      name: { uk: uk ?? en!, en: en ?? uk! },
      lat: Math.round(r.lat * 1e5) / 1e5,
      lng: Math.round(r.lng * 1e5) / 1e5,
      rank: r.links,
    });
    byCountry.set(iso2, list);
  }

  const out: LandmarksFile = {
    source: 'Wikidata (CC0), https://www.wikidata.org',
    fetchedAt: new Date().toISOString().slice(0, 10),
    countries: Object.fromEntries([...byCountry.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(OUT, JSON.stringify(out) + '\n');
  const total = [...byCountry.values()].reduce((n, l) => n + l.length, 0);
  console.log(
    `landmarks.json: ${total} місць у ${byCountry.size} країнах ` +
      `(${(JSON.stringify(out).length / 1024).toFixed(0)} КБ; поза кордонами: ${outside})`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
