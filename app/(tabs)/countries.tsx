import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CountryRow } from '@/components/CountryRow';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { COUNTRIES } from '@/data/countries';
import { activeVisitDatesQuery, plannedIsosQuery } from '@/db';
import { expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import {
  buildCountryList,
  groupVisitDates,
  type CountryRowData,
  type CountrySection,
  type ListFilter,
  type ListSort,
} from '@/lib/country-list';
import { useLiveJoinQuery } from '@/lib/use-live-query';
import { useToggleVisited } from '@/lib/use-toggle-visited';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme';

/** Вкладка «Країни»: Відвідані / Заплановані / Всі, пошук, сортування, швидка позначка. */
export default function CountriesTab() {
  const { t } = useTranslation();
  const lang = useLanguage();
  const toggleVisited = useToggleVisited();

  const [filter, setFilter] = useState<ListFilter>('visited');
  const [sort, setSort] = useState<ListSort>('date');
  const [query, setQuery] = useState('');

  const { data: visitRows } = useLiveQuery(activeVisitDatesQuery(expoDb));
  const plannedRows = useLiveJoinQuery(plannedIsosQuery(expoDb));
  const visits = useMemo(() => groupVisitDates(visitRows), [visitRows]);
  const planned = useMemo(() => new Set(plannedRows.map((r) => r.countryIso)), [plannedRows]);

  const sections = useMemo(
    () => buildCountryList({ countries: COUNTRIES, visits, planned, filter, sort, query, lang }),
    [visits, planned, filter, sort, query, lang],
  );

  const openCountry = useCallback((iso2: string) => {
    router.push({ pathname: '/country/[iso]', params: { iso: iso2 } });
  }, []);
  const onToggle = useCallback(
    (iso2: string, visited: boolean) => void toggleVisited(iso2, visited),
    [toggleVisited],
  );

  const emptyText = query
    ? t('countries.emptySearch')
    : filter === 'visited'
      ? t('countries.emptyVisited')
      : t('countries.emptyPlanned');

  return (
    <Screen title={t('countries.title')}>
      <View style={styles.controls}>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'visited', label: t('countries.filterVisited') },
            { value: 'planned', label: t('countries.filterPlanned') },
            { value: 'all', label: t('countries.filterAll') },
          ]}
        />
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('countries.search')}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.gold}
            style={styles.searchInput}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel={t('countries.search')}
          />
        </View>
        <SegmentedControl
          size="sm"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'date', label: t('countries.sortDate') },
            { value: 'alpha', label: t('countries.sortAlpha') },
            { value: 'continent', label: t('countries.sortContinent') },
          ]}
        />
      </View>

      <SectionList<CountryRowData, CountrySection>
        sections={sections}
        keyExtractor={(row) => row.country.iso2}
        renderItem={({ item }) => (
          <CountryRow
            row={item}
            lang={lang}
            showCheckbox={filter === 'all'}
            onPress={openCountry}
            onToggle={onToggle}
          />
        )}
        renderSectionHeader={({ section }) =>
          section.continent ? (
            <AppText variant="label" style={styles.sectionHeader}>
              {t(`continents.${section.continent}`)}
            </AppText>
          ) : null
        }
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        ListEmptyComponent={<EmptyState text={emptyText} />}
        contentContainerStyle={sections.length ? undefined : styles.emptyContainer}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
  },
  sectionHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
