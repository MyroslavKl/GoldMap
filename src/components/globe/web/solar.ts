/**
 * Сонячна система навколо глобуса при сильному віддаленні — геометрія без малювання.
 * Чистий модуль (тестується в Node). Масштаб умовний: орбіти стиснуті, планети збільшені,
 * але порядок і пропорції «більше/менше» збережені.
 *
 * Ідея руху камери: при progress = 0 Земля (наш глобус) у центрі екрана, Сонце далеко за
 * краєм; при progress = 1 у центрі Сонце, а глобус — на своїй орбіті. Увесь «світ» (глобус +
 * система) зсувається на progress × вектор Сонце→Земля.
 */

export const PLANET_IDS = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const;
export type PlanetId = (typeof PLANET_IDS)[number];
/** Підписи: планети + Сонце */
export type SpaceLabelId = PlanetId | 'sun';

type PlanetDef = {
  id: PlanetId;
  /** Радіус орбіти в одиницях орбіти Землі (стиснуто відносно реальних а. о.) */
  orbit: number;
  /** Радіус диска при progress = 1, у частках меншої половини екрана */
  size: number;
  /** Період обертання, земних років (реальні) */
  period: number;
  /** Початковий кут, радіани — щоб планети не стояли в ряд */
  phase: number;
};

export const PLANETS: readonly PlanetDef[] = [
  // Внутрішні орбіти розсунуті, зовнішні стиснуті — щоб на екрані телефону не злипалось
  { id: 'mercury', orbit: 0.5, size: 0.014, period: 0.24, phase: 0.4 },
  { id: 'venus', orbit: 0.75, size: 0.022, period: 0.62, phase: 2.1 },
  { id: 'earth', orbit: 1, size: 0, period: 1, phase: 0.9 },
  { id: 'mars', orbit: 1.3, size: 0.018, period: 1.88, phase: 4.0 },
  { id: 'jupiter', orbit: 1.7, size: 0.05, period: 11.86, phase: 5.2 },
  { id: 'saturn', orbit: 2.05, size: 0.042, period: 29.46, phase: 1.3 },
  { id: 'uranus', orbit: 2.4, size: 0.03, period: 84.0, phase: 3.3 },
  { id: 'neptune', orbit: 2.7, size: 0.029, period: 164.8, phase: 2.7 },
];

/** Скільки секунд триває «земний рік» в анімації */
export const SECONDS_PER_YEAR = 60;
/** Найдальша орбіта при progress = 1 займає таку частку меншої половини екрана */
const OUTER_FIT = 0.92;
/** Радіус Сонця при progress = 1, частка меншої половини екрана */
const SUN_SIZE = 0.06;
/** У скільки разів зменшується глобус при progress = 1 (CSS-масштаб) */
export const GLOBE_MIN_SCALE = 0.75;

/** Орбіти — еліпси: легкий нахил площини, щоб система виглядала об'ємною */
export const ORBIT_TILT = 0.7;

/** Плавний перехід 0..1 */
export function smoothstep(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/**
 * Наскільки видно Сонячну систему (0..1) залежно від наближення глобуса.
 * `fitZoom` — наближення, з яким глобус вписано на старті.
 */
export function spaceProgress(zoom: number, fitZoom: number): number {
  const start = fitZoom - 1; // глобус удвічі менший за стартовий — починаємо проявляти
  const end = fitZoom - 2.6;
  return smoothstep((start - zoom) / (start - end));
}

export type SpaceBody = { id: PlanetId | 'sun'; x: number; y: number; r: number };

export type SpaceLayout = {
  /** Зсув «світу» (глобуса) від центру екрана, px */
  worldX: number;
  worldY: number;
  /** CSS-масштаб глобуса */
  globeScale: number;
  /** Центр Сонця відносно центру екрана, px */
  sunX: number;
  sunY: number;
  /** Радіуси орбіт, px (для всіх планет, включно із Землею) */
  orbits: number[];
  /** Сонце й планети, крім Землі (Земля — сам глобус), відносно центру екрана */
  bodies: SpaceBody[];
};

/** Кут планети на орбіті в момент t (секунди анімації). */
export function planetAngle(planet: PlanetDef, t: number): number {
  return planet.phase + (2 * Math.PI * t) / (planet.period * SECONDS_PER_YEAR);
}

/**
 * Розташування тіл на екрані. `halfMin` — половина меншої сторони екрана, px.
 * Масштаб орбіт плавно зменшується з progress: на 0 Сонце далеко за екраном, на 1 вся
 * система вміщається.
 */
export function spaceLayout(progress: number, t: number, halfMin: number): SpaceLayout {
  const p = Math.min(1, Math.max(0, progress));
  const outer = PLANETS[PLANETS.length - 1].orbit;
  const unitAtFull = (halfMin * OUTER_FIT) / outer;
  // На progress = 0 орбіта Землі — 2,5 екрана: Сонце далеко за краєм
  const unit = unitAtFull + (halfMin * 2.5 - unitAtFull) * (1 - p);
  const earth = PLANETS.find((pl) => pl.id === 'earth')!;
  const ea = planetAngle(earth, t);
  const earthX = Math.cos(ea) * unit;
  const earthY = Math.sin(ea) * unit * ORBIT_TILT;
  // Сонце в системі «Земля в центрі» — у (−earthX, −earthY); зсуваємо світ на p × (earth)
  const worldX = earthX * p;
  const worldY = earthY * p;
  const sunX = worldX - earthX;
  const sunY = worldY - earthY;
  const bodySize = (size: number) => size * halfMin * (0.4 + 0.6 * p);

  const bodies: SpaceBody[] = [{ id: 'sun', x: sunX, y: sunY, r: bodySize(SUN_SIZE) }];
  for (const planet of PLANETS) {
    if (planet.id === 'earth') continue;
    const a = planetAngle(planet, t);
    bodies.push({
      id: planet.id,
      x: sunX + Math.cos(a) * planet.orbit * unit,
      y: sunY + Math.sin(a) * planet.orbit * unit * ORBIT_TILT,
      r: bodySize(planet.size),
    });
  }
  return {
    worldX,
    worldY,
    globeScale: 1 - (1 - GLOBE_MIN_SCALE) * p,
    sunX,
    sunY,
    orbits: PLANETS.map((pl) => pl.orbit * unit),
    bodies,
  };
}

export type LabelBox = { x: number; y: number; w: number; h: number };

/** Чи перетинаються два прямокутники підписів (з невеликим відступом). */
export function overlaps(a: LabelBox, b: LabelBox, gap = 2): boolean {
  return (
    a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h
  );
}

/** Порядок підписів: важливіші ставимо першими, решта — лише якщо не налазять. */
export const LABEL_PRIORITY: readonly (PlanetId | 'sun')[] = [
  'sun',
  'earth',
  'jupiter',
  'saturn',
  'mars',
  'venus',
  'neptune',
  'uranus',
  'mercury',
];
