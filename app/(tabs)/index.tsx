import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CountryCard } from '@/components/CountryCard';
import { GlobeView, type GlobeViewHandle } from '@/components/globe';
import { countableIsos, getCountry } from '@/data/countries';
import { activeVisitDatesQuery, computeCounter, plannedIsosQuery } from '@/db';
import { expoDb } from '@/db/client';
import { groupVisitDates } from '@/lib/country-list';
import { useLanguage } from '@/i18n';
import { useToggleVisited } from '@/lib/use-toggle-visited';
import { spacing } from '@/theme';

/** Вкладка «Глобус»: глобус на весь екран, лічильник поверх, картка країни — оверлеєм. */
export default function GlobeTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const globe = useRef<GlobeViewHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const toggleVisited = useToggleVisited();
  const lang = useLanguage();

  const { data: visitRows } = useLiveQuery(activeVisitDatesQuery(expoDb));
  const { data: plannedRows } = useLiveQuery(plannedIsosQuery(expoDb));
  const visitsByCountry = useMemo(() => groupVisitDates(visitRows), [visitRows]);
  const visited = useMemo(() => [...visitsByCountry.keys()], [visitsByCountry]);
  const planned = useMemo(() => plannedRows.map((r) => r.countryIso), [plannedRows]);
  // TODO(етап 9): режим списку країн із налаштувань (un / extended).
  const counter = computeCounter(visited, countableIsos('un'));

  const selectCountry = useCallback((iso2: string) => {
    if (!getCountry(iso2)) return;
    setSelected(iso2);
    globe.current?.flyTo({ iso2 });
  }, []);

  const closeCard = useCallback(() => setSelected(null), []);

  const openCountry = useCallback(() => {
    if (!selected) return;
    setSelected(null);
    router.push({ pathname: '/country/[iso]', params: { iso: selected } });
  }, [selected]);

  const isSelectedVisited = selected ? visitsByCountry.has(selected) : false;
  const onToggleVisited = useCallback(() => {
    if (selected) void toggleVisited(selected, isSelectedVisited);
  }, [selected, isSelectedVisited, toggleVisited]);

  return (
    <View style={styles.root}>
      <GlobeView
        ref={globe}
        visited={visited}
        planned={planned}
        language={lang}
        onCountryPress={selectCountry}
      />
      <View pointerEvents="none" style={[styles.counter, { top: insets.top + spacing.md }]}>
        <AppText variant="counter" accessibilityRole="header">
          {t('globe.counter', counter)}
        </AppText>
      </View>

      {selected ? (
        <CountryCard
          key={selected}
          iso2={selected}
          visited={isSelectedVisited}
          planned={planned.includes(selected)}
          startDates={visitsByCountry.get(selected) ?? []}
          onToggleVisited={onToggleVisited}
          onOpen={openCountry}
          onClose={closeCard}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  counter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
