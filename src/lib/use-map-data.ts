import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useNetworkState } from 'expo-network';
import { useMemo } from 'react';

import type { GlobePoint } from '@/components/globe';
import { mapPlacesQuery, placedPhotosQuery } from '@/db';
import { expoDb } from '@/db/client';
import { photoUri } from '@/lib/photos';
import { buildMapPoints, type MapPoint } from '@/lib/places';

/**
 * Детальну карту (тайли з мережі) дозволяємо лише тоді, коли є інтернет. Без нього глобус
 * лишається повністю офлайн — такий, як раніше.
 */
export function useDetailMapAllowed(): boolean {
  const network = useNetworkState();
  return !!network.isConnected && network.isInternetReachable !== false;
}

/** Усі точки для глобуса / мінікарти, з мініатюрою першого фото (живі дані). */
export function useMapPoints(): { points: GlobePoint[]; byId: Map<string, MapPoint> } {
  const { data: places } = useLiveQuery(mapPlacesQuery(expoDb));
  const { data: photos } = useLiveQuery(placedPhotosQuery(expoDb));
  return useMemo(() => {
    const mapPoints = buildMapPoints(places, photos);
    return {
      points: mapPoints.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        title: p.title,
        thumbnail: p.thumbnail ? photoUri(p.thumbnail) : null,
      })),
      byId: new Map(mapPoints.map((p) => [p.id, p])),
    };
  }, [places, photos]);
}
