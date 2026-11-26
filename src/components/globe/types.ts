import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Контракт глобуса. Решта додатку знає лише його — реалізацію (зараз WebView + MapLibre,
 * перед публікацією — нативний @rnmapbox/maps) можна замінити, не чіпаючи екрани.
 * Жодних типів WebView чи MapLibre тут немає.
 */

/** Точка на карті. */
export type GlobePoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  /**
   * Мініатюра — URI локального файлу (file://…_t.jpg) або null. Як вона потрапляє на карту —
   * справа реалізації (WebView отримує її як data: URL, Mapbox читатиме файл сам).
   */
  thumbnail: string | null;
};

/** Довге натискання на карті. */
export type GlobeLongPress = {
  lat: number;
  lng: number;
  /** Країна під пальцем за нашими кордонами, або null (океан) */
  iso2: string | null;
};

/** Положення камери — щоб відновити глобус після вивантаження. */
export type GlobeCamera = { lat: number; lng: number; zoom: number };

export type GlobeViewProps = {
  /** ISO2 відвіданих країн — заливаються золотом */
  visited: readonly string[];
  /** ISO2 країн запланованих поїздок — пульсують */
  planned?: readonly string[];
  /**
   * Повільне обертання (~3°/с): зупиняється від дотику й відновлюється через 5 с без дій, якщо
   * глобус віддалений (видно майже всю кулю). За замовчуванням true
   */
  autoRotate?: boolean;
  /** Мова назв на карті. За замовчуванням 'en' */
  language?: 'uk' | 'en';
  /** Точки: кружечки, з наближенням (zoom ≥ 6) — круглі мініатюри фото */
  points?: readonly GlobePoint[];
  /**
   * Дозволити детальну карту з мережі (тайли) при наближенні. Екран вмикає, лише коли є
   * інтернет; без неї — тільки вшиті кордони й міста.
   */
  detailMap?: boolean;
  /**
   * Режим мінікарти: камера вписує країну й не виходить за її межі (рух і віддалення лише в
   * країні), без обертання; інші країни приглушені. Задається один раз при створенні.
   */
  focus?: { iso2: string };
  /** Звідки почати (замість типового вигляду). Задається при створенні */
  initialCamera?: GlobeCamera;
  /** Тап по країні */
  onCountryPress?: (iso2: string) => void;
  /** Тап по точці */
  onPointPress?: (id: string) => void;
  /** Довге натискання (~0,5 с) — поставити точку */
  onLongPress?: (event: GlobeLongPress) => void;
  /** Камера зупинилась (після руху) */
  onCameraChange?: (camera: GlobeCamera) => void;
  /** Користувач торкнувся глобуса (обертання зупинилось) */
  onInteraction?: () => void;
  /** Глобус намальований і готовий до команд */
  onReady?: () => void;
  style?: StyleProp<ViewStyle>;
};

export type FlyToTarget = { iso2: string } | { lat: number; lng: number; zoom?: number };

/** Імперативні команди через ref. */
export type GlobeViewHandle = {
  /** Плавно повернути глобус до країни або точки (зупиняє автообертання) */
  flyTo: (target: FlyToTarget) => void;
};
