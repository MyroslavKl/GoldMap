/**
 * Повідомлення між React Native і кодом глобуса всередині WebView.
 * Файл без залежностей: його імпортують і GlobeView.webview.tsx, і web/main.ts.
 */

/** React Native → WebView */
export type ToWebMessage =
  | { type: 'setCountries'; visited: string[]; planned: string[] }
  | { type: 'setAutoRotate'; enabled: boolean }
  | { type: 'flyTo'; lat: number; lng: number; zoom: number };

/** WebView → React Native */
export type FromWebMessage =
  | { type: 'ready' }
  | { type: 'countryPress'; iso2: string }
  | { type: 'interaction' }
  | { type: 'error'; message: string };

/** Глобальна функція у WebView, яку викликає RN через injectJavaScript. */
export const WEB_RECEIVER = '__goldmapReceive';

export function isFromWebMessage(value: unknown): value is FromWebMessage {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  switch (type) {
    case 'ready':
    case 'interaction':
      return true;
    case 'countryPress':
      return typeof (value as { iso2?: unknown }).iso2 === 'string';
    case 'error':
      return typeof (value as { message?: unknown }).message === 'string';
    default:
      return false;
  }
}
