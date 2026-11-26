/**
 * Фото країни: вибір із галереї, стиснення, копія в папку додатку, мініатюра, EXIF.
 *
 * Файли копіюються в documentDirectory/photos — не посилання на галерею: якщо людина
 * видалить фото з галереї, у Goldmap воно лишається. У базі — лише відносні шляхи
 * (photos/<id>.jpg), бо абсолютний шлях до папки додатку на iOS змінюється між оновленнями.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { addPhoto, getPhotosForFileCleanup, type Photo } from '@/db';
import { dbContext } from '@/db/client';
import { parsePhotoMeta } from '@/lib/exif';

/** Довша сторона збереженого фото, px */
export const PHOTO_MAX_EDGE = 2000;
/** Довша сторона мініатюри для сітки, px */
export const THUMB_MAX_EDGE = 400;
/** Скільки фото можна вибрати за раз */
export const PICK_LIMIT = 30;
/** Через скільки після видалення стираються файли, якщо додаток закрили до кінця «Скасувати» */
const CLEANUP_AFTER_MS = 5 * 60_000;

const PHOTO_QUALITY = 0.85;
const THUMB_QUALITY = 0.7;
const DIR = 'photos';

/** Відносний шлях з бази → URI файлу для <Image>. */
export function photoUri(relativePath: string): string {
  return new File(Paths.document, relativePath).uri;
}

/** Галерея з вибором кількох фото. null — людина скасувала вибір. */
export async function pickPhotos(): Promise<ImagePicker.ImagePickerAsset[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: PICK_LIMIT,
    orderedSelection: true,
    exif: true,
    quality: 1,
  });
  return result.canceled ? null : result.assets;
}

/** Зменшити (не збільшувати) до maxEdge по довшій стороні й зберегти JPEG у кеш. */
async function renderJpeg(source: ImageRef, maxEdge: number, compress: number) {
  const context = ImageManipulator.manipulate(source);
  if (Math.max(source.width, source.height) > maxEdge) {
    context.resize(source.width >= source.height ? { width: maxEdge } : { height: maxEdge });
  }
  const image = await context.renderAsync();
  try {
    return { image, saved: await image.saveAsync({ compress, format: SaveFormat.JPEG }) };
  } finally {
    context.release();
  }
}

function moveInto(cacheUri: string, relativePath: string): void {
  const target = new File(Paths.document, relativePath);
  if (target.exists) target.delete();
  new File(cacheUri).moveSync(target);
}

/** Стиснути одне фото, скопіювати в папку додатку й записати в базу. */
export async function importPhoto(
  countryIso: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<Photo> {
  const dir = new Directory(Paths.document, DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

  const id = dbContext.newId();
  const fileUri = `${DIR}/${id}.jpg`;
  const thumbUri = `${DIR}/${id}_t.jpg`;

  const original = await ImageManipulator.manipulate(asset.uri).renderAsync();
  const full = await renderJpeg(original, PHOTO_MAX_EDGE, PHOTO_QUALITY);
  const thumb = await renderJpeg(full.image, THUMB_MAX_EDGE, THUMB_QUALITY);
  original.release();
  full.image.release();
  thumb.image.release();

  try {
    moveInto(full.saved.uri, fileUri);
    moveInto(thumb.saved.uri, thumbUri);
    const meta = parsePhotoMeta(asset.exif);
    return await addPhoto(dbContext, {
      id,
      countryIso,
      fileUri,
      thumbUri,
      width: full.saved.width,
      height: full.saved.height,
      takenAt: meta.takenAt,
      lat: meta.lat,
      lng: meta.lng,
    });
  } catch (error) {
    deletePhotoFiles({ fileUri, thumbUri });
    throw error;
  }
}

/**
 * Імпорт кількох фото по черзі (по одному — щоб не тримати в пам'яті десятки великих
 * зображень). onProgress(готово, усього). Повертає кількість фото, що не вдалося зберегти.
 */
export async function importPhotos(
  countryIso: string,
  assets: readonly ImagePicker.ImagePickerAsset[],
  onProgress: (done: number, total: number) => void,
): Promise<number> {
  let failed = 0;
  onProgress(0, assets.length);
  for (const [i, asset] of assets.entries()) {
    try {
      await importPhoto(countryIso, asset);
    } catch (error) {
      failed++;
      console.warn('[photos] import failed', error);
    }
    onProgress(i + 1, assets.length);
  }
  return failed;
}

/** Стерти файли фото з диска (рядок у базі лишається м'яко видаленим). */
export function deletePhotoFiles(photo: Pick<Photo, 'fileUri' | 'thumbUri'>): void {
  for (const path of [photo.fileUri, photo.thumbUri]) {
    try {
      const file = new File(Paths.document, path);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn('[photos] delete failed', path, error);
    }
  }
}

/**
 * При старті: стерти файли фото, видалених давніше ніж 5 хв тому — на випадок, якщо
 * додаток закрили, поки ще було видно «Скасувати».
 */
export async function cleanupDeletedPhotoFiles(): Promise<void> {
  const before = new Date(Date.now() - CLEANUP_AFTER_MS).toISOString();
  for (const photo of await getPhotosForFileCleanup(dbContext, before)) deletePhotoFiles(photo);
}
