/**
 * Код глобуса всередині WebView (MapLibre GL JS, проєкція globe).
 * Збирається scripts/build-globe.ts в один офлайн-HTML разом із даними.
 * Нічого не тягне з мережі: стиль, кордони, міста і воркер MapLibre — вшиті.
 */
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONFeature,
  type MapLayerMouseEvent,
} from 'maplibre-gl';

import type { FeatureCollection } from 'geojson';

import { colors, goldAlpha } from '../../../theme/colors';
import { WEB_RECEIVER, type FromWebMessage, type ToWebMessage } from '../protocol';

/** Вихідний код воркера MapLibre — підставляє esbuild (define). */
declare const __WORKER_SRC__: string;

type GlobeData = {
  borders: FeatureCollection;
  cities: FeatureCollection;
};

declare global {
  interface Window {
    __GM_DATA__: GlobeData;
    ReactNativeWebView?: { postMessage(message: string): void };
    [WEB_RECEIVER]: (message: ToWebMessage) => void;
  }
}

/** Швидкість автообертання, градусів довготи за секунду */
const ROTATE_DEG_PER_SEC = 3;
/** Частка меншої сторони екрана, яку займає діаметр глобуса на старті */
const GLOBE_FIT = 0.86;
const FLY_DURATION_MS = 1600;

function post(message: FromWebMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message) }));
window.addEventListener('unhandledrejection', (e) =>
  post({ type: 'error', message: String((e as PromiseRejectionEvent).reason) }),
);

// Воркер MapLibre — з Blob URL, без мережі.
setWorkerUrl(URL.createObjectURL(new Blob([__WORKER_SRC__], { type: 'text/javascript' })));

const data = window.__GM_DATA__;

const map = new MapLibreMap({
  container: 'map',
  attributionControl: false,
  renderWorldCopies: false,
  maxPitch: 0,
  dragRotate: false,
  touchPitch: false,
  pitchWithRotate: false,
  fadeDuration: 0,
  center: [30, 25],
  zoom: 1.2,
  style: {
    version: 8,
    projection: { type: 'globe' },
    // Вбудована атмосфера MapLibre фізично блакитна — вимикаємо, золоте світіння дає #halo.
    sky: { 'atmosphere-blend': 0 },
    sources: {
      countries: { type: 'geojson', data: data.borders, promoteId: 'iso2' },
      cities: { type: 'geojson', data: data.cities },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': colors.ocean } },
      {
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'visited'], false],
            colors.gold,
            colors.goldDim,
          ],
          'fill-antialias': false,
        },
      },
      {
        id: 'countries-planned',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': colors.planned,
          'fill-opacity': ['case', ['boolean', ['feature-state', 'planned'], false], 0.3, 0],
        },
      },
      {
        id: 'countries-line',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': colors.goldBorder,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2],
        },
      },
      {
        id: 'cities',
        type: 'circle',
        source: 'cities',
        minzoom: 4,
        // Столиці й великі міста — з zoom 4, решта — з zoom 6.
        filter: ['any', ['>=', ['zoom'], 6], ['==', ['get', 'major'], true]],
        paint: {
          // Не золото: інакше столиця зливається з відвіданою (золотою) країною.
          'circle-color': ['case', ['get', 'capital'], colors.text, colors.textMuted],
          'circle-radius': ['case', ['get', 'capital'], 3.5, 2],
          'circle-stroke-color': colors.bg,
          'circle-stroke-width': 1,
          'circle-pitch-alignment': 'map',
        },
      },
    ],
  },
});

// ---------- стан країн ----------

const state = { visited: new Set<string>(), planned: new Set<string>() };

function applyStateSet(key: 'visited' | 'planned', next: Set<string>): void {
  const prev = state[key];
  for (const iso of prev) {
    if (!next.has(iso)) map.setFeatureState({ source: 'countries', id: iso }, { [key]: false });
  }
  for (const iso of next) {
    if (!prev.has(iso)) map.setFeatureState({ source: 'countries', id: iso }, { [key]: true });
  }
  state[key] = next;
  if (key === 'planned') updatePulse();
}

// Пульсація запланованих: змінюємо прозорість шару ~20 разів на секунду, лише коли є що пульсувати.
let pulseTimer: ReturnType<typeof setInterval> | null = null;
function updatePulse(): void {
  if (state.planned.size === 0) {
    if (pulseTimer) clearInterval(pulseTimer);
    pulseTimer = null;
    return;
  }
  if (pulseTimer) return;
  pulseTimer = setInterval(() => {
    const t = (Math.sin((performance.now() / 1400) * Math.PI * 2) + 1) / 2; // 0..1
    map.setPaintProperty('countries-planned', 'fill-opacity', [
      'case',
      ['boolean', ['feature-state', 'planned'], false],
      0.15 + 0.45 * t,
      0,
    ]);
  }, 50);
}

// ---------- автообертання ----------

let rotateEnabled = true;
let stoppedByUser = false;
let lastFrame = 0;

function rotateFrame(now: number): void {
  if (rotateEnabled && !stoppedByUser && !map.isMoving()) {
    const dt = lastFrame ? Math.min(now - lastFrame, 100) / 1000 : 0;
    const c = map.getCenter();
    map.jumpTo({ center: [c.lng - ROTATE_DEG_PER_SEC * dt, c.lat] });
  }
  lastFrame = now;
  requestAnimationFrame(rotateFrame);
}

function stopByUser(): void {
  if (stoppedByUser) return;
  stoppedByUser = true;
  post({ type: 'interaction' });
}

const canvas = map.getCanvasContainer();
canvas.addEventListener('touchstart', stopByUser, { passive: true });
canvas.addEventListener('mousedown', stopByUser);
canvas.addEventListener('wheel', stopByUser, { passive: true });

// ---------- золоте світіння (ореол) ----------

const halo = document.getElementById('halo')!;

/** Чи лежить точка екрана на поверхні глобуса (а не в космосі). */
function onGlobe(x: number, y: number): boolean {
  const back = map.project(map.unproject([x, y]));
  return Math.abs(back.x - x) < 0.75 && Math.abs(back.y - y) < 0.75;
}

/** Радіус глобуса в пікселях: двійковий пошук краю від центру. */
function globeRadius(): number {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const cx = w / 2;
  const cy = h / 2;
  let lo = 0;
  let hi = Math.hypot(w, h);
  if (onGlobe(cx + hi, cy)) return hi;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (onGlobe(cx + mid, cy)) lo = mid;
    else hi = mid;
  }
  return lo;
}

let lastZoom = NaN;
function updateHalo(force = false): void {
  const zoom = map.getZoom();
  if (!force && Math.abs(zoom - lastZoom) < 0.01) return;
  lastZoom = zoom;
  const r = globeRadius();
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  // Коли глобус більший за екран, край не видно — ореол не потрібен.
  if (r * 2 > Math.hypot(w, h)) {
    halo.style.opacity = '0';
    return;
  }
  const glow = Math.max(6, r * 0.09);
  halo.style.opacity = '1';
  halo.style.width = halo.style.height = `${r * 2}px`;
  halo.style.left = `${w / 2 - r}px`;
  halo.style.top = `${h / 2 - r}px`;
  halo.style.boxShadow = `0 0 ${glow}px ${glow * 0.35}px ${goldAlpha(0.35)}, 0 0 ${glow * 3}px ${glow}px ${goldAlpha(0.12)}`;
}

// ---------- вписати глобус у екран ----------

function fitGlobe(): void {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const target = (Math.min(w, h) * GLOBE_FIT) / 2;
  const r = globeRadius();
  if (r > 0) map.jumpTo({ zoom: map.getZoom() + Math.log2(target / r) });
}

// ---------- тап по країні ----------

map.on('click', 'countries-fill', (e: MapLayerMouseEvent) => {
  const feature: GeoJSONFeature | undefined = e.features?.[0];
  const iso2 = feature?.properties?.iso2 as string | undefined;
  if (iso2) post({ type: 'countryPress', iso2 });
});

// ---------- команди з React Native ----------

window[WEB_RECEIVER] = (message: ToWebMessage) => {
  switch (message.type) {
    case 'setCountries':
      applyStateSet('visited', new Set(message.visited));
      applyStateSet('planned', new Set(message.planned));
      break;
    case 'setAutoRotate':
      rotateEnabled = message.enabled;
      if (message.enabled) stoppedByUser = false;
      break;
    case 'flyTo':
      stoppedByUser = true;
      map.flyTo({
        center: [message.lng, message.lat],
        zoom: message.zoom,
        duration: FLY_DURATION_MS,
        essential: true,
      });
      break;
  }
};

map.on('load', () => {
  fitGlobe();
  updateHalo(true);
  map.on('move', () => updateHalo());
  window.addEventListener('resize', () => updateHalo(true));
  requestAnimationFrame(rotateFrame);
  post({ type: 'ready' });
});
