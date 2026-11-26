import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { photosByCountryQuery, removePhoto, restorePhoto, type Photo } from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { deletePhotoFiles, importPhotos, photoUri, pickPhotos } from '@/lib/photos';
import { showUndo } from '@/lib/undo';
import { colors, radius, spacing } from '@/theme';

import { PhotoViewer } from './PhotoViewer';
import { Section } from './Section';

const COLUMNS = 3;
const GAP = spacing.xs;

type Progress = { done: number; total: number } | null;

export function PhotosSection({ iso2 }: { iso2: string }) {
  const { t } = useTranslation();
  const { data: photos } = useLiveQuery(photosByCountryQuery(expoDb, iso2), [iso2]);
  const [progress, setProgress] = useState<Progress>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const tile = width > 0 ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;

  const add = async () => {
    try {
      const assets = await pickPhotos();
      if (!assets?.length) return;
      const failed = await importPhotos(iso2, assets, (done, total) =>
        setProgress({ done, total }),
      );
      if (failed > 0) Alert.alert(t('photos.importFailed', { count: failed }));
    } catch (error) {
      console.warn('[photos] pick failed', error);
      Alert.alert(t('photos.pickFailed'));
    } finally {
      setProgress(null);
    }
  };

  const remove = async (photo: Photo) => {
    setViewing(null);
    await removePhoto(dbContext, photo.id);
    showUndo({
      message: t('undo.photoDeleted'),
      undo: () => restorePhoto(dbContext, photo.id),
      // Файли стираються лише коли час на «Скасувати» минув
      commit: () => deletePhotoFiles(photo),
    });
  };

  return (
    <Section
      title={t('photos.title')}
      actionLabel={t('common.add')}
      onAction={() => void add()}
      actionDisabled={progress !== null}>
      {progress ? (
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.gold} />
          <AppText variant="muted">{t('photos.importing', progress)}</AppText>
        </View>
      ) : null}
      {photos.length === 0 && !progress ? (
        <AppText variant="muted">{t('photos.empty')}</AppText>
      ) : null}
      <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {tile > 0 &&
          photos.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => setViewing(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('photos.open', { index: i + 1, total: photos.length })}
              style={({ pressed }) => [{ width: tile, height: tile }, pressed && styles.pressed]}>
              <Image
                source={{ uri: photoUri(p.thumbUri) }}
                style={styles.thumb}
                contentFit="cover"
                transition={150}
                recyclingKey={p.id}
              />
            </Pressable>
          ))}
      </View>
      {viewing !== null && photos.length > 0 ? (
        <PhotoViewer
          photos={photos}
          initialIndex={Math.min(viewing, photos.length - 1)}
          onClose={() => setViewing(null)}
          onDelete={(p) => void remove(p)}
        />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  thumb: {
    flex: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
});
