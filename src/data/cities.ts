import rawCities from './cities.json';
import type { City } from './types';

/** Міста Natural Earth (згенеровані; країну визначає наш полігон). Для назв точок офлайн. */
export const CITIES = rawCities as City[];
