/**
 * Тести зібраних даних у src/data. Запуск: npm run test:data
 * Головне — кордони України: Крим і всі тимчасово окуповані території є Україною.
 */
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { BorderProps, City, Country, LandmarksFile } from '../src/data/types.ts';
import {
  distanceToGeometry,
  pointInGeometry,
  type FeatureCollection,
  type Position,
} from './lib/geo.ts';
import { parseOutlinePath, projectPoint, type Outline } from './lib/outline.ts';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const read = <T>(file: string): T => JSON.parse(readFileSync(join(DATA, file), 'utf8')) as T;

const borders = read<FeatureCollection<BorderProps>>('borders.geojson');
const countries = read<Country[]>('countries.json');
const cities = read<City[]>('cities.json');
const outlines = read<Record<string, Outline>>('outlines.json');
const landmarks = read<LandmarksFile>('landmarks.json');

const ua = borders.features.find((f) => f.properties.iso2 === 'UA');
const ru = borders.features.find((f) => f.properties.iso2 === 'RU');

/** Міста на тимчасово окупованих територіях: [назва, lat, lng]. */
const OCCUPIED: [string, number, number][] = [
  ['Simferopol', 44.95, 34.1],
  ['Sevastopol', 44.6, 33.52],
  ['Kerch', 45.35, 36.47],
  ['Yalta', 44.5, 34.17],
  ['Yevpatoriya', 45.2, 33.37],
  ['Donetsk', 48.0, 37.8],
  ['Luhansk', 48.57, 39.33],
  ['Mariupol', 47.1, 37.55],
  ['Melitopol', 46.85, 35.37],
  ['Nova Kakhovka', 46.75, 33.37],
];

describe('кордони: точка зору України', () => {
  test('полігони UA і RU існують', () => {
    assert.ok(ua, 'немає UA');
    assert.ok(ru, 'немає RU');
  });

  test('Сімферополь (44.95, 34.10) належить полігону UA', () => {
    assert.ok(pointInGeometry([34.1, 44.95], ua!.geometry));
    assert.ok(!pointInGeometry([34.1, 44.95], ru!.geometry));
  });

  for (const [name, lat, lng] of OCCUPIED) {
    test(`${name} — в UA, не в RU`, () => {
      const p: Position = [lng, lat];
      assert.ok(pointInGeometry(p, ua!.geometry), `${name} поза UA`);
      assert.ok(!pointInGeometry(p, ru!.geometry), `${name} у RU`);
    });
  }

  test('міста окупованих територій у cities.json мають країну UA', () => {
    const names = OCCUPIED.map(([n]) => n);
    const found = cities.filter((c) => names.includes(c.name.en));
    assert.ok(found.length >= 6, `знайдено лише ${found.length} міст зі списку`);
    for (const c of found) assert.equal(c.iso2, 'UA', `${c.name.en}: ${c.iso2}`);
  });

  test('жодне місто в межах полігону UA не віднесене до іншої країни', () => {
    const wrong = cities.filter(
      (c) => c.iso2 !== 'UA' && pointInGeometry([c.lng, c.lat], ua!.geometry),
    );
    assert.deepEqual(
      wrong.map((c) => `${c.name.en} (${c.iso2})`),
      [],
    );
  });
});

describe('borders.geojson', () => {
  test('розмір ≤ 3 МБ', () => {
    const size = statSync(join(DATA, 'borders.geojson')).size;
    assert.ok(size <= 3 * 1024 * 1024, `${(size / 1024 / 1024).toFixed(2)} МБ`);
  });

  test('один полігон на країну, кожен iso2 є в countries.json', () => {
    const isos = borders.features.map((f) => f.properties.iso2);
    assert.equal(new Set(isos).size, isos.length, 'дублікати iso2');
    const known = new Set(countries.map((c) => c.iso2));
    assert.deepEqual(
      isos.filter((i) => !known.has(i)),
      [],
    );
  });
});

describe('countries.json', () => {
  test('рівно 193 члени ООН, Ватикан і Палестина — не члени', () => {
    assert.equal(countries.filter((c) => c.unMember).length, 193);
    for (const iso2 of ['VA', 'PS', 'TW']) {
      assert.equal(countries.find((c) => c.iso2 === iso2)?.unMember, false, iso2);
    }
  });

  test('у кожної країни є назви uk/en, прапор і континент', () => {
    for (const c of countries) {
      assert.ok(c.name.uk && c.name.en, c.iso2);
      assert.match(c.iso2, /^[A-Z]{2}$/);
      assert.ok(c.flag.length > 0, c.iso2);
      assert.ok(c.continent, c.iso2);
    }
  });

  test('у кожного члена ООН є столиця uk/en і валюта', () => {
    for (const c of countries.filter((x) => x.unMember)) {
      assert.ok(c.capital?.uk && c.capital.en, `${c.iso2}: столиця`);
      assert.match(c.capital!.uk, /[А-ЯІЇЄҐа-яіїєґ]/, `${c.iso2}: столиця uk не кирилицею`);
      assert.ok(c.currency, `${c.iso2}: валюта`);
    }
  });

  test('Україна: назва, столиця, валюта', () => {
    const c = countries.find((x) => x.iso2 === 'UA');
    assert.equal(c?.name.uk, 'Україна');
    assert.equal(c?.capital?.uk, 'Київ');
    assert.equal(c?.currency, 'UAH');
  });
});

describe('cities.json', () => {
  test('кожне місто має відому країну та коректні координати', () => {
    const known = new Set(countries.map((c) => c.iso2));
    for (const c of cities) {
      assert.ok(known.has(c.iso2), `${c.name.en}: ${c.iso2}`);
      assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180, c.name.en);
    }
  });

  test('Київ — столиця України', () => {
    const kyiv = cities.find((c) => c.name.en === 'Kyiv');
    assert.equal(kyiv?.iso2, 'UA');
    assert.equal(kyiv?.capital, true);
  });
});

describe('outlines.json (силуети для картки)', () => {
  /** Точка [lng, lat] у силуеті країни: та сама проєкція, що й при генерації. */
  function inOutline(iso2: string, [lng, lat]: [number, number]): boolean {
    const outline = outlines[iso2];
    const point = projectPoint([lng, lat], outline.p);
    const rings = parseOutlinePath(outline.d);
    // even-odd: дірки (анклави) враховуються автоматично
    return (
      rings.filter((r) => pointInGeometry(point, { type: 'Polygon', coordinates: [r] })).length %
        2 ===
      1
    );
  }

  /** Відстань від точки до контуру силуету, в одиницях viewBox (найбільша сторона = 100). */
  function outlineDistance(iso2: string, [lng, lat]: [number, number]): number {
    const outline = outlines[iso2];
    const point = projectPoint([lng, lat], outline.p);
    return Math.min(
      ...parseOutlinePath(outline.d).map((r) =>
        distanceToGeometry(point, { type: 'Polygon', coordinates: [r] }),
      ),
    );
  }

  /** Міста на самому березі: спрощений силует може зсунути берегову лінію на ~1 %. */
  const COASTAL = new Set(['Kerch', 'Sevastopol', 'Yalta', 'Yevpatoriya', 'Mariupol']);

  test('силует є для кожної країни, шлях непорожній, viewBox коректний', () => {
    for (const c of countries) {
      const o = outlines[c.iso2];
      assert.ok(o, `${c.iso2}: немає силуету`);
      assert.match(o.d, /^M[\d.]+,[\d.]+L/, `${c.iso2}: порожній шлях`);
      assert.ok(o.w > 0 && o.h > 0 && Math.max(o.w, o.h) <= 100.1, `${c.iso2}: ${o.w}x${o.h}`);
    }
  });

  test('силует України включає Крим: Сімферополь (44.95, 34.10) всередині шляху UA', () => {
    assert.ok(inOutline('UA', [34.1, 44.95]));
  });

  test('окуповані міста: у силуеті UA (прибережні — до 2 % від краю), і жодне — не в RU', () => {
    for (const [name, lat, lng] of OCCUPIED) {
      const coastal = COASTAL.has(name);
      assert.ok(
        inOutline('UA', [lng, lat]) || (coastal && outlineDistance('UA', [lng, lat]) <= 2),
        `${name} поза силуетом UA`,
      );
      assert.ok(!inOutline('RU', [lng, lat]), `${name} у силуеті RU`);
    }
  });

  test('внутрішні окуповані міста — строго всередині силуету UA', () => {
    for (const [name, lat, lng] of OCCUPIED.filter(([n]) => !COASTAL.has(n))) {
      assert.ok(inOutline('UA', [lng, lat]), `${name} поза силуетом UA`);
    }
  });

  test('перевірка не тривіальна: Київ у силуеті UA, Москва — ні', () => {
    assert.ok(inOutline('UA', [30.52, 50.45]));
    assert.ok(!inOutline('UA', [37.62, 55.75]));
    assert.ok(inOutline('RU', [37.62, 55.75]));
  });
});

describe('landmarks.json — «варто побачити» (Wikidata)', () => {
  const all = Object.entries(landmarks.countries).flatMap(([iso2, list]) =>
    list.map((l) => ({ iso2, ...l })),
  );
  /** Кримський півострів (прямокутник з запасом; сам Крим цілком у полігоні UA) */
  const inCrimea = (l: { lat: number; lng: number }) =>
    l.lat > 44.3 &&
    l.lat < 46.2 &&
    l.lng > 32.4 &&
    l.lng < 36.7 &&
    pointInGeometry([l.lng, l.lat], ua!.geometry);

  test('місця в Криму належать UA (країна — за нашими кордонами, не за Wikidata)', () => {
    const crimean = all.filter(inCrimea);
    assert.ok(crimean.length >= 3, `у Криму лише ${crimean.length} місць`);
    for (const l of crimean) assert.equal(l.iso2, 'UA', `${l.name.uk} → ${l.iso2}`);
    assert.ok(!(landmarks.countries.RU ?? []).some(inCrimea), 'кримське місце в RU');
  });

  test('конкретні кримські пам’ятки — в Україні', () => {
    const uaNames = (landmarks.countries.UA ?? []).map((l) => l.name.en);
    for (const name of ['Chersonesus', "Swallow's Nest"]) {
      assert.ok(
        uaNames.some((n) => n.includes(name)),
        `${name} немає серед UA: ${uaNames.join(', ')}`,
      );
    }
  });

  test('кожне місце — у своїй країні за полігоном (або біля берега / мікродержави)', () => {
    const byIso = new Map(borders.features.map((f) => [f.properties.iso2, f]));
    for (const l of all) {
      const f = byIso.get(l.iso2);
      assert.ok(f, l.iso2);
      const inside = pointInGeometry([l.lng, l.lat], f.geometry);
      assert.ok(
        inside || distanceToGeometry([l.lng, l.lat], f.geometry) < 0.15,
        `${l.name.en} (${l.iso2})`,
      );
    }
  });

  test('до 15 місць на країну, від найвідоміших; країни відомі; назви й координати валідні', () => {
    const known = new Set(countries.map((c) => c.iso2));
    for (const [iso2, list] of Object.entries(landmarks.countries)) {
      assert.ok(known.has(iso2), iso2);
      assert.ok(list.length > 0 && list.length <= 15, `${iso2}: ${list.length}`);
      assert.deepEqual(
        list.map((l) => l.rank),
        [...list.map((l) => l.rank)].sort((a, b) => b - a),
        `${iso2}: не за спаданням відомості`,
      );
      for (const l of list) {
        assert.match(l.id, /^Q[0-9]+$/);
        assert.ok(l.name.uk.trim() && l.name.en.trim(), l.id);
        assert.ok(Math.abs(l.lat) <= 90 && Math.abs(l.lng) <= 180, l.id);
      }
    }
    assert.equal(new Set(all.map((l) => l.id)).size, all.length, 'дублікати QID');
    assert.ok(Object.keys(landmarks.countries).length > 150);
  });

  test('сама країна не є «місцем» (Ватикан — не пам’ятка Італії)', () => {
    const names = new Set(countries.map((c) => c.name.en));
    assert.ok(!all.some((l) => names.has(l.name.en)));
  });
});
