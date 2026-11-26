/**
 * Код глобуса всередині WebView (MapLibre GL JS, проєкція globe).
 * Збирається scripts/build-globe.ts в один офлайн-HTML разом із даними.
 * Вшите: стиль, кордони, міста, шрифт і воркер MapLibre. Єдине, що може йти з мережі, —
 * детальна карта OpenFreeMap при наближенні, і лише коли RN її дозволив (setDetailMap).
 */
import {
  LngLatBounds,
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type PointLike,
} from 'maplibre-gl';

import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

import { colors, goldAlpha } from '../../../theme/colors';
import {
  WEB_INIT,
  WEB_RECEIVER,
  type FromWebMessage,
  type ToWebMessage,
  type WebInit,
  type WebPoint,
} from '../protocol';
import {
  DETAIL_ATTRIBUTION,
  DETAIL_MAX_ZOOM,
  DETAIL_MIN_ZOOM,
  DETAIL_SOURCE_ID,
  DETAIL_TILEJSON_URL,
  detailBaseLayers,
  detailLabelLayers,
  placeName,
} from './detail-layers';
import { createFillAnimator } from './fill-animator';

/** Вихідний код воркера MapLibre — підставляє esbuild (define). */
declare const __WORKER_SRC__: string;

type GlobeData = {
  borders: FeatureCollection;
  cities: FeatureCollection;
  /** Точки підписів країн: iso2, uk, en, z (наближення, з якого видно) */
  labels: FeatureCollection;
  /** Шрифт підписів (data: URL) — текст малюється локально, без сервера гліфів */
  fontUrl: string;
};

const LABEL_FONT = 'Goldmap Inter';
/** Наш глобус ближчий за веб-карту, для якої задано MIN_LABEL, — показуємо назви трохи раніше. */
const LABEL_ZOOM_SHIFT = 1;

declare global {
  interface Window {
    __GM_DATA__: GlobeData;
    [WEB_INIT]?: WebInit;
    ReactNativeWebView?: { postMessage(message: string): void };
    [WEB_RECEIVER]: (message: ToWebMessage) => void;
  }
}

/** Швидкість автообертання, градусів довготи за секунду */
const ROTATE_DEG_PER_SEC = 3;
/** Частка меншої сторони екрана, яку займає діаметр глобуса на старті */
const GLOBE_FIT = 0.86;
const FLY_DURATION_MS = 1600;
/** Найбільше наближення без детальної карти (далі — лише полігони, дивитися нема на що) */
const OFFLINE_MAX_ZOOM = 10;
/** Довге натискання: тривалість і допустимий зсув пальця */
const LONG_PRESS_MS = 550;
const LONG_PRESS_SLOP_PX = 8;
/** Діаметр мініатюри точки на карті, CSS px */
const THUMB_SIZE = 44;
const THUMB_PREFIX = 'thumb:';
const CAMERA_DEBOUNCE_MS = 400;

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
const init: WebInit = window[WEB_INIT] ?? {
  camera: null,
  focusIso: null,
  lang: 'en',
};
/** Мінікарта країни: лише ця країна — без обертання, рух і віддалення в її межах. */
const focusIso = init.focusIso;

const emptyCollection: FeatureCollection = { type: 'FeatureCollection', features: [] };

const map = new MapLibreMap({
  container: 'map',
  attributionControl: false,
  renderWorldCopies: false,
  maxPitch: 0,
  maxZoom: OFFLINE_MAX_ZOOM,
  dragRotate: false,
  touchPitch: false,
  pitchWithRotate: false,
  fadeDuration: 0,
  center: init.camera ? [init.camera.lng, init.camera.lat] : [30, 25],
  zoom: init.camera?.zoom ?? 1.2,
  style: {
    version: 8,
    projection: { type: 'globe' },
    'font-faces': { [LABEL_FONT]: data.fontUrl },
    // Вбудована атмосфера MapLibre фізично блакитна — вимикаємо, золоте світіння дає #halo.
    sky: { 'atmosphere-blend': 0 },
    sources: {
      countries: { type: 'geojson', data: data.borders, promoteId: 'iso2' },
      cities: { type: 'geojson', data: data.cities },
      labels: { type: 'geojson', data: data.labels },
      points: { type: 'geojson', data: emptyCollection, promoteId: 'id' },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': colors.ocean } },
      {
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          // fill: 0 — невідвідана (goldDim), 1 — відвідана (gold); між ними — анімація заливки.
          'fill-color': [
            'interpolate',
            ['linear'],
            ['to-number', ['coalesce', ['feature-state', 'fill'], 0]],
            0,
            colors.goldDim,
            1,
            colors.gold,
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2, 12, 2],
        },
      },
      {
        // Між відвіданими сусідами золотий контур зливається із золотою заливкою —
        // поверх золота кордон малюємо темним пунктиром.
        id: 'countries-line-visited',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': colors.borderOnGold,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 1.4, 12, 2.2],
          'line-dasharray': [2, 2],
          'line-opacity': ['to-number', ['coalesce', ['feature-state', 'fill'], 0]],
        },
      },
      {
        id: 'cities',
        type: 'circle',
        source: 'cities',
        minzoom: 4,
        filter: citiesFilter(false),
        paint: {
          // Не золото: інакше столиця зливається з відвіданою (золотою) країною.
          'circle-color': ['case', ['get', 'capital'], colors.text, colors.textMuted],
          'circle-radius': ['case', ['get', 'capital'], 3.5, 2],
          'circle-stroke-color': colors.bg,
          'circle-stroke-width': 1,
          'circle-pitch-alignment': 'map',
        },
      },
      {
        id: 'country-labels',
        type: 'symbol',
        source: 'labels',
        // Великі країни видно одразу, малі — з наближенням (Natural Earth MIN_LABEL).
        filter: ['>=', ['zoom'], ['-', ['get', 'z'], LABEL_ZOOM_SHIFT]],
        maxzoom: 9,
        layout: {
          'text-field': ['get', init.lang],
          'text-font': [LABEL_FONT],
          'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 4, 12, 7, 15],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.08,
          'text-max-width': 7,
          'text-padding': 4,
        },
        paint: {
          'text-color': colors.text,
          'text-halo-color': colors.bg,
          'text-halo-width': 1.2,
          'text-halo-blur': 0.4,
        },
      },
      {
        id: 'points-dot',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-color': colors.gold,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 6, 5, 12, 7],
          'circle-stroke-color': colors.bg,
          'circle-stroke-width': 1.5,
          'circle-pitch-alignment': 'map',
        },
      },
      {
        // Кругла мініатюра першого фото. Зображення додається, коли MapLibre його попросить
        // (styleimagemissing) — тобто лише для точок у кадрі при zoom ≥ 6.
        id: 'points-thumb',
        type: 'symbol',
        source: 'points',
        minzoom: DETAIL_MIN_ZOOM,
        filter: ['has', 'thumb'],
        layout: {
          'icon-image': ['concat', THUMB_PREFIX, ['get', 'thumb']],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      },
      {
        id: 'points-label',
        type: 'symbol',
        source: 'points',
        minzoom: 8,
        layout: {
          'text-field': ['get', 'title'],
          'text-font': [LABEL_FONT],
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 2.2],
          'text-max-width': 9,
          'text-optional': true,
        },
        paint: {
          'text-color': colors.gold,
          'text-halo-color': colors.bg,
          'text-halo-width': 1.4,
        },
      },
    ],
  },
});

/**
 * Прозорість заливки країн: з детальною картою золото напівпрозоре (видно воду й дороги);
 * у мінікарті інші країни приглушені — видно, де межа «своєї».
 */
function fillOpacity(detail: boolean) {
  const own = (value: number) =>
    focusIso ? ['case', ['==', ['get', 'iso2'], focusIso], value, value * 0.35] : value;
  return (
    detail
      ? [
          'interpolate',
          ['linear'],
          ['zoom'],
          DETAIL_MIN_ZOOM - 0.5,
          own(1),
          DETAIL_MIN_ZOOM + 1,
          own(0.4),
        ]
      : own(1)
  ) as never;
}

/** Наші міста (Natural Earth). З детальною картою на zoom ≥ 6 назви дають тайли — точки ховаємо. */
function citiesFilter(detail: boolean) {
  const base = ['any', ['>=', ['zoom'], 6], ['==', ['get', 'major'], true]];
  return (detail ? ['all', ['<', ['zoom'], DETAIL_MIN_ZOOM], base] : base) as never;
}

// ---------- стан країн ----------

const state = {
  planned: new Set<string>(),
  lang: init.lang,
  detail: false,
};

const fills = createFillAnimator({
  setFill: (iso, value) => map.setFeatureState({ source: 'countries', id: iso }, { fill: value }),
  now: () => performance.now(),
  requestFrame: (cb) => requestAnimationFrame(cb),
});

function applyPlanned(next: Set<string>): void {
  for (const iso of state.planned) {
    if (!next.has(iso)) map.setFeatureState({ source: 'countries', id: iso }, { planned: false });
  }
  for (const iso of next) {
    if (!state.planned.has(iso)) {
      map.setFeatureState({ source: 'countries', id: iso }, { planned: true });
    }
  }
  state.planned = next;
  updatePulse();
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

let rotateEnabled = !focusIso;
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
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  // На наближенні край глобуса не видно — ореол не потрібен (і пошук радіуса не рахуємо).
  const r = zoom > 4 ? Infinity : globeRadius();
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

// ---------- вписати глобус або країну в екран ----------

function fitGlobe(): void {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const target = (Math.min(w, h) * GLOBE_FIT) / 2;
  const r = globeRadius();
  if (r > 0) map.jumpTo({ zoom: map.getZoom() + Math.log2(target / r) });
}

/** Межі країни; для країн через антимеридіан (Фіджі, Росія) — довготи зсуваються за 180°. */
function countryBounds(iso2: string): LngLatBounds | null {
  const feature = data.borders.features.find(
    (f: Feature) => (f.properties as { iso2?: string } | null)?.iso2 === iso2,
  );
  if (!feature) return null;
  const points: Position[] = [];
  const collect = (g: Geometry) => {
    if (g.type === 'Polygon') points.push(...g.coordinates[0]);
    else if (g.type === 'MultiPolygon') for (const p of g.coordinates) points.push(...p[0]);
  };
  collect(feature.geometry);
  if (points.length === 0) return null;
  let lngs = points.map((p) => p[0]);
  if (Math.max(...lngs) - Math.min(...lngs) > 180) lngs = lngs.map((x) => (x < 0 ? x + 360 : x));
  const lats = points.map((p) => p[1]);
  return new LngLatBounds(
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  );
}

/** Межі, в яких тримається камера мінікарти, і найменше наближення (уся країна). */
let lock: { west: number; south: number; east: number; north: number; minZoom: number } | null =
  null;

/**
 * Вписати країну й «замкнути» камеру в ній: віддалити далі, ніж уся країна, не можна, а центр
 * не виходить за межі країни (з невеликим запасом). У проєкції globe MapLibre не застосовує
 * maxBounds/minZoom, тож обмежуємо самі: після жесту камера плавно повертається в межі
 * (clampCamera на moveend). Під час жесту не втручаємося — інакше камера «б'ється» з пальцем.
 */
function fitCountry(iso2: string): boolean {
  const bounds = countryBounds(iso2);
  if (!bounds) return false;
  map.fitBounds(bounds, { padding: 16, animate: false, maxZoom: OFFLINE_MAX_ZOOM });
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const padLng = (ne.lng - sw.lng) * 0.1;
  const padLat = (ne.lat - sw.lat) * 0.1;
  lock = {
    west: sw.lng - padLng,
    east: ne.lng + padLng,
    south: Math.max(-85, sw.lat - padLat),
    north: Math.min(85, ne.lat + padLat),
    minZoom: map.getZoom(),
  };
  return true;
}

function insideLock(lng: number, lat: number): boolean {
  if (!lock) return true;
  const x = lng < lock.west ? lng + 360 : lng;
  return x >= lock.west && x <= lock.east && lat >= lock.south && lat <= lock.north;
}

function clampCamera(): void {
  if (!lock) return;
  const c = map.getCenter();
  // Довгота в системі меж (для країн через антимеридіан межі можуть бути > 180)
  let lng = c.lng;
  if (lng < lock.west - 180) lng += 360;
  else if (lng > lock.east + 180) lng -= 360;
  const clampedLng = Math.min(lock.east, Math.max(lock.west, lng));
  const clampedLat = Math.min(lock.north, Math.max(lock.south, c.lat));
  const zoom = map.getZoom();
  const clampedZoom = Math.max(lock.minZoom, zoom);
  if (clampedLng === lng && clampedLat === c.lat && clampedZoom === zoom) return;
  map.easeTo({ center: [clampedLng, clampedLat], zoom: clampedZoom, duration: 250 });
}

// ---------- точки ----------

function setPoints(points: WebPoint[]): void {
  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      // `thumb` без значення не пишемо — фільтр ['has', 'thumb'] відсіє точки без фото
      properties: p.thumb
        ? { id: p.id, title: p.title, thumb: p.thumb }
        : { id: p.id, title: p.title },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  };
  (map.getSource('points') as GeoJSONSource | undefined)?.setData(collection);
}

const requestedThumbs = new Set<string>();

map.on('styleimagemissing', (e: { id: string }) => {
  if (!e.id.startsWith(THUMB_PREFIX)) return;
  const key = e.id.slice(THUMB_PREFIX.length);
  if (requestedThumbs.has(key)) return;
  requestedThumbs.add(key);
  post({ type: 'needThumb', key });
});

/** data: URL фото → кругла мініатюра із золотим обідком → іконка точки. */
function addThumb(key: string, dataUrl: string | null): void {
  const id = THUMB_PREFIX + key;
  if (map.hasImage(id)) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const size = Math.round(THUMB_SIZE * ratio);
  const draw = (img: HTMLImageElement | null) => {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = canvasEl.height = size;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    const ring = 2.5 * ratio;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = colors.gold;
    ctx.fill();
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - ring, 0, Math.PI * 2);
      ctx.clip();
      // cover: обрізаємо довшу сторону по центру
      const s = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - s) / 2,
        (img.height - s) / 2,
        s,
        s,
        ring,
        ring,
        size - ring * 2,
        size - ring * 2,
      );
      ctx.restore();
    }
    if (!map.hasImage(id)) {
      map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: ratio });
    }
  };
  if (!dataUrl) {
    draw(null);
    return;
  }
  const img = new Image();
  img.onload = () => draw(img);
  img.onerror = () => draw(null);
  img.src = dataUrl;
}

// ---------- детальна карта (OpenFreeMap) ----------

const attribution = document.getElementById('attribution')!;
attribution.textContent = DETAIL_ATTRIBUTION;

function updateAttribution(): void {
  attribution.style.opacity = state.detail && map.getZoom() >= DETAIL_MIN_ZOOM ? '1' : '0';
}

function setDetailMap(enabled: boolean): void {
  if (enabled === state.detail) return;
  state.detail = enabled;
  if (enabled) {
    map.addSource(DETAIL_SOURCE_ID, {
      type: 'vector',
      url: DETAIL_TILEJSON_URL,
      attribution: DETAIL_ATTRIBUTION,
    });
    for (const layer of detailBaseLayers()) map.addLayer(layer, 'countries-line');
    for (const layer of detailLabelLayers(state.lang, LABEL_FONT))
      map.addLayer(layer, 'points-dot');
    map.setMaxZoom(DETAIL_MAX_ZOOM);
    // Золото стає напівпрозорим — крізь нього видно воду, дороги й назви
    map.setPaintProperty('countries-fill', 'fill-opacity', fillOpacity(true));
  } else {
    for (const layer of [...detailBaseLayers(), ...detailLabelLayers(state.lang, LABEL_FONT)]) {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    }
    if (map.getSource(DETAIL_SOURCE_ID)) map.removeSource(DETAIL_SOURCE_ID);
    map.setMaxZoom(OFFLINE_MAX_ZOOM);
    map.setPaintProperty('countries-fill', 'fill-opacity', fillOpacity(false));
  }
  map.setFilter('cities', citiesFilter(enabled));
  updateAttribution();
}

// ---------- тапи й довге натискання ----------

const POINT_LAYERS = ['points-thumb', 'points-dot'];
let suppressClick = false;

function countryAt(point: PointLike): string | null {
  const feature = map.queryRenderedFeatures(point, { layers: ['countries-fill'] })[0];
  return (feature?.properties?.iso2 as string | undefined) ?? null;
}

map.on('click', (e) => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  const point = map.queryRenderedFeatures(e.point, { layers: POINT_LAYERS })[0];
  const id = point?.properties?.id as string | undefined;
  if (id) {
    post({ type: 'pointPress', id });
    return;
  }
  if (focusIso) return; // у мінікарті тап по країні нічого не робить
  const iso2 = countryAt(e.point);
  if (iso2) post({ type: 'countryPress', iso2 });
});

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let pressStart: { x: number; y: number } | null = null;

function cancelPress(): void {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
  pressStart = null;
}

function startPress(x: number, y: number): void {
  cancelPress();
  pressStart = { x, y };
  pressTimer = setTimeout(() => {
    pressTimer = null;
    pressStart = null;
    if (!onGlobe(x, y)) return; // космос
    const lngLat = map.unproject([x, y]);
    const iso2 = countryAt([x, y]);
    // Мінікарта — лише своя країна: сусідня країна чи відкрите море поза її межами не рахуються
    if (focusIso && iso2 !== focusIso && (iso2 !== null || !insideLock(lngLat.lng, lngLat.lat))) {
      return;
    }
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 600);
    post({
      type: 'longPress',
      lat: lngLat.lat,
      lng: lngLat.lng,
      iso2,
    });
  }, LONG_PRESS_MS);
}

function movePress(x: number, y: number): void {
  if (pressStart && Math.hypot(x - pressStart.x, y - pressStart.y) > LONG_PRESS_SLOP_PX) {
    cancelPress();
  }
}

// Довге натискання — на подіях DOM (у MapLibre немає такої події).
canvas.addEventListener(
  'touchstart',
  (e: TouchEvent) => {
    if (e.touches.length !== 1) return cancelPress();
    const rect = canvas.getBoundingClientRect();
    startPress(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
  },
  { passive: true },
);
canvas.addEventListener(
  'touchmove',
  (e: TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches.length !== 1) return cancelPress();
    movePress(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
  },
  { passive: true },
);
canvas.addEventListener('touchend', cancelPress, { passive: true });
canvas.addEventListener('touchcancel', cancelPress, { passive: true });
canvas.addEventListener('mousedown', (e) => startPress(e.offsetX, e.offsetY));
canvas.addEventListener('mousemove', (e) => movePress(e.offsetX, e.offsetY));
canvas.addEventListener('mouseup', cancelPress);
map.on('movestart', (e: { originalEvent?: unknown }) => {
  if (e.originalEvent) cancelPress();
});

// ---------- команди з React Native ----------

window[WEB_RECEIVER] = (message: ToWebMessage) => {
  switch (message.type) {
    case 'setCountries':
      fills.setVisited(new Set(message.visited));
      applyPlanned(new Set(message.planned));
      break;
    case 'setLanguage':
      state.lang = message.lang;
      map.setLayoutProperty('country-labels', 'text-field', ['get', message.lang]);
      if (map.getLayer('detail-places')) {
        map.setLayoutProperty('detail-places', 'text-field', placeName(message.lang));
      }
      break;
    case 'setAutoRotate':
      rotateEnabled = message.enabled && !focusIso;
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
    case 'setPoints':
      setPoints(message.points);
      break;
    case 'pointThumb':
      addThumb(message.key, message.dataUrl);
      break;
    case 'setDetailMap':
      setDetailMap(message.enabled);
      break;
  }
};

map.on('load', () => {
  if (focusIso) {
    map.setPaintProperty('countries-fill', 'fill-opacity', fillOpacity(false));
    fitCountry(focusIso);
    map.on('moveend', clampCamera);
  } else if (!init.camera) fitGlobe();
  updateHalo(true);
  map.on('move', () => updateHalo());
  map.on('zoom', updateAttribution);
  // Камера для RN — не частіше ніж раз на CAMERA_DEBOUNCE_MS (автообертання рухає її щокадру)
  let cameraTimer: ReturnType<typeof setTimeout> | null = null;
  map.on('moveend', () => {
    if (cameraTimer) clearTimeout(cameraTimer);
    cameraTimer = setTimeout(() => {
      const c = map.getCenter();
      post({ type: 'camera', lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    }, CAMERA_DEBOUNCE_MS);
  });
  window.addEventListener('resize', () => updateHalo(true));
  requestAnimationFrame(rotateFrame);
  post({ type: 'ready' });
});
