/**
 * Точки для глобуса з рядків бази. Чистий модуль без React і Expo (тестується в Node).
 */

export type MapPlaceRow = {
  id: string;
  countryIso: string;
  title: string;
  lat: number | null;
  lng: number | null;
};

export type PlacedPhotoRow = {
  id: string;
  placeId: string | null;
  thumbUri: string;
  takenAt: string | null;
  createdAt: string;
};

export type MapPoint = {
  id: string;
  countryIso: string;
  lat: number;
  lng: number;
  title: string;
  /** Мініатюра першого фото точки (відносний шлях photos/…_t.jpg) або null */
  thumbnail: string | null;
};

/** Ключ «першого» фото: за датою зйомки, без дати — після, далі за порядком додавання. */
function photoOrder(p: PlacedPhotoRow): string {
  return `${p.takenAt ? '0' : '1'}${p.takenAt ?? ''}|${p.createdAt}|${p.id}`;
}

/** Точки з координатами + мініатюра першого фото кожної точки. */
export function buildMapPoints(
  places: readonly MapPlaceRow[],
  photos: readonly PlacedPhotoRow[],
): MapPoint[] {
  const first = new Map<string, PlacedPhotoRow>();
  for (const photo of photos) {
    if (!photo.placeId) continue;
    const current = first.get(photo.placeId);
    if (!current || photoOrder(photo) < photoOrder(current)) first.set(photo.placeId, photo);
  }
  const points: MapPoint[] = [];
  for (const p of places) {
    if (p.lat == null || p.lng == null) continue;
    points.push({
      id: p.id,
      countryIso: p.countryIso,
      lat: p.lat,
      lng: p.lng,
      title: p.title,
      thumbnail: first.get(p.id)?.thumbUri ?? null,
    });
  }
  return points;
}

/** Скільки фото в кожній точці. */
export function countPhotosByPlace(photos: readonly { placeId: string | null }[]) {
  const counts = new Map<string, number>();
  for (const p of photos) if (p.placeId) counts.set(p.placeId, (counts.get(p.placeId) ?? 0) + 1);
  return counts;
}
