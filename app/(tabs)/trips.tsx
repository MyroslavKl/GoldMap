import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { TripRow } from '@/components/trips/TripRow';
import { TripSheet } from '@/components/trips/TripSheet';
import { splitTrips } from '@/lib/trips';
import { useToday, useTrips } from '@/lib/use-trips';
import { spacing } from '@/theme';

/** Вкладка «Поїздки»: майбутні й поточні зверху, минулі нижче. */
export default function TripsTab() {
  const { t } = useTranslation();
  const today = useToday();
  const trips = useTrips();
  const [creating, setCreating] = useState(false);
  const { current, past } = splitTrips(trips, today);

  const sections = [
    { key: 'current', title: t('trips.sectionCurrent'), data: current },
    { key: 'past', title: t('trips.sectionPast'), data: past },
  ].filter((s) => s.data.length > 0);

  const open = (id: string) => router.push({ pathname: '/trip/[id]', params: { id } });

  return (
    <Screen title={t('trips.title')}>
      <Button
        variant="primary"
        icon="add"
        label={t('trips.create')}
        onPress={() => setCreating(true)}
        style={styles.create}
      />
      {sections.length === 0 ? (
        <EmptyState text={t('trips.empty')} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(trip) => trip.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <AppText variant="label" style={styles.header} accessibilityRole="header">
              {section.title}
            </AppText>
          )}
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => (
            <TripRow trip={item} today={today} onPress={() => open(item.id)} />
          )}
        />
      )}
      {creating ? (
        <TripSheet trip={null} onSaved={open} onClose={() => setCreating(false)} />
      ) : null}
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  create: {
    marginBottom: spacing.sm,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  separator: {
    height: spacing.xs,
  },
});
