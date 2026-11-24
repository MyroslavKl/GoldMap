/**
 * База додатку: файл goldmap.db на телефоні (expo-sqlite) + Drizzle.
 * Лише для коду додатку; тести використовують tests/helpers/test-db.ts.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';

import type { DbContext } from './context.ts';
import * as schema from './schema.ts';

const sqlite = openDatabaseSync('goldmap.db', { enableChangeListener: true });

/** Drizzle-клієнт expo-sqlite (для useLiveQuery і міграцій). */
export const expoDb = drizzle(sqlite, { schema });

/** Контекст для функцій-запитів із src/db. */
export const dbContext: DbContext = {
  db: expoDb,
  newId: randomUUID,
  now: () => new Date().toISOString(),
};
