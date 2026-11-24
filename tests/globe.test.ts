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
  });

  test('відкидає сміття', () => {
    for (const value of [null, 1, 'ready', {}, { type: 'countryPress' }, { type: 'nope' }]) {
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
