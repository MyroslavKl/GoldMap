/**
 * Силуети країн для картки: локальна проєкція з центром у країні → SVG-шлях у viewBox.
 * Спільне для build-data.ts (генерація) і data.test.ts (перевірка Криму).
 */
import type { Geometry, Position, Ring } from './geo.ts';

/** Найбільша сторона viewBox силуету */
export const OUTLINE_SIZE = 100;

/** Параметри проєкції: [lng0, lat0, k, minX, maxY] — див. projectPoint. */
export type OutlineProjection = [number, number, number, number, number];

export type Outline = {
  /** SVG path: абсолютні M/L/Z */
  d: string;
  w: number;
  h: number;
  p: OutlineProjection;
};

const wrapLng = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/** Локальна рівнопроміжна проєкція навколо (lng0, lat0) у градусах; працює через 180-й меридіан. */
function local([lng, lat]: Position, lng0: number, lat0: number): Position {
  return [wrapLng(lng - lng0) * Math.cos((lat0 * Math.PI) / 180), lat - lat0];
}

/** Точка [lng, lat] → координати viewBox силуету. */
export function projectPoint(point: Position, p: OutlineProjection): Position {
  const [lng0, lat0, k, minX, maxY] = p;
  const [x, y] = local(point, lng0, lat0);
  return [(x - minX) * k, (maxY - y) * k];
}

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
}

function bbox(rings: Ring[]): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rings) {
    for (const [x, y] of r) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return [x0, y0, x1, y1];
}

/**
 * Побудувати силует. Віддалені заморські частини (Гвіана для Франції, Аляска для США)
 * відкидаються, інакше основна частина стає крихітною.
 */
export function buildOutline(geometry: Geometry, center: Position): Outline {
  const [lng0, lat0] = center;
  const polygons = (
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  ).map((poly) => poly.map((ring) => ring.map((pt) => local(pt, lng0, lat0))));

  // Головна частина — найбільша за площею; лишаємо частини поблизу неї.
  const main = polygons.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
  const [mx0, my0, mx1, my1] = bbox([main[0]]);
  const pad = Math.max(2, 0.2 * Math.max(mx1 - mx0, my1 - my0));
  const kept = polygons.filter((poly) => {
    const [x0, y0, x1, y1] = bbox([poly[0]]);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return cx >= mx0 - pad && cx <= mx1 + pad && cy >= my0 - pad && cy <= my1 + pad;
  });

  const [minX, minY, maxX, maxY] = bbox(kept.map((poly) => poly[0]));
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const k = OUTLINE_SIZE / span;
  const p: OutlineProjection = [lng0, lat0, k, minX, maxY].map(
    (v) => +v.toFixed(6),
  ) as OutlineProjection;

  const fmt = (v: number) => +v.toFixed(1);
  const parts: string[] = [];
  for (const poly of kept) {
    for (const ring of poly) {
      const pts: string[] = [];
      let prev = '';
      for (const [x, y] of ring) {
        const s = `${fmt((x - minX) * k)},${fmt((maxY - y) * k)}`;
        if (s !== prev) pts.push(s);
        prev = s;
      }
      if (pts.length >= 3) parts.push(`M${pts.join('L')}Z`);
    }
  }

  return {
    d: parts.join(''),
    w: fmt((maxX - minX) * k),
    h: fmt((maxY - minY) * k),
    p,
  };
}

/** Розібрати шлях (лише M/L/Z) назад у кільця — для тестів. */
export function parseOutlinePath(d: string): Ring[] {
  return d
    .split('Z')
    .filter((s) => s.startsWith('M'))
    .map((s) =>
      s
        .slice(1)
        .split('L')
        .map((pt) => pt.split(',').map(Number) as Position),
    );
}
