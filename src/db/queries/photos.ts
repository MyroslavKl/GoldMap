import { and, asc, desc, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';

import type { AppDatabase, DbContext } from '../context.ts';
import { photos, type Photo } from '../schema.ts';
import { assertIso2, DbValidationError } from '../validate.ts';

const active = isNull(photos.deletedAt);

/** Відносний шлях у documentDirectory: лише photos/<ім'я>.jpg, без «..» і абсолютних URI. */
const PHOTO_PATH = /^photos\/[A-Za-z0-9_-]+\.jpg$/;

export type NewPhoto = {
  /** id можна задати наперед: під нього вже названо файли photos/<id>.jpg */
  id?: string;
  countryIso: string;
  placeId?: string | null;
  fileUri: string;
  thumbUri: string;
  width: number;
  height: number;
  /** Дата зйомки з EXIF: 'YYYY-MM-DDTHH:mm:ss' (місцевий час кадру) */
  takenAt?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function assertPhoto(input: NewPhoto): void {
  assertIso2(input.countryIso);
  for (const path of [input.fileUri, input.thumbUri]) {
    if (!PHOTO_PATH.test(path)) {
      throw new DbValidationError(`Шлях фото має бути відносним photos/….jpg: «${path}»`);
    }
  }
  if (!(input.width > 0 && input.height > 0)) {
    throw new DbValidationError(`Некоректний розмір фото: ${input.width}×${input.height}`);
  }
  const { lat, lng } = input;
  if ((lat == null) !== (lng == null)) {
    throw new DbValidationError('Координати фото: потрібні обидві або жодної');
  }
  if (lat != null && lng != null && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
    throw new DbValidationError(`Координати поза межами: ${lat}, ${lng}`);
  }
}

/** Зберегти фото, файли якого вже скопійовано в documentDirectory/photos. */
export async function addPhoto(ctx: DbContext, input: NewPhoto): Promise<Photo> {
  assertPhoto(input);
  const ts = ctx.now();
  const row: Photo = {
    id: input.id ?? ctx.newId(),
    countryIso: input.countryIso,
    placeId: input.placeId ?? null,
    fileUri: input.fileUri,
    thumbUri: input.thumbUri,
    width: Math.round(input.width),
    height: Math.round(input.height),
    takenAt: input.takenAt ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  await ctx.db.insert(photos).values(row);
  return row;
}

/**
 * Фото країни для сітки: за датою зйомки (старіші першими), без дати — в кінці
 * в порядку додавання. Для useLiveQuery.
 */
export function photosByCountryQuery(db: AppDatabase, countryIso: string) {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.countryIso, countryIso), active))
    .orderBy(sql`${photos.takenAt} IS NULL`, asc(photos.takenAt), asc(photos.createdAt));
}

export async function getPhotosByCountry(ctx: DbContext, countryIso: string): Promise<Photo[]> {
  return photosByCountryQuery(ctx.db, countryIso);
}

/** М'яке видалення: файли лишаються, доки не мине час на «Скасувати». */
export async function removePhoto(ctx: DbContext, id: string): Promise<void> {
  const ts = ctx.now();
  await ctx.db
    .update(photos)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(photos.id, id), active));
}

export async function restorePhoto(ctx: DbContext, id: string): Promise<void> {
  await ctx.db
    .update(photos)
    .set({ deletedAt: null, updatedAt: ctx.now() })
    .where(eq(photos.id, id));
}

/**
 * Видалені фото, чиї файли вже можна стерти з диска: видалені раніше за `before` (ISO).
 * Рядки в базі лишаються (м'яке видалення під синхронізацію), зникають лише файли.
 */
export async function getPhotosForFileCleanup(
  ctx: DbContext,
  before: string,
): Promise<Pick<Photo, 'id' | 'fileUri' | 'thumbUri'>[]> {
  return ctx.db
    .select({ id: photos.id, fileUri: photos.fileUri, thumbUri: photos.thumbUri })
    .from(photos)
    .where(and(isNotNull(photos.deletedAt), lt(photos.deletedAt, before)))
    .orderBy(desc(photos.deletedAt));
}
