/**
 * Країна за координатами — за нашими кордонами (Natural Earth `_ukr`: Крим — Україна).
 * Кордони вшиті в бандл рядком; розбираються лише при першому виклику.
 */
// Відносний шлях: babel-plugin-inline-import не розуміє аліас @/
import bordersText from '../data/borders.geojson';
import type { BorderProps } from '@/data/types';
import { createCountryLocator, type FeatureCollection } from '@/lib/geo';

let locate: ((point: [number, number]) => string | null) | null = null;

/** ISO2 країни в точці (або найближчої в межах ~30 км — узбережжя, острівці), інакше null. */
export function locateCountry(lng: number, lat: number): string | null {
  if (!locate) {
    const borders = JSON.parse(bordersText) as FeatureCollection<BorderProps>;
    locate = createCountryLocator(borders.features);
  }
  return locate([lng, lat]);
}
