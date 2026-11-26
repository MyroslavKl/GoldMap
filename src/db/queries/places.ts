import { and, asc, eq, inArray, isNotNull, isNull, notInArray } from 'drizzle-orm';

import type { AppDatabase, DbContext } from '../context.ts';
import { photos, places, type Place } from '../schema.ts';
import { assertDate, assertIso2, DbValidationError } from '../validate.ts';

const active = isNull(places.deletedAt);

export type NewPlace = {
  /** id можна задати наперед */
  id?: string;
  countryIso: string;
  title: string;
  note?: string | null;
  lat: number;
  lng: number;
  /** 'YYYY-MM-DD' — коли там були (напр. дата фото) */
  visitedAt?: string | null;
  /** QID Wikidata (місце з пропозицій) */
  wikidataId?: string | null;
};

function cleanTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new DbValidationError('Назва точки порожня');
  return trimmed;
}

function cleanNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

function assertCoords(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new DbValidationError(`Координати поза межами: ${lat}, ${lng}`);
  }
}

/** Точка на карті (не «хочу відвідати» — ті з'являться в поїздках). */
export async function addPlace(ctx: DbContext, input: NewPlace): Promise<Place> {
  assertIso2(input.countryIso);
  assertCoords(input.lat, input.lng);
  if (input.visitedAt) assertDate(input.visitedAt, 'visitedAt');
  const ts = ctx.now();
  const row: Place = {
    id: input.id ?? ctx.newId(),
    countryIso: input.countryIso,
    tripId: null,
    title: cleanTitle(input.title),
    lat: input.lat,
    lng: input.lng,
    note: cleanNote(input.note),
    isWishlist: false,
    visitedAt: input.visitedAt ?? null,
    wikidataId: input.wikidataId ?? null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  await ctx.db.insert(places).values(row);
  return row;
}

export async function updatePlace(
  ctx: DbContext,
  id: string,
  input: { title: string; note?: string | null },
): Promise<void> {
  await ctx.db
    .update(places)
    .set({ title: cleanTitle(input.title), note: cleanNote(input.note), updatedAt: ctx.now() })
    .where(and(eq(places.id, id), active));
}

/** М'яке видалення точки. Фото лишаються в країні (прив'язка повернеться з «Скасувати»). */
export async function removePlace(ctx: DbContext, id: string): Promise<void> {
  const ts = ctx.now();
  await ctx.db
    .update(places)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(places.id, id), active));
}

export async function restorePlace(ctx: DbContext, id: string): Promise<void> {
  await ctx.db
    .update(places)
    .set({ deletedAt: null, updatedAt: ctx.now() })
    .where(eq(places.id, id));
}

/**
 * Прив'язати до точки рівно ці фото: інші фото точки відв'язуються (лишаються в країні),
 * вибрані — прив'язуються (навіть якщо були в іншій точці).
 */
export async function setPlacePhotos(
  ctx: DbContext,
  placeId: string,
  photoIds: readonly string[],
): Promise<void> {
  const ts = ctx.now();
  const ids = [...photoIds];
  await ctx.db
    .update(photos)
    .set({ placeId: null, updatedAt: ts })
    .where(
      ids.length
        ? and(eq(photos.placeId, placeId), notInArray(photos.id, ids))
        : eq(photos.placeId, placeId),
    );
  if (ids.length) {
    await ctx.db
      .update(photos)
      .set({ placeId, updatedAt: ts })
      .where(and(inArray(photos.id, ids), isNull(photos.deletedAt)));
  }
}

/**
 * Точка з групи фото з GPS. Якщо фото зняті в іншій країні, ніж та, куди їх додали, — вони
 * переносяться в країну точки (фото й точка завжди в одній країні).
 */
export async function createPlaceFromPhotos(
  ctx: DbContext,
  input: NewPlace & { photoIds: readonly string[] },
): Promise<Place> {
  if (input.photoIds.length === 0) throw new DbValidationError('Група фото порожня');
  const place = await addPlace(ctx, input);
  await ctx.db
    .update(photos)
    .set({ placeId: place.id, countryIso: place.countryIso, updatedAt: ctx.now() })
    .where(and(inArray(photos.id, [...input.photoIds]), isNull(photos.deletedAt)));
  return place;
}

/** Точки країни, у порядку створення. Для useLiveQuery. */
export function placesByCountryQuery(db: AppDatabase, countryIso: string) {
  return db
    .select()
    .from(places)
    .where(and(eq(places.countryIso, countryIso), active, eq(places.isWishlist, false)))
    .orderBy(asc(places.createdAt), asc(places.id));
}

export async function getPlacesByCountry(ctx: DbContext, countryIso: string): Promise<Place[]> {
  return placesByCountryQuery(ctx.db, countryIso);
}

/** Усі точки з координатами — для глобуса. Для useLiveQuery. */
export function mapPlacesQuery(db: AppDatabase) {
  return db
    .select({
      id: places.id,
      countryIso: places.countryIso,
      title: places.title,
      lat: places.lat,
      lng: places.lng,
    })
    .from(places)
    .where(and(active, eq(places.isWishlist, false), isNotNull(places.lat), isNotNull(places.lng)));
}

/** Активні фото, прив'язані до точок, — мініатюри на глобусі. Для useLiveQuery. */
export function placedPhotosQuery(db: AppDatabase) {
  return db
    .select({
      id: photos.id,
      placeId: photos.placeId,
      thumbUri: photos.thumbUri,
      takenAt: photos.takenAt,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .where(and(isNotNull(photos.placeId), isNull(photos.deletedAt)));
}

/** Одна точка за id (порожньо, якщо видалена). Для useLiveQuery. */
export function placeQuery(db: AppDatabase, id: string) {
  return db
    .select()
    .from(places)
    .where(and(eq(places.id, id), active));
}

export async function getPlace(ctx: DbContext, id: string): Promise<Place | null> {
  const [row] = await placeQuery(ctx.db, id);
  return row ?? null;
}
