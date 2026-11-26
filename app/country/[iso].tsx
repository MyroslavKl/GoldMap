import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CountryHeader } from '@/components/country/CountryHeader';
import { ExpensesSection } from '@/components/country/ExpensesSection';
import { NotesSection } from '@/components/country/NotesSection';
import { PhotosSection } from '@/components/country/PhotosSection';
import { Section } from '@/components/country/Section';
import { VisitsSection } from '@/components/country/VisitsSection';
import { EmptyState } from '@/components/EmptyState';
import { getCountry } from '@/data/countries';
import { visitsByCountryQuery } from '@/db';
import { expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import { useToggleVisited } from '@/lib/use-toggle-visited';
import { colors, spacing } from '@/theme';

/** Екран країни: візити, фото, точки (етап 7), нотатки, витрати. */
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled">
        <CountryHeader
          country={country}
          visited={visited}
          onToggleVisited={() => void toggleVisited(iso2, visited)}
        />
        <VisitsSection iso2={iso2} />
        <PhotosSection iso2={iso2} />
        {/* TODO(етап 7): міні-карта країни з точками; фото з GPS пропонують точку */}
        <Section title={t('places.title')}>
          <AppText variant="muted">{t('places.soon')}</AppText>
        </Section>
        <NotesSection iso2={iso2} />
        <ExpensesSection iso2={iso2} />
      </ScrollView>
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
