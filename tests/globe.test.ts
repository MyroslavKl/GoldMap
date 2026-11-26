/**
 * Глобус у WebView: офлайн-HTML і протокол повідомлень. Запуск: npm run test:globe
 * Потребує згенерованого HTML (npm run build:globe — запускається і після npm install).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { isFromWebMessage } from '../src/components/globe/protocol.ts';
import {
  DETAIL_ATTRIBUTION,
  DETAIL_MIN_ZOOM,
  DETAIL_SOURCE_ID,
  DETAIL_SOURCE_LAYERS,
  DETAIL_TILEJSON_URL,
  detailBaseLayers,
  detailLabelLayers,
  PLACE_CLASSES,
} from '../src/components/globe/web/detail-layers.ts';
import {
  GLOBE_MIN_SCALE,
  LABEL_PRIORITY,
  overlaps,
  PLANET_IDS,
  PLANETS,
  spaceLayout,
  spaceProgress,
} from '../src/components/globe/web/solar.ts';
import {
  createFillAnimator,
  FILL_MS,
  UNFILL_MS,
} from '../src/components/globe/web/fill-animator.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const generated = readFileSync(
  join(ROOT, 'src/components/globe/web/globe-html.generated.ts'),
  'utf8',
);
const html = JSON.parse(
  generated.slice(generated.indexOf('= ') + 2, generated.lastIndexOf(';')),
) as string;

describe('офлайн-HTML глобуса', () => {
  test('не підвантажує зовнішніх скриптів, стилів і шрифтів', () => {
    assert.doesNotMatch(html, /<script[^>]+\bsrc\s*=/i, '<script src>');
    assert.doesNotMatch(html, /<link\b/i, '<link>');
    assert.doesNotMatch(html, /@import/i, '@import у CSS');
    assert.doesNotMatch(html, /url\(\s*['"]?https?:/i, 'url(http…) у CSS');
  });

  test('стиль карти не посилається на тайли, гліфи чи спрайти з мережі', () => {
    assert.doesNotMatch(html, /tiles\s*:\s*\[\s*["'`]https?:/i);
    assert.doesNotMatch(html, /glyphs\s*:\s*["'`]https?:/i);
    assert.doesNotMatch(html, /sprite\s*:\s*["'`]https?:/i);
  });

  test('кордони вшиті повністю й збігаються з src/data/borders.geojson', () => {
    const borders = readFileSync(join(ROOT, 'src/data/borders.geojson'), 'utf8').trim();
    assert.ok(
      html.includes(borders.replace(/<\/(script)/gi, '<\\/$1')),
      'borders.geojson не вшито',
    );
  });

  test('шрифт підписів вшито (font-faces з data: URL), сервер гліфів не потрібен', () => {
    assert.match(html, /fontUrl:"data:font\/ttf;base64,[A-Za-z0-9+/]{1000}/);
    assert.match(html, /font-faces/);
    assert.doesNotMatch(html, /\bglyphs\s*:\s*["'`]/, 'style.glyphs не задано');
  });

  test('підписи: точка для кожної країни з назвами uk/en і наближенням', () => {
    const countries = JSON.parse(readFileSync(join(ROOT, 'src/data/countries.json'), 'utf8')) as {
      iso2: string;
    }[];
    const m = /labels:(\{"type":"FeatureCollection".*?\}),fontUrl:/.exec(html);
    assert.ok(m, 'labels не вшито');
    const labels = JSON.parse(m[1]) as {
      features: { properties: { iso2: string; uk: string; en: string; z: number } }[];
    };
    assert.equal(labels.features.length, countries.length);
    for (const { properties: p } of labels.features) {
      assert.ok(p.uk && p.en && p.z > 0, p.iso2);
    }
    const ua = labels.features.find((f) => f.properties.iso2 === 'UA');
    assert.equal(ua?.properties.uk, 'Україна');
  });

  test('воркер MapLibre вшито (Blob URL, не мережа)', () => {
    assert.match(html, /createObjectURL/);
    assert.doesNotMatch(html, /maplibre-gl-worker\.mjs\?v=/);
  });

  test('розмір у межах 5 МБ', () => {
    assert.ok(html.length < 5 * 1024 * 1024, `${(html.length / 1024 / 1024).toFixed(2)} МБ`);
  });
});

describe('протокол WebView → RN', () => {
  test('приймає коректні повідомлення', () => {
    assert.ok(isFromWebMessage({ type: 'ready' }));
    assert.ok(isFromWebMessage({ type: 'interaction' }));
    assert.ok(isFromWebMessage({ type: 'countryPress', iso2: 'UA' }));
    assert.ok(isFromWebMessage({ type: 'error', message: 'x' }));
    assert.ok(isFromWebMessage({ type: 'pointPress', id: 'p1' }));
    assert.ok(isFromWebMessage({ type: 'needThumb', key: 'file:///a_t.jpg' }));
    assert.ok(isFromWebMessage({ type: 'longPress', lat: 44.95, lng: 34.1, iso2: 'UA' }));
    assert.ok(isFromWebMessage({ type: 'longPress', lat: 0, lng: -30, iso2: null }));
    assert.ok(isFromWebMessage({ type: 'camera', lat: 1, lng: 2, zoom: 3 }));
  });

  test('відкидає сміття', () => {
    for (const value of [
      null,
      1,
      'ready',
      {},
      { type: 'countryPress' },
      { type: 'nope' },
      { type: 'longPress', lat: '1', lng: 2, iso2: null },
      { type: 'longPress', lat: 1, lng: 2 },
      { type: 'camera', lat: 1, lng: 2, zoom: Number.NaN },
      { type: 'pointPress', id: 5 },
    ]) {
      assert.equal(isFromWebMessage(value), false, JSON.stringify(value));
    }
  });
});

describe('заливка золотом на глобусі', () => {
  /** Підставний годинник і кадри: frame(ms) просуває час і виконує кадр. */
  function setup() {
    let now = 0;
    let pending: ((t: number) => void) | null = null;
    const fill = new Map<string, number>();
    const history: number[] = [];
    const animator = createFillAnimator({
      setFill: (iso, v) => {
        fill.set(iso, v);
        if (iso === 'FR') history.push(v);
      },
      now: () => now,
      requestFrame: (cb) => {
        pending = cb;
      },
    });
    const frame = (ms: number) => {
      now += ms;
      const cb = pending;
      pending = null;
      cb?.(now);
    };
    return { animator, fill, history, frame };
  }

  test('перший стан (відкриття глобуса) — одразу, без анімації', () => {
    const { animator, fill } = setup();
    animator.setVisited(new Set(['UA', 'PL']));
    assert.equal(fill.get('UA'), 1);
    assert.equal(fill.get('PL'), 1);
    assert.equal(animator.isAnimating(), false);
  });

  test('нова позначка наливається плавно рівно за ~600 мс', () => {
    const { animator, fill, history, frame } = setup();
    animator.setVisited(new Set(['UA']));
    animator.setVisited(new Set(['UA', 'FR']));
    assert.equal(fill.get('FR'), undefined, 'до першого кадру нічого не змінюється');

    for (let t = 0; t < FILL_MS - 16; t += 16) frame(16);
    assert.ok(animator.isAnimating(), 'анімація ще триває перед 600 мс');
    const mid = history[Math.floor(history.length / 2)];
    assert.ok(mid > 0.3 && mid < 1, `проміжне значення ${mid}`);
    assert.ok(
      history.every((v, i) => i === 0 || v >= history[i - 1]),
      'заливка монотонно зростає',
    );

    frame(32);
    assert.equal(fill.get('FR'), 1);
    assert.equal(animator.isAnimating(), false);
    assert.equal(fill.get('UA'), 1, 'інші країни не чіпаються');
  });

  test('зняття позначки згасає швидше (300 мс)', () => {
    const { animator, fill, frame } = setup();
    animator.setVisited(new Set(['FR']));
    animator.setVisited(new Set());
    frame(UNFILL_MS / 2);
    const v = fill.get('FR')!;
    assert.ok(v > 0 && v < 1, `на півдорозі: ${v}`);
    frame(UNFILL_MS);
    assert.equal(fill.get('FR'), 0);
  });

  test('повторна позначка під час згасання продовжує з поточного рівня', () => {
    const { animator, fill, history, frame } = setup();
    animator.setVisited(new Set(['FR']));
    animator.setVisited(new Set());
    frame(100);
    const dimmed = fill.get('FR')!;
    animator.setVisited(new Set(['FR']));
    frame(16);
    assert.ok(Math.abs(fill.get('FR')! - dimmed) < 0.2, 'без стрибка до 0');
    frame(FILL_MS);
    assert.equal(fill.get('FR'), 1);
    assert.ok(history.length > 3);
  });
});

describe('детальна карта (OpenFreeMap)', () => {
  const layers = [...detailBaseLayers(), ...detailLabelLayers('uk', 'Goldmap Inter')];
  const json = JSON.stringify(layers);

  test('одне джерело — TileJSON OpenFreeMap, без ключа', () => {
    assert.equal(DETAIL_TILEJSON_URL, 'https://tiles.openfreemap.org/planet');
    assert.doesNotMatch(DETAIL_TILEJSON_URL, /key|token/i);
    for (const layer of layers)
      assert.equal((layer as { source?: string }).source, DETAIL_SOURCE_ID);
  });

  test('кордони й адмінмежі з тайлів не використовуються — лише наші (Крим — Україна)', () => {
    assert.ok(!(DETAIL_SOURCE_LAYERS as readonly string[]).includes('boundary'));
    for (const layer of layers) {
      const sourceLayer = (layer as { 'source-layer'?: string })['source-layer'];
      assert.ok(
        (DETAIL_SOURCE_LAYERS as readonly string[]).includes(sourceLayer ?? ''),
        `${layer.id}: ${sourceLayer}`,
      );
    }
    assert.doesNotMatch(json, /boundary|admin_level/);
  });

  test('підписи — лише населені пункти, без назв країн і регіонів з тайлів', () => {
    assert.deepEqual([...PLACE_CLASSES].sort(), ['city', 'suburb', 'town', 'village']);
    assert.doesNotMatch(json, /"country"|"state"|"continent"/);
  });

  test('усі шари — лише з zoom ≥ 6 (нижче тайли не запитуються)', () => {
    for (const layer of layers) {
      assert.ok((layer.minzoom ?? 0) >= DETAIL_MIN_ZOOM, layer.id);
    }
    assert.equal(DETAIL_MIN_ZOOM, 6);
  });

  test('підписи — вшитим шрифтом (без сервера гліфів), атрибуція є на карті', () => {
    const labels = detailLabelLayers('en', 'Goldmap Inter');
    assert.deepEqual(
      labels.map((l) => (l.layout as { 'text-font'?: string[] })['text-font']),
      [['Goldmap Inter']],
    );
    assert.match(DETAIL_ATTRIBUTION, /OpenFreeMap/);
    assert.match(DETAIL_ATTRIBUTION, /OpenStreetMap/);
    assert.ok(html.includes('id="attribution"'), 'елемент атрибуції в HTML');
    assert.ok(html.includes('OpenFreeMap'), 'текст атрибуції в HTML');
  });
});

describe('Сонячна система при віддаленні', () => {
  const HALF = 195; // половина ширини екрана телефону, px

  test('з’являється лише при сильному віддаленні, плавно', () => {
    const fit = 1.2;
    assert.equal(spaceProgress(fit, fit), 0, 'звичайний глобус — без системи');
    assert.equal(spaceProgress(fit - 0.9, fit), 0);
    const mid = spaceProgress(fit - 1.8, fit);
    assert.ok(mid > 0 && mid < 1, String(mid));
    assert.equal(spaceProgress(-2, fit), 1);
  });

  test('progress 0: глобус на місці, Сонце за межами екрана', () => {
    const l = spaceLayout(0, 12.3, HALF);
    assert.ok(Math.abs(l.worldX) < 1e-9 && Math.abs(l.worldY) < 1e-9, 'світ не зсунуто');
    assert.equal(l.globeScale, 1);
    assert.ok(Math.hypot(l.sunX, l.sunY) > HALF, 'Сонце не видно');
  });

  test('progress 1: Сонце в центрі, вся система на екрані, глобус — на орбіті Землі', () => {
    for (const t of [0, 7, 33, 120]) {
      const l = spaceLayout(1, t, HALF);
      assert.ok(Math.hypot(l.sunX, l.sunY) < 1e-6, 'Сонце в центрі');
      assert.ok(Math.max(...l.orbits) <= HALF, 'найдальша орбіта вміщається');
      const earthOrbit = l.orbits[PLANET_IDS.indexOf('earth')];
      const tilt = Math.abs(l.worldY / Math.max(Math.abs(l.worldX), 1e-9));
      assert.ok(Math.abs(l.worldX) <= earthOrbit + 1e-6, `t=${t}`);
      assert.ok(Number.isFinite(tilt));
      assert.equal(l.globeScale, GLOBE_MIN_SCALE);
    }
  });

  test('орбіти — від Меркурія до Нептуна за зростанням; 8 планет + Сонце (Земля — глобус)', () => {
    const l = spaceLayout(1, 0, HALF);
    assert.deepEqual(
      l.orbits,
      [...l.orbits].sort((a, b) => a - b),
    );
    assert.deepEqual(
      PLANETS.map((p) => p.id),
      [...PLANET_IDS],
    );
    assert.equal(l.bodies.length, 8);
    assert.ok(!l.bodies.some((b) => b.id === 'earth'));
    const size = (id: string) => l.bodies.find((b) => b.id === id)!.r;
    assert.ok(size('jupiter') > size('saturn') && size('saturn') > size('mars'));
    assert.ok(size('mars') > size('mercury'));
  });

  test('планети рухаються, внутрішні — швидше за зовнішні', () => {
    const angle = (id: string, t: number) => {
      const l = spaceLayout(1, t, HALF);
      const b = l.bodies.find((x) => x.id === id)!;
      return Math.atan2(b.y / 0.7, b.x);
    };
    const moved = (id: string) => Math.abs(angle(id, 1) - angle(id, 0));
    assert.ok(moved('mercury') > moved('mars'));
    assert.ok(moved('mars') > moved('neptune'));
  });

  test('підписи: усі тіла в порядку пріоритету, перетин рамок', () => {
    assert.deepEqual([...LABEL_PRIORITY].sort(), ['sun', ...PLANET_IDS].sort());
    assert.ok(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }));
    assert.ok(!overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }));
  });

  test('назви Сонця й планет є в обох мовах', () => {
    for (const lang of ['uk', 'en']) {
      const j = JSON.parse(readFileSync(join(ROOT, `src/i18n/${lang}.json`), 'utf8')) as {
        space: Record<string, string>;
      };
      for (const id of LABEL_PRIORITY) assert.ok(j.space[id], `${lang}: ${id}`);
    }
  });
});
