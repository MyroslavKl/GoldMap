/**
 * Мінімальна геометрія для збірки даних і тестів: точка в полігоні та відстань.
 * Координати GeoJSON — [lng, lat].
 */

export type Position = [number, number];
export type Ring = Position[];
export type PolygonCoords = Ring[];
export type Geometry =
  | { type: 'Polygon'; coordinates: PolygonCoords }
  | { type: 'MultiPolygon'; coordinates: PolygonCoords[] };

export type Feature<P> = { type: 'Feature'; properties: P; geometry: Geometry };
export type FeatureCollection<P> = { type: 'FeatureCollection'; features: Feature<P>[] };

function pointInRing([x, y]: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygons(geometry: Geometry): PolygonCoords[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

/** Чи лежить точка [lng, lat] у геометрії (з урахуванням дірок). */
export function pointInGeometry(point: Position, geometry: Geometry): boolean {
  return polygons(geometry).some(
    ([outer, ...holes]) => pointInRing(point, outer) && !holes.some((h) => pointInRing(point, h)),
  );
}

/** Приблизна відстань у градусах до найближчої вершини геометрії. */
export function distanceToGeometry([x, y]: Position, geometry: Geometry): number {
  let best = Infinity;
  for (const polygon of polygons(geometry)) {
    for (const ring of polygon) {
      for (const [px, py] of ring) {
        const dx = (px - x) * Math.cos((y * Math.PI) / 180);
        const d = dx * dx + (py - y) ** 2;
        if (d < best) best = d;
      }
    }
  }
  return Math.sqrt(best);
}

type BBox = [minX: number, minY: number, maxX: number, maxY: number];

function bbox(geometry: Geometry): BBox {
  const b: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons(geometry)) {
    for (const [x, y] of polygon[0]) {
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
    }
  }
  return b;
}

function inBBox([x, y]: Position, b: BBox, pad = 0): boolean {
  return x >= b[0] - pad && x <= b[2] + pad && y >= b[1] - pad && y <= b[3] + pad;
}

/**
 * Індекс кордонів для пошуку країни за точкою: спершу точне влучання в полігон,
 * інакше — найближчий кордон у межах `maxDistanceDeg` (прибережні міста, острівці).
 */
export function createCountryLocator<P extends { iso2: string }>(
  features: Feature<P>[],
  maxDistanceDeg = 0.3,
) {
  const indexed = features.map((f) => ({ f, box: bbox(f.geometry) }));

  return function locate(point: Position): string | null {
    const hit = indexed.find(
      ({ f, box }) => inBBox(point, box) && pointInGeometry(point, f.geometry),
    );
    if (hit) return hit.f.properties.iso2;

    let best: { iso2: string; d: number } | null = null;
    for (const { f, box } of indexed) {
      if (!inBBox(point, box, maxDistanceDeg)) continue;
      const d = distanceToGeometry(point, f.geometry);
      if (d <= maxDistanceDeg && (!best || d < best.d)) best = { iso2: f.properties.iso2, d };
    }
    return best?.iso2 ?? null;
  };
}
