import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

/** Внутрішня конфігурація select-запиту Drizzle (поле не входить у публічні типи). */
type SelectConfig = { config?: { table?: unknown; joins?: readonly { table: unknown }[] } };

/**
 * Як `useLiveQuery` з drizzle-orm/expo-sqlite, але перезапитує й при змінах **приєднаних**
 * таблиць (join). Drizzle слухає лише головну таблицю: напр. видалення поїздки (`trips`) не
 * оновлювало запит від `trip_countries` — країна на глобусі лишалась «запланованою».
 */
export function useLiveJoinQuery<T>(query: PromiseLike<T[]>, deps: readonly unknown[] = []): T[] {
  const [data, setData] = useState<T[]>([]);
  useEffect(() => {
    let alive = true;
    const run = () => {
      query.then(
        (rows) => {
          if (alive) setData(rows);
        },
        (error: unknown) => console.warn('[live query]', error),
      );
    };
    const names = new Set<string>();
    const config = (query as SelectConfig).config;
    for (const table of [config?.table, ...(config?.joins ?? []).map((j) => j.table)]) {
      if (is(table, SQLiteTable)) names.add(getTableConfig(table).name);
    }
    run();
    const listener = addDatabaseChangeListener(({ tableName }) => {
      if (names.has(tableName)) run();
    });
    return () => {
      alive = false;
      listener.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- як у drizzle: перезапуск за deps
  }, deps);
  return data;
}
