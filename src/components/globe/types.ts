import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Контракт глобуса. Решта додатку знає лише його — реалізацію (зараз WebView + MapLibre,
 * перед публікацією — нативний @rnmapbox/maps) можна замінити, не чіпаючи екрани.
 */
export type GlobeViewProps = {
  /** ISO2 відвіданих країн — заливаються золотом */
  visited: readonly string[];
  /** ISO2 країн запланованих поїздок — пульсують */
  planned?: readonly string[];
  /** Повільне обертання (~3°/с), зупиняється при першому дотику. За замовчуванням true */
  autoRotate?: boolean;
  /** Мова назв країн на глобусі. За замовчуванням 'en' */
  language?: 'uk' | 'en';
  /** Тап по країні */
  onCountryPress?: (iso2: string) => void;
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
