import { and, count, eq, isNotNull, isNull, or } from 'drizzle-orm';

import type { DbContext } from '../context.ts';
import { expenses, notes, photos, places, visits } from '../schema.ts';

/** Що користувач уже зберіг про країну — щоб не зняти позначку «був» випадково. */
export type CountryContentSummary = {
  /** Активні візити з хоча б однією датою */
  datedVisits: number;
  photos: number;
  notes: number;
  expenses: number;
  places: number;
};

export async function getCountryContentSummary(
  ctx: DbContext,
  countryIso: string,
): Promise<CountryContentSummary> {
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [datedVisits, photoCount, noteCount, expenseCount, placeCount] = await Promise.all([
    n(
      ctx.db
        .select({ n: count() })
        .from(visits)
        .where(
          and(
            eq(visits.countryIso, countryIso),
            isNull(visits.deletedAt),
            or(isNotNull(visits.startDate), isNotNull(visits.endDate)),
          ),
        ),
    ),
    n(
      ctx.db
        .select({ n: count() })
        .from(photos)
        .where(and(eq(photos.countryIso, countryIso), isNull(photos.deletedAt))),
    ),
    n(
      ctx.db
        .select({ n: count() })
        .from(notes)
        .where(and(eq(notes.countryIso, countryIso), isNull(notes.deletedAt))),
    ),
    n(
      ctx.db
        .select({ n: count() })
        .from(expenses)
        .where(and(eq(expenses.countryIso, countryIso), isNull(expenses.deletedAt))),
    ),
    n(
      ctx.db
        .select({ n: count() })
        .from(places)
        .where(and(eq(places.countryIso, countryIso), isNull(places.deletedAt))),
    ),
  ]);
  return {
    datedVisits,
    photos: photoCount,
    notes: noteCount,
    expenses: expenseCount,
    places: placeCount,
  };
}

/**
 * Чи питати підтвердження перед зняттям позначки «був».
 * Зняття видаляє лише візити (разом із датами); фото, точки, нотатки й витрати лишаються.
 */
export function needsUnmarkConfirmation(summary: CountryContentSummary): boolean {
  return (
    summary.datedVisits + summary.photos + summary.notes + summary.expenses + summary.places > 0
  );
}
