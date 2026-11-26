import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { AppDatabase, DbContext } from '../context.ts';
import { expenses, places, tripCountries, trips, type Place, type Trip } from '../schema.ts';
import { assertDateRange, assertIso2, DbValidationError } from '../validate.ts';
import { getSetting, setSetting } from './settings.ts';
import { addVisit } from './visits.ts';

const active = isNull(trips.deletedAt);

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

// ---------- поїздки ----------

export type TripInput = {
  title: string;
  /** Дати поїздки можуть бути в майбутньому (на відміну від візитів) */
  startDate?: string | null;
  endDate?: string | null;
  /** Бюджет у мінімальних одиницях `currency` */
  budget?: number | null;
  currency?: string | null;
  notes?: string | null;
  /** ISO2 країн поїздки (у списку — в порядку додавання, в межах одного збереження — за кодом) */
  countries: readonly string[];
};

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateTrip(input: TripInput): void {
  if (!input.title.trim()) throw new DbValidationError('Назва поїздки порожня');
  assertDateRange(input.startDate, input.endDate);
  if (input.budget != null) {
    if (!Number.isSafeInteger(input.budget) || input.budget < 0) {
      throw new DbValidationError(`Бюджет — невід'ємне ціле, отримано ${input.budget}`);
    }
    if (!input.currency || !/^[A-Z]{3}$/.test(input.currency)) {
      throw new DbValidationError('Для бюджету потрібна валюта (ISO 4217)');
    }
  }
  for (const iso of input.countries) assertIso2(iso);
}

function tripFields(input: TripInput) {
  return {
    title: input.title.trim(),
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    budget: input.budget ?? null,
    currency: input.currency ?? null,
    notes: cleanText(input.notes),
  };
}

export async function addTrip(ctx: DbContext, input: TripInput): Promise<Trip> {
  validateTrip(input);
  const ts = ctx.now();
  const row: Trip = {
    id: ctx.newId(),
    ...tripFields(input),
    status: 'planned',
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  await ctx.db.insert(trips).values(row);
  await setTripCountries(ctx, row.id, input.countries);
  return row;
}

export async function updateTrip(ctx: DbContext, id: string, input: TripInput): Promise<void> {
  validateTrip(input);
  await ctx.db
    .update(trips)
    .set({ ...tripFields(input), updatedAt: ctx.now() })
    .where(and(eq(trips.id, id), active));
  await setTripCountries(ctx, id, input.countries);
}

/**
 * Країни поїздки — рівно ці. Прибрані — м'яко видаляються; додані знову — відновлюються
 * (складений первинний ключ trip_id + country_iso не дає вставити рядок удруге).
 */
export async function setTripCountries(
  ctx: DbContext,
  tripId: string,
  countries: readonly string[],
): Promise<void> {
  const ts = ctx.now();
  const wanted = [...new Set(countries)];
  for (const iso of wanted) assertIso2(iso);
  const existing = await ctx.db
    .select({ countryIso: tripCountries.countryIso, deletedAt: tripCountries.deletedAt })
    .from(tripCountries)
    .where(eq(tripCountries.tripId, tripId));
  const have = new Map(existing.map((r) => [r.countryIso, r.deletedAt]));
  for (const [iso, deletedAt] of have) {
    if (!wanted.includes(iso) && deletedAt === null) {
      await ctx.db
        .update(tripCountries)
        .set({ deletedAt: ts, updatedAt: ts })
        .where(and(eq(tripCountries.tripId, tripId), eq(tripCountries.countryIso, iso)));
    }
  }
  for (const iso of wanted) {
    if (!have.has(iso)) {
      await ctx.db
        .insert(tripCountries)
        .values({ tripId, countryIso: iso, createdAt: ts, updatedAt: ts, deletedAt: null });
    } else if (have.get(iso) !== null) {
      await ctx.db
        .update(tripCountries)
        .set({ deletedAt: null, updatedAt: ts })
        .where(and(eq(tripCountries.tripId, tripId), eq(tripCountries.countryIso, iso)));
    }
  }
}

export async function removeTrip(ctx: DbContext, id: string): Promise<void> {
  const ts = ctx.now();
  await ctx.db
    .update(trips)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(trips.id, id), active));
}

export async function restoreTrip(ctx: DbContext, id: string): Promise<void> {
  await ctx.db.update(trips).set({ deletedAt: null, updatedAt: ctx.now() }).where(eq(trips.id, id));
}

/** Усі поїздки (без видалених): з датою — за датою початку, без дати — у кінці. */
export function tripsQuery(db: AppDatabase) {
  return db
    .select()
    .from(trips)
    .where(active)
    .orderBy(sql`${trips.startDate} IS NULL`, asc(trips.startDate), desc(trips.createdAt));
}

/** Пари поїздка — країна (активні) — для useLiveQuery; групує tripCountriesById. */
export function tripCountriesQuery(db: AppDatabase) {
  return db
    .select({ tripId: tripCountries.tripId, countryIso: tripCountries.countryIso })
    .from(tripCountries)
    .where(isNull(tripCountries.deletedAt))
    .orderBy(asc(tripCountries.createdAt), asc(tripCountries.countryIso));
}

export function tripQuery(db: AppDatabase, id: string) {
  return db
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), active));
}

export type TripWithCountries = Trip & { countries: string[] };

export async function getTrip(ctx: DbContext, id: string): Promise<TripWithCountries | null> {
  const [trip] = await tripQuery(ctx.db, id);
  if (!trip) return null;
  const rows = await ctx.db
    .select({ countryIso: tripCountries.countryIso })
    .from(tripCountries)
    .where(and(eq(tripCountries.tripId, id), isNull(tripCountries.deletedAt)))
    .orderBy(asc(tripCountries.createdAt), asc(tripCountries.countryIso));
  return { ...trip, countries: rows.map((r) => r.countryIso) };
}

// ---------- «хочу відвідати» ----------

export type WishlistInput = {
  tripId: string;
  countryIso: string;
  title: string;
  lat?: number | null;
  lng?: number | null;
  /** QID місця з пропозицій — те саме місце в поїздку двічі не додається */
  wikidataId?: string | null;
};

/** Місце «хочу відвідати» в поїздці. Повторне додавання тієї ж пропозиції повертає наявне. */
export async function addWishlistPlace(ctx: DbContext, input: WishlistInput): Promise<Place> {
  assertIso2(input.countryIso);
  const title = input.title.trim();
  if (!title) throw new DbValidationError('Назва місця порожня');
  if (input.wikidataId) {
    const [existing] = await ctx.db
      .select()
      .from(places)
      .where(
        and(
          eq(places.tripId, input.tripId),
          eq(places.wikidataId, input.wikidataId),
          isNull(places.deletedAt),
        ),
      );
    if (existing) return existing;
  }
  const ts = ctx.now();
  const row: Place = {
    id: ctx.newId(),
    countryIso: input.countryIso,
    tripId: input.tripId,
    title,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    note: null,
    isWishlist: true,
    visitedAt: null,
    wikidataId: input.wikidataId ?? null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  await ctx.db.insert(places).values(row);
  return row;
}

/**
 * Після поїздки: місце «хочу відвідати» → відвідане. Воно стає звичайною точкою (з координатами
 * — на карті) з датою відвідання.
 */
export async function markWishlistVisited(
  ctx: DbContext,
  placeId: string,
  visitedAt: string,
): Promise<void> {
  assertDateRange(visitedAt, null);
  await ctx.db
    .update(places)
    .set({ isWishlist: false, visitedAt, updatedAt: ctx.now() })
    .where(and(eq(places.id, placeId), isNull(places.deletedAt)));
}

/** Повернути відвідане місце поїздки в «хочу відвідати» (помилкова позначка). */
export async function unmarkWishlistVisited(ctx: DbContext, placeId: string): Promise<void> {
  await ctx.db
    .update(places)
    .set({ isWishlist: true, visitedAt: null, updatedAt: ctx.now() })
    .where(and(eq(places.id, placeId), isNull(places.deletedAt)));
}

/** Місця поїздки: «хочу відвідати» й уже відвідані. Для useLiveQuery. */
export function tripPlacesQuery(db: AppDatabase, tripId: string) {
  return db
    .select()
    .from(places)
    .where(and(eq(places.tripId, tripId), isNull(places.deletedAt)))
    .orderBy(asc(places.createdAt), asc(places.id));
}

/** Витрати поїздки (усі країни). Для useLiveQuery. */
export function tripExpensesQuery(db: AppDatabase, tripId: string) {
  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.tripId, tripId), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
}

/** Активні поїздки, що включають країну — для вибору поїздки у формі витрати. */
export function tripsWithCountryQuery(db: AppDatabase, countryIso: string) {
  return db
    .select({ id: trips.id, title: trips.title, startDate: trips.startDate })
    .from(trips)
    .innerJoin(tripCountries, eq(tripCountries.tripId, trips.id))
    .where(and(active, isNull(tripCountries.deletedAt), eq(tripCountries.countryIso, countryIso)))
    .orderBy(desc(trips.startDate));
}

// ---------- питання після поїздки ----------

/** Дата, після якої поїздка вважається завершеною: кінець, а без нього — початок. */
export function tripLastDay(trip: Pick<Trip, 'startDate' | 'endDate'>): string | null {
  return trip.endDate ?? trip.startDate;
}

/** Заплановані поїздки, що вже закінчилися (останній день < today) — чекають відповіді. */
export function tripsAwaitingAnswer<T extends Pick<Trip, 'status' | 'startDate' | 'endDate'>>(
  list: readonly T[],
  today: string,
): T[] {
  return list.filter((t) => {
    const last = tripLastDay(t);
    return t.status === 'planned' && last !== null && last < today;
  });
}

/**
 * Які з них показати попапом зараз: без «Пізніше» або вже настав день, до якого відклали.
 * Решта видно лише в «Скриньці».
 */
export function tripsForPopup<T extends { id: string }>(
  awaiting: readonly T[],
  snooze: Readonly<Record<string, string>>,
  today: string,
): T[] {
  return awaiting.filter((t) => !snooze[t.id] || snooze[t.id] <= today);
}

/** Наступний день після 'YYYY-MM-DD'. */
export function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/** «Пізніше»: попап для цієї поїздки — не раніше наступного дня (у «Скриньці» видно й далі). */
export async function snoozeTripQuestion(
  ctx: DbContext,
  tripId: string,
  today: string,
): Promise<void> {
  const current = (await getSetting(ctx, 'tripQuestionSnooze')) ?? {};
  await setSetting(ctx, 'tripQuestionSnooze', { ...current, [tripId]: nextDay(today) });
}

async function clearSnooze(ctx: DbContext, tripId: string): Promise<void> {
  const current = await getSetting(ctx, 'tripQuestionSnooze');
  if (!current || !(tripId in current)) return;
  const next = { ...current };
  delete next[tripId];
  await setSetting(ctx, 'tripQuestionSnooze', next);
}

/**
 * «Так, був»: у вибрані країни поїздки додаються візити з датами поїздки (візит без дат
 * заповнюється — див. addVisit). Невибрані країни візиту не отримують. Поїздка — завершена.
 */
export async function confirmTripVisited(
  ctx: DbContext,
  tripId: string,
  countries: readonly string[],
): Promise<void> {
  const trip = await getTrip(ctx, tripId);
  if (!trip) return;
  const chosen = countries.filter((iso) => trip.countries.includes(iso));
  for (const countryIso of chosen) {
    await addVisit(ctx, {
      countryIso,
      startDate: trip.startDate,
      endDate: trip.endDate,
    });
  }
  await setTripStatus(ctx, tripId, 'done');
  await clearSnooze(ctx, tripId);
}

/** «Ні»: поїздки не було — візитів не додаємо, поїздка «не відбулась», питання закриваємо. */
export async function declineTrip(ctx: DbContext, tripId: string): Promise<void> {
  await setTripStatus(ctx, tripId, 'cancelled');
  await clearSnooze(ctx, tripId);
}

/**
 * Передумали після «Не вийшло»: питання після поїздки з'являється знову. Лише для
 * скасованих — у відбутої вже є візити, повторне «Так» їх задублювало б.
 */
export async function reopenTripQuestion(ctx: DbContext, tripId: string): Promise<void> {
  await ctx.db
    .update(trips)
    .set({ status: 'planned', updatedAt: ctx.now() })
    .where(and(eq(trips.id, tripId), eq(trips.status, 'cancelled'), active));
}

async function setTripStatus(ctx: DbContext, id: string, status: Trip['status']): Promise<void> {
  await ctx.db
    .update(trips)
    .set({ status, updatedAt: ctx.now() })
    .where(and(eq(trips.id, id), active));
}

/** Рядки tripCountriesQuery → id поїздки → країни. */
export function groupTripCountries(
  rows: readonly { tripId: string; countryIso: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.tripId, [...(map.get(r.tripId) ?? []), r.countryIso]);
  return map;
}

/** Для тестів і екранів: країни кількох поїздок одним запитом. */
export async function getTripCountries(
  ctx: DbContext,
  tripIds: readonly string[],
): Promise<Map<string, string[]>> {
  if (tripIds.length === 0) return new Map();
  const rows = await ctx.db
    .select({ tripId: tripCountries.tripId, countryIso: tripCountries.countryIso })
    .from(tripCountries)
    .where(and(inArray(tripCountries.tripId, [...tripIds]), isNull(tripCountries.deletedAt)))
    .orderBy(asc(tripCountries.createdAt), asc(tripCountries.countryIso));
  return groupTripCountries(rows);
}
