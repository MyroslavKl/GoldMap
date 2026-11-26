import raw from './landmarks.json';
import type { Landmark, LandmarksFile } from './types';

const data = raw as LandmarksFile;

/** «Варто побачити» в країні: до 15 визначних місць (Wikidata, CC0), від найвідоміших. */
export function getLandmarks(iso2: string): readonly Landmark[] {
  return data.countries[iso2] ?? [];
}
