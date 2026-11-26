/**
 * Детальна карта при наближенні: векторні тайли OpenFreeMap (схема OpenMapTiles, без ключа).
 * Підключається лише з інтернетом і лише з zoom ≥ DETAIL_MIN_ZOOM.
 *
 * З тайлів беремо ЛИШЕ воду, річки, дороги, забудову й назви населених пунктів. Шар `boundary`
 * (кордони й адмінмежі) і підписи країн/регіонів не використовуються ніколи: кордони — тільки
 * наші, з точкою зору України (Крим — Україна). Це перевіряє tests/globe.test.ts.
 *
 * Чистий модуль без MapLibre-рантайму (лише типи) — тестується в Node.
 */
import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';

import { colors, goldAlpha } from '../../../theme/colors.ts';

export const DETAIL_SOURCE_ID = 'detail';
/** TileJSON OpenFreeMap: сам указує актуальну версію тайлів */
export const DETAIL_TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
export const DETAIL_MIN_ZOOM = 6;
/** Найбільше наближення з детальною картою (тайли є до 14, далі — перемасштабування) */
export const DETAIL_MAX_ZOOM = 16;
/** Обов'язкова атрибуція OpenFreeMap / OpenMapTiles / OpenStreetMap */
export const DETAIL_ATTRIBUTION = '© OpenFreeMap © OpenMapTiles © OpenStreetMap';

/** Які шари тайлів узагалі використовуються. `boundary` тут бути не може. */
export const DETAIL_SOURCE_LAYERS = [
  'water',
  'waterway',
  'transportation',
  'building',
  'place',
] as const;

/** Класи населених пунктів, чиї назви показуємо (без country, state, continent). */
export const PLACE_CLASSES = ['city', 'town', 'village', 'suburb'] as const;

type Lang = 'uk' | 'en';

/** Назва населеного пункту мовою інтерфейсу, інакше місцева. */
export function placeName(lang: Lang): ExpressionSpecification {
  return lang === 'uk'
    ? ['coalesce', ['get', 'name:uk'], ['get', 'name']]
    : ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];
}

const source = DETAIL_SOURCE_ID;
const minzoom = DETAIL_MIN_ZOOM;

/** Шари під нашими кордонами (вода, дороги, забудова) — у порядку малювання. */
export function detailBaseLayers(): LayerSpecification[] {
  return [
    {
      id: 'detail-water',
      type: 'fill',
      source,
      'source-layer': 'water',
      minzoom,
      paint: { 'fill-color': colors.ocean, 'fill-antialias': false },
    },
    {
      id: 'detail-waterway',
      type: 'line',
      source,
      'source-layer': 'waterway',
      minzoom: 8,
      paint: {
        'line-color': colors.ocean,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2.5],
      },
    },
    {
      id: 'detail-building',
      type: 'fill',
      source,
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': goldAlpha(0.14), 'fill-antialias': false },
    },
    {
      id: 'detail-roads',
      type: 'line',
      source,
      'source-layer': 'transportation',
      minzoom,
      filter: [
        'any',
        ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
        [
          'all',
          ['>=', ['zoom'], 9],
          ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false],
        ],
        [
          'all',
          ['>=', ['zoom'], 12],
          ['match', ['get', 'class'], ['minor', 'service', 'pedestrian'], true, false],
        ],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.textMuted,
        'line-opacity': 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 10, 1, 14, 3],
      },
    },
  ];
}

/** Назви населених пунктів — над кордонами, під нашими точками. */
export function detailLabelLayers(lang: Lang, font: string): LayerSpecification[] {
  return [
    {
      id: 'detail-places',
      type: 'symbol',
      source,
      'source-layer': 'place',
      minzoom,
      filter: [
        'all',
        ['match', ['get', 'class'], [...PLACE_CLASSES], true, false],
        // Села — з 10, передмістя — з 12
        ['any', ['!=', ['get', 'class'], 'village'], ['>=', ['zoom'], 10]],
        ['any', ['!=', ['get', 'class'], 'suburb'], ['>=', ['zoom'], 12]],
      ],
      layout: {
        'text-field': placeName(lang),
        'text-font': [font],
        // Один interpolate за zoom (так вимагає MapLibre), клас міста — всередині зупинок
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          ['match', ['get', 'class'], 'city', 12, 9],
          12,
          ['match', ['get', 'class'], 'city', 17, 13],
        ],
        'text-max-width': 8,
        'text-padding': 4,
      },
      paint: {
        'text-color': colors.text,
        'text-halo-color': colors.bg,
        'text-halo-width': 1.2,
      },
    },
  ];
}
