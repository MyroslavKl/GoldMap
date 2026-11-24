import { and, eq, isNull } from 'drizzle-orm';

import type { AppDatabase, DbContext } from '../context.ts';
import { tripCountries, trips } from '../schema.ts';

/**
 * ISO-коди країн, що входять у заплановані поїздки (status = planned, не видалені).
 * Для useLiveQuery у компонентах.
 */
export function plannedIsosQuery(db: AppDatabase) {
  return db
    .selectDistinct({ countryIso: tripCountries.countryIso })
    .from(tripCountries)
    .innerJoin(trips, eq(trips.id, tripCountries.tripId))
    .where(
      and(eq(trips.status, 'planned'), isNull(trips.deletedAt), isNull(tripCountries.deletedAt)),
    );
}

export async function getPlannedCountryIsos(ctx: DbContext): Promise<string[]> {
  const rows = await plannedIsosQuery(ctx.db);
  return rows.map((r) => r.countryIso).sort();
}
