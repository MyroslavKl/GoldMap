import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema.ts';

/**
 * База Drizzle з нашою схемою. У додатку — expo-sqlite (sync), у тестах — node:sqlite через
 * sqlite-proxy (async). Запити пишемо через `await`, тож вони працюють з обома.
 */
export type AppDatabase = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;

/** Усе, що потрібно функціям-запитам. Годинник і генератор id — ін'єкції для тестів. */
export type DbContext = {
  db: AppDatabase;
  newId: () => string;
  /** Поточна мітка часу, ISO 8601 UTC */
  now: () => string;
};
