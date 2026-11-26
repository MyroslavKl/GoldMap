import { and, asc, count, desc, eq, isNull, max, min, sql } from 'drizzle-orm';

import type { AppDatabase, DbContext } from '../context.ts';
import { visits, type Visit } from '../schema.ts';
import { assertDateRange, assertIso2 } from '../validate.ts';

const active = isNull(visits.deletedAt);

export type NewVisit = {
  countryIso: string;
  startDate?: string | null;
  endDate?: string | null;
};

/**
 * Додати візит (період перебування). Кілька візитів на країну — нормально.
 *
 * Якщо в країни є візит без дат (його створює кнопка «Був тут» чи галочка у списку), то
 * перший візит з датами заповнює той запис, а не створює другий: людина просто уточнює,
 * коли саме була. Повертає збережений рядок (новий або заповнений).
 */
export async function addVisit(ctx: DbContext, input: NewVisit): Promise<Visit> {
  assertIso2(input.countryIso);
  assertDateRange(input.startDate, input.endDate);
  const startDate = input.startDate ?? null;
  const endDate = input.endDate ?? null;
  const ts = ctx.now();

  if (startDate || endDate) {
    const [undated] = await ctx.db
      .select()
      .from(visits)
      .where(
        and(
          eq(visits.countryIso, input.countryIso),
          active,
          isNull(visits.startDate),
          isNull(visits.endDate),
        ),
      )
      .orderBy(asc(visits.createdAt))
      .limit(1);
    if (undated) {
      await ctx.db
        .update(visits)
        .set({ startDate, endDate, updatedAt: ts })
        .where(eq(visits.id, undated.id));
      return { ...undated, startDate, endDate, updatedAt: ts };
    }
  }

  const row: Visit = {
    id: ctx.newId(),
    countryIso: input.countryIso,
    startDate,
    endDate,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  await ctx.db.insert(visits).values(row);
  return row;
}

/** Змінити дати візиту. */
export async function updateVisitDates(
  ctx: DbContext,
  id: string,
  dates: { startDate: string | null; endDate: string | null },
): Promise<void> {
  assertDateRange(dates.startDate, dates.endDate);
  await ctx.db
    .update(visits)
    .set({ ...dates, updatedAt: ctx.now() })
    .where(and(eq(visits.id, id), active));
}

/** М'яко видалити візит. */
export async function removeVisit(ctx: DbContext, id: string): Promise<void> {
  const ts = ctx.now();
  await ctx.db
    .update(visits)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(visits.id, id), active));
}

/** Скасувати видалення візиту («Скасувати» у сповіщенні). */
export async function restoreVisit(ctx: DbContext, id: string): Promise<void> {
  await ctx.db
    .update(visits)
    .set({ deletedAt: null, updatedAt: ctx.now() })
    .where(eq(visits.id, id));
}

/** Візити однієї країни: найновіші зверху, без дат — у кінці. Для useLiveQuery. */
export function visitsByCountryQuery(db: AppDatabase, countryIso: string) {
  return db
    .select()
    .from(visits)
    .where(and(eq(visits.countryIso, countryIso), active))
    .orderBy(sql`${visits.startDate} IS NULL`, desc(visits.startDate), asc(visits.createdAt));
}

/** Візити країни: найновіші зверху, без дат — у кінці. */
export async function getVisitsByCountry(ctx: DbContext, countryIso: string): Promise<Visit[]> {
  return visitsByCountryQuery(ctx.db, countryIso);
}

export type VisitedCountry = {
  countryIso: string;
  visitCount: number;
  /** Найраніша відома дата початку, або null, якщо дат немає */
  firstDate: string | null;
  /** Найпізніша відома дата початку */
  lastDate: string | null;
};

/** Список відвіданих країн (є хоч один активний візит), за абеткою ISO. */
export async function getVisitedCountries(ctx: DbContext): Promise<VisitedCountry[]> {
  return ctx.db
    .select({
      countryIso: visits.countryIso,
      visitCount: count(),
      firstDate: min(visits.startDate),
      lastDate: max(visits.startDate),
    })
    .from(visits)
    .where(active)
    .groupBy(visits.countryIso)
    .orderBy(asc(visits.countryIso));
}

/**
 * Усі активні візити (країна + дата початку) — для useLiveQuery: з них будуються
 * множина відвіданих, кількість візитів і дати в списку країн.
 */
export function activeVisitDatesQuery(db: AppDatabase) {
  return db
    .select({ countryIso: visits.countryIso, startDate: visits.startDate })
    .from(visits)
    .where(active);
}

/** Запит ISO-кодів відвіданих країн — для useLiveQuery у компонентах. */
export function visitedIsosQuery(db: AppDatabase) {
  return db.selectDistinct({ countryIso: visits.countryIso }).from(visits).where(active);
}

export async function isCountryVisited(ctx: DbContext, countryIso: string): Promise<boolean> {
  const [row] = await ctx.db
    .select({ n: count() })
    .from(visits)
    .where(and(eq(visits.countryIso, countryIso), active));
  return (row?.n ?? 0) > 0;
}

/**
 * Швидка позначка «був / не був» (галочка у списку, кнопка «Був тут»).
 * true — додає візит без дат, якщо країна ще не відвідана.
 * false — м'яко видаляє всі візити країни.
 */
export async function setCountryVisited(
  ctx: DbContext,
  countryIso: string,
  visited: boolean,
): Promise<void> {
  assertIso2(countryIso);
  if (visited) {
    if (!(await isCountryVisited(ctx, countryIso))) await addVisit(ctx, { countryIso });
    return;
  }
  const ts = ctx.now();
  await ctx.db
    .update(visits)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(visits.countryIso, countryIso), active));
}

export type Counter = { visited: number; total: number };

/**
 * Лічильник «N / total»: скільки відвіданих країн входить у `countable`
 * (193 члени ООН або розширений список — див. src/data/countries.ts).
 * Відвідані території поза списком у лічильник не йдуть.
 */
export function computeCounter(
  visitedIsos: Iterable<string>,
  countable: ReadonlySet<string>,
): Counter {
  let visited = 0;
  for (const iso of new Set(visitedIsos)) if (countable.has(iso)) visited++;
  return { visited, total: countable.size };
}

export async function getVisitedCounter(
  ctx: DbContext,
  countable: ReadonlySet<string>,
): Promise<Counter> {
  const rows = await visitedIsosQuery(ctx.db);
  return computeCounter(
    rows.map((r) => r.countryIso),
    countable,
  );
}
