import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { GlobeView } from '@/components/globe';
import { countableIsos } from '@/data/countries';
import { computeCounter, visitedIsosQuery } from '@/db';
import { expoDb } from '@/db/client';
import { spacing } from '@/theme';

/** Вкладка «Глобус»: глобус на весь екран і лічильник поверх. */
export default function GlobeTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data } = useLiveQuery(visitedIsosQuery(expoDb));
  const visited = useMemo(() => data.map((r) => r.countryIso), [data]);
  // TODO(етап 9): режим списку країн із налаштувань (un / extended).
  const counter = computeCounter(visited, countableIsos('un'));

  // TODO(етап 5): замість переходу — затемнення фону і винесена картка країни.
  const openCountry = useCallback((iso2: string) => {
    router.push({ pathname: '/country/[iso]', params: { iso: iso2 } });
  }, []);

  return (
    <View style={styles.root}>
      <GlobeView visited={visited} onCountryPress={openCountry} />
      <View pointerEvents="none" style={[styles.counter, { top: insets.top + spacing.md }]}>
        <AppText variant="counter" accessibilityRole="header">
          {t('globe.counter', counter)}
        </AppText>
      </View>
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
