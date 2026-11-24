/**
 * Збирає src/data/{borders.geojson,countries.json,cities.json} із закріплених джерел.
 * Запуск: npm run build:data   (інтернет потрібен лише тут, у додаток нічого не тягнеться)
 *
 * Кордони — Natural Earth з точкою зору України: Крим і всі тимчасово окуповані
 * території — Україна. Країну кожного міста визначаємо за цими полігонами,
 * а НЕ за полем ISO_A2 у файлі міст (там Сімферополь записаний як RU).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BorderProps, City, Continent, Country, LocalizedName } from '../src/data/types.ts';
import { SOURCES, type Source } from './data-sources.ts';
import { createCountryLocator, type Feature, type FeatureCollection } from './lib/geo.ts';
import { buildOutline, type Outline } from './lib/outline.ts';
import {
  CAPITAL_OVERRIDES,
  CITY_COUNTRY_OVERRIDES,
  CONTINENT_OVERRIDES,
  CURRENCY_OVERRIDES,
  NAME_OVERRIDES,
} from './overrides.ts';

const require = createRequire(import.meta.url);
const mapshaper = require('mapshaper') as {
  applyCommands(cmd: string, input: Record<string, unknown>): Promise<Record<string, string>>;
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts', '.cache');
const OUT = join(ROOT, 'src', 'data');

const MAX_BORDERS_BYTES = 3 * 1024 * 1024;
/** Частка вершин, що лишається після спрощення (Visvalingam, weighted). */
const SIMPLIFY = '10%';
/** Спрощення силуетів для картки (досить ~100 px деталізації). */
const OUTLINE_SIMPLIFY = '3%';
/** Менше вершин — силует будуємо з повної геометрії. */
const MIN_OUTLINE_POINTS = 24;
const MAX_FULL_OUTLINE_POINTS = 200;
const CITY_MIN_POP = 100_000;

// ---------- завантаження ----------

async function fetchSource(src: Source): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, src.file);
  if (!existsSync(path)) {
    console.log(`↓ ${src.url}`);
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`${res.status} ${src.url}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  const buf = readFileSync(path);
  const hash = createHash('sha256').update(buf).digest('hex');
  if (!src.sha256) {
    console.warn(`! ${src.file}: sha256 не закріплено — ${hash}`);
  } else if (hash !== src.sha256) {
    throw new Error(`${src.file}: sha256 ${hash} ≠ очікуваного ${src.sha256}`);
  }
  return buf.toString('utf8');
}

// ---------- типи джерел ----------

type NeCountry = {
  ADM0_A3: string;
  ISO_A2_EH: string;
  ISO_A3_EH: string;
  NAME_EN: string;
  NAME_UK: string | null;
  CONTINENT: string;
  LABEL_X: number;
  LABEL_Y: number;
  POP_EST: number;
};

type NePlace = {
  NAME: string;
  NAMEASCII: string;
  NAMEALT: string | null;
  NAME_EN: string | null;
  NAME_UK: string | null;
  ISO_A2: string;
  ADM0CAP: number;
  LATITUDE: number;
  LONGITUDE: number;
  POP_MAX: number;
};

type Mledoze = {
  cca2: string;
  capital?: string[];
  currencies?: Record<string, unknown>;
  unMember: boolean;
};

// ---------- допоміжне ----------

const CONTINENTS: Record<string, Continent> = {
  Europe: 'europe',
  Asia: 'asia',
  Africa: 'africa',
  'North America': 'north-america',
  'South America': 'south-america',
  Oceania: 'oceania',
  Antarctica: 'antarctica',
};

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

function flagEmoji(iso2: string): string {
  return String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function placeMatches(p: NePlace, name: string): boolean {
  const n = name.toLowerCase();
  return [p.NAME, p.NAMEASCII, p.NAME_EN, ...(p.NAMEALT ?? '').split('|')].some(
    (v) => v?.toLowerCase() === n,
  );
}

// ---------- збірка ----------

async function main() {
  const [bordersRaw, placesRaw, mledozeRaw] = await Promise.all([
    fetchSource(SOURCES.borders),
    fetchSource(SOURCES.places),
    fetchSource(SOURCES.countries),
  ]);
  const ne = JSON.parse(bordersRaw) as FeatureCollection<NeCountry>;
  const places = (JSON.parse(placesRaw) as FeatureCollection<NePlace>).features.map(
    (f) => f.properties,
  );
  const mledoze = new Map((JSON.parse(mledozeRaw) as Mledoze[]).map((c) => [c.cca2, c]));

  // 1. Полігони з ISO-кодом. Без коду (-99) — бази, Бір-Тавіль, Спратлі — відкидаємо.
  const valid = ne.features.filter((f) => /^[A-Z]{2}$/.test(f.properties.ISO_A2_EH));
  const dropped = ne.features.filter((f) => !valid.includes(f)).map((f) => f.properties.ADM0_A3);
  console.log(`кордони: ${valid.length} полігонів, відкинуто без ISO: ${dropped.join(', ')}`);

  // Головний запис країни — той, де ADM0_A3 = ISO_A3 (Франція, а не Кліппертон).
  const main = new Map<string, NeCountry>();
  for (const { properties: p } of valid) {
    const cur = main.get(p.ISO_A2_EH);
    if (!cur || (p.ADM0_A3 === p.ISO_A3_EH && cur.ADM0_A3 !== cur.ISO_A3_EH)) {
      main.set(p.ISO_A2_EH, p);
    }
  }

  // 2. Кордони: об'єднати за iso2, спростити, обрізати точність.
  const rawBorders: FeatureCollection<BorderProps> = {
    type: 'FeatureCollection',
    features: valid.map((f) => ({
      type: 'Feature',
      properties: { iso2: f.properties.ISO_A2_EH },
      geometry: f.geometry,
    })),
  };
  const out = await mapshaper.applyCommands(
    `-i in.json -dissolve iso2 -simplify ${SIMPLIFY} weighted keep-shapes ` +
      `-o out.json format=geojson precision=0.0001`,
    { 'in.json': rawBorders },
  );
  const bordersJson = String(out['out.json']);
  writeFileSync(join(OUT, 'borders.geojson'), bordersJson);
  const bytes = statSync(join(OUT, 'borders.geojson')).size;
  console.log(`borders.geojson: ${(bytes / 1024 / 1024).toFixed(2)} МБ`);
  if (bytes > MAX_BORDERS_BYTES) throw new Error('borders.geojson > 3 МБ — зменш SIMPLIFY');

  // 3. Міста: країна — за повними (не спрощеними) полігонами з точкою зору України.
  const locate = createCountryLocator(rawBorders.features as Feature<BorderProps>[]);
  const reassigned: string[] = [];
  const unplaced: string[] = [];
  const cities: City[] = [];
  for (const p of places) {
    const isCapital = p.ADM0CAP === 1;
    if (p.POP_MAX < CITY_MIN_POP && !isCapital) continue;
    const iso2 =
      CITY_COUNTRY_OVERRIDES[p.NAME] ??
      locate([p.LONGITUDE, p.LATITUDE]) ??
      (main.has(p.ISO_A2) ? p.ISO_A2 : null);
    if (!iso2) {
      unplaced.push(p.NAME);
      continue;
    }
    if (iso2 !== p.ISO_A2) reassigned.push(`${p.NAME} ${p.ISO_A2}→${iso2}`);
    cities.push({
      name: { uk: p.NAME_UK ?? p.NAME, en: p.NAME_EN ?? p.NAME },
      iso2,
      lat: round(p.LATITUDE),
      lng: round(p.LONGITUDE),
      capital: isCapital,
      pop: p.POP_MAX,
    });
  }
  cities.sort((a, b) => b.pop - a.pop || a.name.en.localeCompare(b.name.en));
  console.log(`cities.json: ${cities.length} міст`);
  console.log(`  країну змінено за полігонами (${reassigned.length}): ${reassigned.join(', ')}`);
  if (unplaced.length) console.log(`  без країни, пропущено: ${unplaced.join(', ')}`);

  // 4. Країни.
  const unMembers = new Set(
    [...mledoze.values()].filter((c) => c.unMember && c.cca2 !== 'VA').map((c) => c.cca2),
  );
  const problems: string[] = [];
  const countries: Country[] = [];
  for (const [iso2, p] of [...main].sort(([a], [b]) => a.localeCompare(b))) {
    const m = mledoze.get(iso2);
    const continent = CONTINENT_OVERRIDES[iso2] ?? CONTINENTS[p.CONTINENT];
    if (!continent) problems.push(`${iso2}: невідомий континент «${p.CONTINENT}»`);

    let capital: LocalizedName | null = CAPITAL_OVERRIDES[iso2] ?? null;
    const capEn = m?.capital?.[0];
    if (!capital && capEn) {
      const inCountry = places.filter((pl) => pl.ISO_A2 === iso2 || pl.ADM0CAP === 1);
      const place =
        inCountry.find((pl) => pl.ADM0CAP === 1 && placeMatches(pl, capEn)) ??
        inCountry.find((pl) => placeMatches(pl, capEn)) ??
        places.find((pl) => pl.ISO_A2 === iso2 && pl.ADM0CAP === 1);
      capital = { uk: place?.NAME_UK ?? capEn, en: capEn };
      if (!place?.NAME_UK) problems.push(`${iso2}: столиця «${capEn}» без української назви`);
    }
    if (!capital && unMembers.has(iso2)) problems.push(`${iso2}: немає столиці`);

    countries.push({
      iso2,
      iso3: p.ISO_A3_EH,
      name: {
        uk: NAME_OVERRIDES[iso2]?.uk ?? p.NAME_UK ?? p.NAME_EN,
        en: NAME_OVERRIDES[iso2]?.en ?? p.NAME_EN,
      },
      capital,
      continent: continent ?? 'europe',
      currency:
        CURRENCY_OVERRIDES[iso2] ?? (m?.currencies ? (Object.keys(m.currencies)[0] ?? null) : null),
      flag: flagEmoji(iso2),
      unMember: unMembers.has(iso2),
      lat: round(p.LABEL_Y, 3),
      lng: round(p.LABEL_X, 3),
    });
    if (!p.NAME_UK && !NAME_OVERRIDES[iso2]?.uk) problems.push(`${iso2}: немає назви uk`);
  }
  const missingUn = [...unMembers].filter((iso2) => !main.has(iso2));
  if (missingUn.length) problems.push(`члени ООН без полігону: ${missingUn.join(', ')}`);

  writeFileSync(join(OUT, 'countries.json'), JSON.stringify(countries, null, 1) + '\n');

  // 5. Силуети для картки країни: сильніше спрощення, локальна проєкція.
  const outlinesOut = await mapshaper.applyCommands(
    `-i in.json -dissolve iso2 -simplify ${OUTLINE_SIMPLIFY} weighted keep-shapes ` +
      `-o out.json format=geojson precision=0.001`,
    { 'in.json': rawBorders },
  );
  const outlineFeatures = (
    JSON.parse(String(outlinesOut['out.json'])) as FeatureCollection<BorderProps>
  ).features;
  const centers = new Map(countries.map((c) => [c.iso2, [c.lng, c.lat] as [number, number]]));
  const outlines: Record<string, Outline> = {};
  for (const f of outlineFeatures.sort((a, b) =>
    a.properties.iso2.localeCompare(b.properties.iso2),
  )) {
    const center = centers.get(f.properties.iso2);
    if (!center) continue;
    let outline = buildOutline(f.geometry, center);
    // Карликові держави (Ватикан, Монако) після спрощення стають прямокутниками —
    // для них беремо повну геометрію, вона й так маленька.
    if (outline.d.split('L').length < MIN_OUTLINE_POINTS) {
      const raw = rawBorders.features.filter((r) => r.properties.iso2 === f.properties.iso2);
      const full = buildOutline(
        {
          type: 'MultiPolygon',
          coordinates: raw.flatMap((r) =>
            r.geometry.type === 'Polygon' ? [r.geometry.coordinates] : r.geometry.coordinates,
          ),
        },
        center,
      );
      // Архіпелаги (Мальдіви) у повній геометрії — тисячі точок; лишаємо спрощений.
      if (full.d.split('L').length <= MAX_FULL_OUTLINE_POINTS) outline = full;
    }
    outlines[f.properties.iso2] = outline;
  }
  writeFileSync(join(OUT, 'outlines.json'), JSON.stringify(outlines) + '\n');
  console.log(
    `outlines.json: ${Object.keys(outlines).length} силуетів, ` +
      `${(statSync(join(OUT, 'outlines.json')).size / 1024).toFixed(0)} КБ`,
  );
  writeFileSync(join(OUT, 'cities.json'), JSON.stringify(cities) + '\n');
  console.log(
    `countries.json: ${countries.length} країн/територій, з них членів ООН: ${countries.filter((c) => c.unMember).length}`,
  );

  if (problems.length) {
    console.log(`\nПотребує уваги (${problems.length}):\n  ${problems.join('\n  ')}`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
