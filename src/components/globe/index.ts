/**
 * Єдиний публічний вхід до глобуса. Решта коду імпортує лише звідси.
 *
 * Зараз — WebView + MapLibre (працює в Expo Go). Перед публікацією: додати
 * GlobeView.mapbox.tsx (@rnmapbox/maps) з тим самим контрактом і змінити рядок нижче.
 */
export { GlobeView } from './GlobeView.webview';
export type { FlyToTarget, GlobeViewHandle, GlobeViewProps } from './types';
