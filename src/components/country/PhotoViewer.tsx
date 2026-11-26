import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import type { Photo } from '@/db';
import { formatDay } from '@/lib/dates';
import { takenAtDate } from '@/lib/exif';
import { photoUri } from '@/lib/photos';
import { colors, spacing } from '@/theme';

type Props = {
  photos: readonly Photo[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (photo: Photo) => void;
};

/** Перегляд фото на весь екран: гортання вбік, дата зйомки, видалення. */
export function PhotoViewer({ photos, initialIndex, onClose, onDelete }: Props) {
  const { t } = useTranslation();
  const months = t('months.short', { returnObjects: true });
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const current = photos[index] ?? photos[0];
  const date = takenAtDate(current.takenAt);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Image
              source={{ uri: photoUri(item.fileUri) }}
              placeholder={{ uri: photoUri(item.thumbUri) }}
              style={{ width, height }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          )}
        />
        <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <AppText style={styles.counter}>
            {t('photos.counter', { index: index + 1, total: photos.length })}
          </AppText>
          <Pressable
            onPress={() => onDelete(current)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('photos.delete')}>
            <Ionicons name="trash-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
        {date ? (
          <View style={[styles.caption, { paddingBottom: insets.bottom + spacing.md }]}>
            <AppText variant="muted">
              {t('photos.takenAt', { date: formatDay(date, months) })}
            </AppText>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.scrim,
  },
  counter: {
    fontVariant: ['tabular-nums'],
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: spacing.sm,
    backgroundColor: colors.scrim,
  },
});
