import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryHeader } from '@/components/country/CountryHeader';
import { ExpensesSection } from '@/components/country/ExpensesSection';
import { NotesSection } from '@/components/country/NotesSection';
import { PhotosSection } from '@/components/country/PhotosSection';
import { PlacesSection } from '@/components/country/PlacesSection';
import { VisitsSection } from '@/components/country/VisitsSection';
import { EmptyState } from '@/components/EmptyState';
import { GpsSuggestionsSheet } from '@/components/places/GpsSuggestionsSheet';
import { CITIES } from '@/data/cities';
import { getCountry } from '@/data/countries';
import {
  parseSetting,
  photosByCountryQuery,
  settingQuery,
  visitsByCountryQuery,
  type Photo,
} from '@/db';
import { expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import { locateCountry } from '@/lib/locate-country';
import { useHoldsMap } from '@/lib/map-presence';
import { suggestPlaces } from '@/lib/photo-clusters';
import { useToggleVisited } from '@/lib/use-toggle-visited';
import { colors, spacing } from '@/theme';

/** Екран країни: візити, фото, точки на мінікарті, нотатки, витрати. */
export default function CountryScreen() {
  const { t } = useTranslation();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();
  const { iso } = useLocalSearchParams<{ iso: string }>();
  const iso2 = (iso ?? '').toUpperCase();
  const country = getCountry(iso2);
  const toggleVisited = useToggleVisited();
  const { data: visits } = useLiveQuery(visitsByCountryQuery(expoDb, iso2), [iso2]);
  const visited = visits.length > 0;
  // Поки відкрито цей екран (з мінікартою), глобус на вкладці вивантажено — одна WebView-карта.
  useHoldsMap();

  // Пропозиції точок з фото з GPS (групи ~1 км за день; країна — за нашими кордонами)
  const { data: photos } = useLiveQuery(photosByCountryQuery(expoDb, iso2), [iso2]);
  const { data: skippedRows } = useLiveQuery(settingQuery(expoDb, 'skippedGpsPhotos'));
  const skipped = useMemo(() => parseSetting('skippedGpsPhotos', skippedRows) ?? [], [skippedRows]);
  const suggestions = useMemo(
    () =>
      suggestPlaces({
        photos,
        sourceIso: iso2,
        skipped: new Set(skipped),
        cities: CITIES,
        locate: locateCountry,
      }),
    [photos, iso2, skipped],
  );
  const [suggestOpen, setSuggestOpen] = useState(false);
  // Щойно додали фото з GPS — одразу запропонувати точки (живий список ще не оновився,
  // тож рахуємо з урахуванням нових фото; панель покаже живі пропозиції)
  const onPhotosImported = (imported: Photo[]) => {
    if (!imported.some((p) => p.lat != null)) return;
    const known = new Set(photos.map((p) => p.id));
    const next = suggestPlaces({
      photos: [...photos, ...imported.filter((p) => !known.has(p.id))],
      sourceIso: iso2,
      skipped: new Set(skipped),
      cities: CITIES,
      locate: locateCountry,
    });
    if (next.length > 0) setSuggestOpen(true);
  };

  if (!country) {
    return (
      <>
        <Stack.Screen options={{ title: t('country.unknown') }} />
        <EmptyState text={t('country.unknown')} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: country.name[lang] }} />
      <ScrollView
        style={styles.root}
        // iOS: напівпрозорий системний заголовок лежить поверх контенту — без відступу під нього
        // верх екрана (силует) ховався під заголовком і до нього не можна було догорнути.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled">
        <CountryHeader
          country={country}
          visited={visited}
          onToggleVisited={() => void toggleVisited(iso2, visited)}
        />
        <VisitsSection iso2={iso2} />
        <PhotosSection iso2={iso2} onImported={onPhotosImported} />
        <PlacesSection
          iso2={iso2}
          suggestions={suggestions}
          onOpenSuggestions={() => setSuggestOpen(true)}
        />
        <NotesSection iso2={iso2} />
        <ExpensesSection iso2={iso2} />
      </ScrollView>
      {suggestOpen && suggestions.length > 0 ? (
        <GpsSuggestionsSheet
          suggestions={suggestions}
          skipped={skipped}
          onClose={() => setSuggestOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
