import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { getCountry } from '@/data/countries';
import type { TripWithCountries } from '@/db';
import { splitTrips, tripPhase } from '@/lib/trips';
import { colors, fonts, radius, spacing } from '@/theme';

import { useTripStatus } from './TripRow';

/** Скільки найближчих поїздок у стрічці */
const MAX_TRIPS = 6;

type Props = {
  trips: readonly TripWithCountries[];
  today: string;
  /** Перший тап — повернути глобус до країни поїздки */
  onFocus: (iso2: string) => void;
  /** Другий тап на ту саму поїздку — відкрити її */
  onOpen: (tripId: string) => void;
};

/** Стрічка запланованих поїздок унизу «Глобуса»: прапор, назва, «через 12 днів». */
export function TripStrip({ trips, today, onFocus, onOpen }: Props) {
  const { t } = useTranslation();
  const status = useTripStatus();
  const [focused, setFocused] = useState<string | null>(null);
  const upcoming = splitTrips(
    trips.filter((trip) => trip.status === 'planned' && tripPhase(trip, today) !== 'undated'),
    today,
  ).current.slice(0, MAX_TRIPS);
  if (upcoming.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      accessibilityLabel={t('trips.stripLabel')}>
      {upcoming.map((trip) => {
        const active = focused === trip.id;
        return (
          <Pressable
            key={trip.id}
            onPress={() => {
              if (active) {
                onOpen(trip.id);
                return;
              }
              setFocused(trip.id);
              if (trip.countries[0]) onFocus(trip.countries[0]);
            }}
            accessibilityRole="button"
            accessibilityHint={active ? t('trips.stripOpenHint') : t('trips.stripFocusHint')}
            style={({ pressed }) => [
              styles.chip,
              active && styles.active,
              pressed && styles.pressed,
            ]}>
            <AppText style={styles.flags}>
              {trip.countries.map((iso) => getCountry(iso)?.flag ?? '').join(' ')}
            </AppText>
            <AppText style={styles.title} numberOfLines={1}>
              {trip.title}
            </AppText>
            <AppText style={styles.status}>{status(trip, today)}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chip: {
    minWidth: 140,
    maxWidth: 220,
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldBorder,
  },
  active: {
    borderColor: colors.gold,
  },
  flags: {
    fontSize: 16,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
  },
  status: {
    color: colors.gold,
    fontFamily: fonts.sansMedium,
  },
  pressed: {
    opacity: 0.7,
  },
});
