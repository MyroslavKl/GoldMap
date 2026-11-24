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
