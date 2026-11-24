import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { countableIsos } from '@/data/countries';
import { computeCounter, visitedIsosQuery } from '@/db';
import { expoDb } from '@/db/client';
import { spacing } from '@/theme';

/** Вкладка «Глобус». GlobeView з'явиться на етапі 4. */
export default function GlobeTab() {
  const { t } = useTranslation();
  // TODO(етап 9): режим списку країн із налаштувань (un / extended).
  const { data } = useLiveQuery(visitedIsosQuery(expoDb));
  const counter = computeCounter(
    data.map((r) => r.countryIso),
    countableIsos('un'),
  );

  return (
    <Screen>
      <View style={styles.counter}>
        <AppText variant="counter">{t('globe.counter', counter)}</AppText>
      </View>
      <EmptyState text={t('globe.placeholder')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  counter: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
});
