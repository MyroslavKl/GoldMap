import rawOutlines from './outlines.json';

/** Силует країни: SVG-шлях у viewBox `0 0 w h` (згенеровано scripts/build-data.ts). */
export type CountryOutlineData = { d: string; w: number; h: number };

const OUTLINES = rawOutlines as Record<string, CountryOutlineData>;

export function getOutline(iso2: string): CountryOutlineData | undefined {
  return OUTLINES[iso2];
}
