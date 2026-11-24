/**
 * Тестова база: SQLite у пам'яті (вбудований node:sqlite) + Drizzle sqlite-proxy.
 * Застосовує ті самі міграції, що й додаток (src/db/migrations), у порядку журналу.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/sqlite-proxy';

import type { AppDatabase, DbContext } from '../../src/db/context.ts';
import * as schema from '../../src/db/schema.ts';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '../../src/db/migrations');

function applyMigrations(sqlite: DatabaseSync): void {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS, 'meta/_journal.json'), 'utf8')) as {
    entries: { idx: number; tag: string }[];
  };
  for (const { tag } of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    const file = readFileSync(join(MIGRATIONS, `${tag}.sql`), 'utf8');
    for (const statement of file.split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
}

export type TestDb = DbContext & {
  sqlite: DatabaseSync;
  /** Зсунути тестовий годинник на `ms` мілісекунд */
  tick: (ms?: number) => void;
};

export function createTestDb(): TestDb {
  const sqlite = new DatabaseSync(':memory:');
  applyMigrations(sqlite);

  const db = drizzle(
    async (query, params, method) => {
      const stmt = sqlite.prepare(query);
      const args = params as SQLInputValue[];
      if (method === 'run') {
        stmt.run(...args);
        return { rows: [] };
      }
      stmt.setReturnArrays(true);
      if (method === 'get') return { rows: (stmt.get(...args) as unknown[] | undefined) ?? [] };
      return { rows: stmt.all(...args) as unknown[] };
    },
    { schema },
  ) as unknown as AppDatabase;

  let clock = Date.UTC(2026, 0, 1, 12, 0, 0);
  let seq = 0;

  return {
    db,
    sqlite,
    newId: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
    now: () => new Date(clock).toISOString(),
    tick: (ms = 1000) => {
      clock += ms;
    },
  };
}
