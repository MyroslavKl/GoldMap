import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { GlobeView, type GlobeLongPress } from '@/components/globe';
import { PlaceSheet, type PlaceSheetTarget } from '@/components/places/PlaceSheet';
import { placedPhotosQuery, placesByCountryQuery, visitedIsosQuery } from '@/db';
import { expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import { formatDay } from '@/lib/dates';
import { hapticSelection } from '@/lib/haptics';
import type { PlaceSuggestion } from '@/lib/photo-clusters';
import { countPhotosByPlace } from '@/lib/places';
import { useDetailMapAllowed, useMapPoints } from '@/lib/use-map-data';
import { colors, radius, spacing } from '@/theme';

import { ListRow } from './ListRow';
import { Section } from './Section';

const MAP_HEIGHT = 240;
/** Затримка створення мінікарти — тривалість анімації переходу на екран країни */
const MAP_MOUNT_DELAY_MS = 400;

type Props = {
  iso2: string;
  suggestions: readonly PlaceSuggestion[];
  onOpenSuggestions: () => void;
};

/** Точки країни: мінікарта (довге натискання — нова точка), список, пропозиції з GPS. */
export function PlacesSection({ iso2, suggestions, onOpenSuggestions }: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const months = t('months.short', { returnObjects: true });
  const { data: places } = useLiveQuery(placesByCountryQuery(expoDb, iso2), [iso2]);
  const { data: placedPhotos } = useLiveQuery(placedPhotosQuery(expoDb));
  const { data: visitedRows } = useLiveQuery(visitedIsosQuery(expoDb));
  const { points } = useMapPoints();
  const detailMap = useDetailMapAllowed();
  const [sheet, setSheet] = useState<PlaceSheetTarget | null>(null);
  const counts = countPhotosByPlace(placedPhotos);

  // Мінікарта — друга WebView з MapLibre: створюємо після анімації переходу (глобус на цей
  // час уже вивантажено, див. useHoldsMap), щоб перехід не смикався.
  const [showMap, setShowMap] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowMap(true), MAP_MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const onLongPress = (e: GlobeLongPress) => {
    // Мінікарта — лише ця країна: сусідні ігноруємо; біля берега (у морі) — точка цієї країни
    if (e.iso2 && e.iso2 !== iso2) return;
    hapticSelection();
    setSheet({ kind: 'new', iso2, lat: e.lat, lng: e.lng });
  };

  const openPlace = (id: string) => {
    const place = places.find((p) => p.id === id);
    if (place) setSheet({ kind: 'edit', place });
  };

  const photoCount = suggestions.reduce((n, s) => n + s.photoIds.length, 0);

  return (
    <Section title={t('places.title')}>
      <View style={styles.map}>
        {showMap ? (
          <GlobeView
            visited={visitedRows.map((r) => r.countryIso)}
            points={points}
            language={lang}
            detailMap={detailMap}
            focus={{ iso2 }}
            autoRotate={false}
            onLongPress={onLongPress}
            onPointPress={openPlace}
          />
        ) : null}
      </View>
      <AppText variant="muted">{t('places.longPressHint')}</AppText>

      {suggestions.length > 0 ? (
        <Pressable
          onPress={onOpenSuggestions}
          accessibilityRole="button"
          style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
          <AppText style={styles.bannerText}>
            {t('places.suggestBanner', {
              photos: t('places.photoCount', { count: photoCount }),
              places: t('places.placeCount', { count: suggestions.length }),
            })}
          </AppText>
          <AppText style={styles.bannerAction}>{t('places.suggestReview')}</AppText>
        </Pressable>
      ) : null}

      <View style={styles.list}>
        {places.map((p) => (
          <ListRow
            key={p.id}
            title={p.title}
            subtitle={[
              p.visitedAt ? formatDay(p.visitedAt, months) : null,
              counts.get(p.id) ? t('places.photoCount', { count: counts.get(p.id) ?? 0 }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => setSheet({ kind: 'edit', place: p })}
            accessibilityHint={t('common.editHint')}
          />
        ))}
      </View>

      {sheet ? <PlaceSheet target={sheet} onClose={() => setSheet(null)} /> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  map: {
    height: MAP_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.ocean,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldBorder,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.goldDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldBorder,
  },
  bannerText: {
    flex: 1,
  },
  bannerAction: {
    color: colors.gold,
  },
  list: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
});
