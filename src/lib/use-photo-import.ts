import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import type { Photo } from '@/db';
import { importPhotos, pickPhotos } from '@/lib/photos';

export type ImportProgress = { done: number; total: number } | null;

/**
 * Вибір фото з галереї + стиснення й копія в папку додатку, з прогресом і повідомленнями
 * про помилки. Повертає збережені фото (порожньо, якщо скасували).
 */
export function usePhotoImport(iso2: string) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<ImportProgress>(null);

  const pickAndImport = useCallback(async (): Promise<Photo[]> => {
    try {
      const assets = await pickPhotos();
      if (!assets?.length) return [];
      const { photos, failed } = await importPhotos(iso2, assets, (done, total) =>
        setProgress({ done, total }),
      );
      if (failed > 0) Alert.alert(t('photos.importFailed', { count: failed }));
      return photos;
    } catch (error) {
      console.warn('[photos] pick failed', error);
      Alert.alert(t('photos.pickFailed'));
      return [];
    } finally {
      setProgress(null);
    }
  }, [iso2, t]);

  return { progress, pickAndImport };
}
