import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { TripQuestionCard } from '@/components/trips/TripQuestionCard';
import { TripRow } from '@/components/trips/TripRow';
import { useToday, useTripQuestions } from '@/lib/use-trips';
import { colors, spacing } from '@/theme';

/**
 * «Скринька»: питання й нагадування, що чекають відповіді. Зараз — «Чи були ви…?» після
 * поїздки (і ті, що відклали «Пізніше» до завтра).
 */
export default function InboxScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const { awaiting } = useTripQuestions(today);
  const [open, setOpen] = useState<string | null>(null);
  const opened = awaiting.find((trip) => trip.id === open) ?? null;

  return (
    <View style={styles.root}>
      {awaiting.length === 0 ? (
        <EmptyState text={t('inbox.empty')} />
      ) : (
        <FlatList
          data={awaiting}
          keyExtractor={(trip) => trip.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<AppText variant="muted">{t('inbox.tripsHint')}</AppText>}
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => (
            <TripRow trip={item} today={today} onPress={() => setOpen(item.id)} />
          )}
        />
      )}
      {opened ? (
        <TripQuestionCard trip={opened} today={today} onClose={() => setOpen(null)} />
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  separator: {
    height: spacing.xs,
  },
});
