import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { getCountry } from '@/data/countries';
import type { TripWithCountries } from '@/db';
import { formatPeriod } from '@/lib/dates';
import { daysUntilStart, tripPhase } from '@/lib/trips';
import { colors, fonts, radius, spacing } from '@/theme';

type Props = {
  trip: TripWithCountries;
  today: string;
  onPress: () => void;
};

/** Статус поїздки одним рядком: «через 12 днів», «триває», «завершена»… */
export function useTripStatus() {
  const { t } = useTranslation();
  return (trip: TripWithCountries, today: string): string => {
    const phase = tripPhase(trip, today);
    if (phase === 'upcoming') {
      return t('trips.inDays', { count: daysUntilStart(trip, today) ?? 0 });
    }
    if (phase === 'ongoing') return t('trips.ongoing');
    if (phase === 'past') {
      return trip.status === 'planned' ? t('trips.awaitingAnswer') : t('trips.finished');
    }
    return t('trips.undated');
  };
}

/** Рядок поїздки у списку: прапори, назва, дати, статус. */
export function TripRow({ trip, today, onPress }: Props) {
  const { t } = useTranslation();
  const months = t('months.short', { returnObjects: true });
  const status = useTripStatus()(trip, today);
  const period = formatPeriod(trip.startDate, trip.endDate, months);
  const flags = trip.countries.map((iso) => getCountry(iso)?.flag ?? '').join(' ');
  const soon = tripPhase(trip, today) !== 'past';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.text}>
        {flags ? <AppText style={styles.flags}>{flags}</AppText> : null}
        <AppText style={styles.title} numberOfLines={1}>
          {trip.title}
        </AppText>
        <AppText variant="muted" numberOfLines={1}>
          {period ? t('trips.rowSubtitle', { period, status }) : status}
        </AppText>
      </View>
      {soon ? <View style={styles.dot} /> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  flags: {
    fontSize: 18,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  pressed: {
    opacity: 0.7,
  },
});
