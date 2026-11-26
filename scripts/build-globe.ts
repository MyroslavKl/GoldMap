/**
 * Збирає офлайн-HTML глобуса для WebView:
 *   MapLibre GL JS + CSS + воркер + src/components/globe/web/main.ts
 *   + src/data/borders.geojson + точки міст
 * Мережа — лише детальна карта OpenFreeMap (web/detail-layers.ts), коли RN її дозволив.
 * → src/components/globe/web/globe-html.generated.ts (у .gitignore).
 *
 * Запуск: npm run build:globe (також автоматично після npm install).
 * Перезапускати після зміни web/main.ts, теми або даних у src/data.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

import type { City, Country } from '../src/data/types.ts';
import { colors } from '../src/theme/colors.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GLOBE = join(ROOT, 'src', 'components', 'globe');
const OUT = join(GLOBE, 'web', 'globe-html.generated.ts');
const require = createRequire(import.meta.url);

/** Населення, з якого місто вважається «великим» і видно вже з zoom 4. */
const MAJOR_CITY_POP = 1_000_000;

/** Безпечно вставити JS/JSON у <script>: не дати рядку закрити тег. */
const scriptSafe = (s: string) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

async function main() {
  const maplibreDir = dirname(require.resolve('maplibre-gl/package.json'));
  const workerSrc = readFileSync(join(maplibreDir, 'dist', 'maplibre-gl-worker.mjs'), 'utf8');
  const css = readFileSync(join(maplibreDir, 'dist', 'maplibre-gl.css'), 'utf8');
  const maplibreVersion = (require('maplibre-gl/package.json') as { version: string }).version;

  const bundle = await build({
    entryPoints: [join(GLOBE, 'web', 'main.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['safari15', 'chrome100'],
    minify: true,
    legalComments: 'inline',
    write: false,
    define: { __WORKER_SRC__: JSON.stringify(workerSrc) },
    // import.meta.url у MapLibre потрібен лише для пошуку воркера — ми задаємо його самі.
    logOverride: { 'empty-import-meta': 'silent' },
    logLevel: 'warning',
  });
  const js = bundle.outputFiles[0].text;

  const borders = readFileSync(join(ROOT, 'src', 'data', 'borders.geojson'), 'utf8').trim();
  const cities = JSON.parse(
    readFileSync(join(ROOT, 'src', 'data', 'cities.json'), 'utf8'),
  ) as City[];
  const citiesGeo = {
    type: 'FeatureCollection',
    features: cities.map((c) => ({
      type: 'Feature',
      properties: { capital: c.capital, major: c.capital || c.pop >= MAJOR_CITY_POP },
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    })),
  };

  // Назви країн: точка підпису + назви uk/en + наближення, з якого видно.
  const countries = JSON.parse(
    readFileSync(join(ROOT, 'src', 'data', 'countries.json'), 'utf8'),
  ) as Country[];
  const labelsGeo = {
    type: 'FeatureCollection',
    features: countries.map((c) => ({
      type: 'Feature',
      properties: { iso2: c.iso2, uk: c.name.uk, en: c.name.en, z: c.labelZoom },
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    })),
  };

  // Шрифт підписів вшиваємо як data: URL — MapLibre малює текст локально (style `font-faces`),
  // сервер гліфів не потрібен. Inter, кирилиця + латиниця.
  const fontPath = join(
    dirname(require.resolve('@expo-google-fonts/inter/package.json')),
    '500Medium',
    'Inter_500Medium.ttf',
  );
  const fontUrl = `data:font/ttf;base64,${readFileSync(fontPath).toString('base64')}`;

  const html = `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>${css}
html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${colors.bg};}
#map{background:${colors.transparent};}
html,body,#map{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:${colors.transparent}}
#world{position:absolute;inset:0;transform-origin:50% 50%;will-change:transform}
#space{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0}
#halo{position:absolute;border-radius:50%;pointer-events:none;opacity:0;transition:opacity .3s}
#attribution{position:absolute;right:6px;bottom:4px;padding:1px 6px;border-radius:6px;font:10px/1.4 -apple-system,system-ui,sans-serif;color:${colors.textMuted};background:${colors.scrim};pointer-events:none;opacity:0;transition:opacity .3s}
</style>
</head><body>
<canvas id="space"></canvas><div id="world"><div id="map"></div><div id="halo"></div></div><div id="attribution"></div>
<script>window.__GM_DATA__={borders:${scriptSafe(borders)},cities:${scriptSafe(JSON.stringify(citiesGeo))},labels:${scriptSafe(JSON.stringify(labelsGeo))},fontUrl:${JSON.stringify(fontUrl)}};</script>
<script>${scriptSafe(js)}</script>
</body></html>`;

  writeFileSync(
    OUT,
    `// ЗГЕНЕРОВАНО scripts/build-globe.ts — не редагувати. MapLibre GL JS ${maplibreVersion} (BSD-3-Clause).\n` +
      `export const GLOBE_HTML: string = ${JSON.stringify(html)};\n`,
  );
  console.log(
    `globe-html.generated.ts: ${(html.length / 1024 / 1024).toFixed(2)} МБ ` +
      `(maplibre ${maplibreVersion}, ${cities.length} міст)`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
