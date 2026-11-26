/**
 * Пропозиції точок з фото з GPS: фото, зняті поруч (~1 км) в один день, — одна точка.
 * Чистий модуль без React і Expo (тестується в Node).
 */
import type { City, LocalizedName } from '../data/types.ts';

/** Фото, зняті ближче за це одне від одного (ланцюжком), — одна точка */
export const CLUSTER_RADIUS_KM = 1;
/** Назва точки — найближче місто в цих межах, інакше без міста */
export const CITY_RADIUS_KM = 30;

const EARTH_RADIUS_KM = 6371;

export type GeoPhoto = {
  id: string;
  lat: number | null;
  lng: number | null;
  /** 'YYYY-MM-DDTHH:mm:ss' — місцевий час кадру */
  takenAt: string | null;
  placeId: string | null;
};

export type PhotoCluster = {
  photoIds: string[];
  /** Центр групи */
  lat: number;
  lng: number;
  /** День зйомки 'YYYY-MM-DD' або null, якщо дати немає */
  date: string | null;
};

/** Відстань по поверхні Землі, км. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

type Located = GeoPhoto & { lat: number; lng: number };

/**
 * Групи фото: один день + ланцюжок відстаней ≤ radiusKm (прогулянка містом — одна точка).
 * Фото без GPS і вже прив'язані до точки не беруться. Порядок — за датою, потім за першим фото.
 */
export function clusterPhotos(
  photos: readonly GeoPhoto[],
  radiusKm = CLUSTER_RADIUS_KM,
): PhotoCluster[] {
  const byDay = new Map<string, Located[]>();
  for (const p of photos) {
    if (p.lat == null || p.lng == null || p.placeId) continue;
    const day = p.takenAt?.slice(0, 10) ?? '';
    const list = byDay.get(day) ?? [];
    list.push(p as Located);
    byDay.set(day, list);
  }

  const clusters: PhotoCluster[] = [];
  for (const [day, list] of byDay) {
    // Union-find: з'єднуємо всі пари ближче за radiusKm
    const parent = list.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (haversineKm(list[i].lat, list[i].lng, list[j].lat, list[j].lng) <= radiusKm) {
          parent[find(i)] = find(j);
        }
      }
    }
    const groups = new Map<number, Located[]>();
    list.forEach((p, i) => {
      const root = find(i);
      groups.set(root, [...(groups.get(root) ?? []), p]);
    });
    for (const group of groups.values()) {
      clusters.push({
        photoIds: group.map((p) => p.id),
        lat: round6(group.reduce((s, p) => s + p.lat, 0) / group.length),
        lng: round6(group.reduce((s, p) => s + p.lng, 0) / group.length),
        date: day || null,
      });
    }
  }
  return clusters.sort(
    (a, b) =>
      (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
      a.photoIds[0].localeCompare(b.photoIds[0]),
  );
}

/** Найближче місто в межах maxKm (за вшитим cities.json, офлайн). */
export function nearestCity(
  cities: readonly City[],
  lat: number,
  lng: number,
  maxKm = CITY_RADIUS_KM,
): City | null {
  let best: City | null = null;
  let bestKm = maxKm;
  for (const c of cities) {
    // Грубий відсів за градусами, щоб не рахувати haversine для всіх 3000+ міст
    if (Math.abs(c.lat - lat) > 1 || Math.abs(c.lng - lng) > 2) continue;
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km <= bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return best;
}

export type PlaceSuggestion = PhotoCluster & {
  /** Країна за координатами (наші кордони, точка зору України) */
  countryIso: string | null;
  /** Країна, на екрані якої зараз людина (куди додано фото) */
  sourceIso: string;
  city: LocalizedName | null;
};

/**
 * Пропозиції точок для країни: групи ще не прив'язаних фото з GPS, крім пропущених.
 * `locate(lng, lat)` визначає країну за кордонами; якщо вона інша, ніж `sourceIso`, — екран
 * пропонує додати точку в ту країну (і позначити її відвіданою) або пропустити.
 */
export function suggestPlaces(input: {
  photos: readonly GeoPhoto[];
  sourceIso: string;
  skipped: ReadonlySet<string>;
  cities: readonly City[];
  locate: (lng: number, lat: number) => string | null;
}): PlaceSuggestion[] {
  const fresh = input.photos.filter((p) => !input.skipped.has(p.id));
  return clusterPhotos(fresh).map((c) => ({
    ...c,
    countryIso: input.locate(c.lng, c.lat),
    sourceIso: input.sourceIso,
    city: nearestCity(input.cities, c.lat, c.lng)?.name ?? null,
  }));
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
