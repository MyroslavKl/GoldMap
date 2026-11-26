/**
 * Дата зйомки й GPS з EXIF, як їх повертає expo-image-picker (`exif: true`).
 * Чистий модуль без Expo (тестується в Node).
 *
 * Формати різняться за платформою:
 * - iOS: DateTimeOriginal на верхньому рівні, GPS — вкладений словник `{GPS}`
 *   (Latitude/Longitude без знака + LatitudeRef 'N'|'S', LongitudeRef 'E'|'W').
 * - Android: плоскі ключі GPSLatitude/GPSLongitude — десяткове число зі знаком або
 *   раціональний рядок «50/1,27/1,1234/100» з GPSLatitudeRef.
 */

export type PhotoMeta = {
  /** 'YYYY-MM-DDTHH:mm:ss' — місцевий час кадру, як у камері (без часового поясу) */
  takenAt: string | null;
  lat: number | null;
  lng: number | null;
};

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Шукає ключ на верхньому рівні й у вкладених словниках ({Exif}, {TIFF}, {GPS}). */
function lookup(exif: Dict, keys: readonly string[], nested: readonly string[]): unknown {
  for (const key of keys) if (exif[key] != null) return exif[key];
  for (const group of nested) {
    const dict = exif[group];
    if (!isDict(dict)) continue;
    for (const key of keys) if (dict[key] != null) return dict[key];
  }
  return undefined;
}

/** «2024:03:15 14:22:01» → '2024-03-15T14:22:01'; нулі й сміття → null. */
export function parseExifDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00'] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const valid =
    +y >= 1900 &&
    date.getUTCMonth() === +mo - 1 &&
    date.getUTCDate() === +d &&
    +h < 24 &&
    +mi < 60 &&
    +s < 60;
  return valid ? `${y}-${mo}-${d}T${h}:${mi}:${s}` : null;
}

/** «1234/100» → 12.34 */
function parseRational(part: string): number | null {
  const [num, den = '1'] = part.trim().split('/');
  const n = Number(num);
  const dn = Number(den);
  return Number.isFinite(n) && Number.isFinite(dn) && dn !== 0 ? n / dn : null;
}

/**
 * Координата EXIF → градуси: число, рядок «50.45», раціональний «50/1,27/1,1234/100»
 * або масив [градуси, хвилини, секунди].
 */
export function parseCoordinate(value: unknown): number | null {
  let parts: (number | null)[];
  if (typeof value === 'number') parts = [value];
  else if (Array.isArray(value)) parts = value.map((v) => (typeof v === 'number' ? v : null));
  else if (typeof value === 'string') parts = value.split(',').map(parseRational);
  else return null;
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => p === null)) return null;
  const [deg, min = 0, sec = 0] = parts as number[];
  const sign = deg < 0 ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}

function applyRef(value: number, ref: unknown, negative: string): number {
  if (typeof ref !== 'string' || !ref) return value;
  return ref.trim().toUpperCase().startsWith(negative) ? -Math.abs(value) : Math.abs(value);
}

const DATE_KEYS = ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime'] as const;

export function parsePhotoMeta(exif: unknown): PhotoMeta {
  const none: PhotoMeta = { takenAt: null, lat: null, lng: null };
  if (!isDict(exif)) return none;

  const takenAt = parseExifDate(lookup(exif, DATE_KEYS, ['{Exif}', '{TIFF}']));

  const gps = isDict(exif['{GPS}']) ? exif['{GPS}'] : null;
  const rawLat = gps ? gps.Latitude : exif.GPSLatitude;
  const rawLng = gps ? gps.Longitude : exif.GPSLongitude;
  const latRef = gps ? gps.LatitudeRef : exif.GPSLatitudeRef;
  const lngRef = gps ? gps.LongitudeRef : exif.GPSLongitudeRef;

  const parsedLat = parseCoordinate(rawLat);
  const parsedLng = parseCoordinate(rawLng);
  if (parsedLat === null || parsedLng === null) return { ...none, takenAt };
  const lat = applyRef(parsedLat, latRef, 'S');
  const lng = applyRef(parsedLng, lngRef, 'W');

  const valid =
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    // (0, 0) — типова «порожня» відповідь камер без фіксу GPS
    !(lat === 0 && lng === 0);
  if (!valid) return { ...none, takenAt };
  return { takenAt, lat: round6(lat), lng: round6(lng) };
}

/** 6 знаків після коми ≈ 10 см — точніше EXIF однаково не буває. */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Дата зйомки → дата для бази ('YYYY-MM-DD'), напр. щоб запропонувати дати візиту.
 */
export function takenAtDate(takenAt: string | null): string | null {
  return takenAt ? takenAt.slice(0, 10) : null;
}
