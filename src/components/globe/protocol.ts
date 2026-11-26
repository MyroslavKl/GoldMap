/**
 * Повідомлення між React Native і кодом глобуса всередині WebView.
 * Файл без залежностей: його імпортують і GlobeView.webview.tsx, і web/main.ts.
 */

export type WebPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  /** Ключ мініатюри (URI файлу в RN) або null; саме зображення приходить окремо (pointThumb) */
  thumb: string | null;
};

/** Налаштування, що задаються один раз до створення карти (injectedJavaScriptBeforeContentLoaded). */
export type WebInit = {
  camera: { lat: number; lng: number; zoom: number } | null;
  focusIso: string | null;
  lang: 'uk' | 'en';
};

/** Глобальна змінна з WebInit у WebView. */
export const WEB_INIT = '__GM_INIT__';

/** React Native → WebView */
export type ToWebMessage =
  | { type: 'setCountries'; visited: string[]; planned: string[] }
  | { type: 'setAutoRotate'; enabled: boolean }
  | { type: 'setLanguage'; lang: 'uk' | 'en' }
  | { type: 'flyTo'; lat: number; lng: number; zoom: number }
  | { type: 'setPoints'; points: WebPoint[] }
  | { type: 'setDetailMap'; enabled: boolean }
  /** Відповідь на needThumb: data: URL мініатюри, або null — файлу немає */
  | { type: 'pointThumb'; key: string; dataUrl: string | null };

/** WebView → React Native */
export type FromWebMessage =
  | { type: 'ready' }
  | { type: 'countryPress'; iso2: string }
  | { type: 'pointPress'; id: string }
  | { type: 'longPress'; lat: number; lng: number; iso2: string | null }
  | { type: 'camera'; lat: number; lng: number; zoom: number }
  /** Точка з мініатюрою потрапила в кадр при zoom ≥ 6 — потрібне зображення */
  | { type: 'needThumb'; key: string }
  | { type: 'interaction' }
  | { type: 'error'; message: string };

/** Глобальна функція у WebView, яку викликає RN через injectJavaScript. */
export const WEB_RECEIVER = '__goldmapReceive';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

export function isFromWebMessage(value: unknown): value is FromWebMessage {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  switch (m.type) {
    case 'ready':
    case 'interaction':
      return true;
    case 'countryPress':
      return isStr(m.iso2);
    case 'pointPress':
      return isStr(m.id);
    case 'needThumb':
      return isStr(m.key);
    case 'longPress':
      return isNum(m.lat) && isNum(m.lng) && (m.iso2 === null || isStr(m.iso2));
    case 'camera':
      return isNum(m.lat) && isNum(m.lng) && isNum(m.zoom);
    case 'error':
      return isStr(m.message);
    default:
      return false;
  }
}
