import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { getCountry } from '@/data/countries';
import { confirmTripVisited, declineTrip, snoozeTripQuestion, type TripWithCountries } from '@/db';
import { dbContext } from '@/db/client';
import { useLanguage } from '@/i18n';
import { formatPeriod } from '@/lib/dates';
import { hapticMarked } from '@/lib/haptics';
import { colors, fonts, radius, spacing } from '@/theme';

type Props = {
  trip: TripWithCountries;
  today: string;
  onClose: () => void;
};

/**
 * «Ви були в … 6–10 грудня?» після кінця поїздки. Галочка біля кожної країни (усі ввімкнені):
 * візит з датами поїздки отримують лише вибрані. «Пізніше» — попап знову з наступного дня,
 * до того питання видно лише в «Скриньці».
 */
export function TripQuestionCard({ trip, today, onClose }: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const months = t('months.short', { returnObjects: true });
  const [chosen, setChosen] = useState<string[]>(trip.countries);
  const period = formatPeriod(trip.startDate, trip.endDate, months);

  const toggle = (iso2: string) =>
    setChosen((cur) => (cur.includes(iso2) ? cur.filter((x) => x !== iso2) : [...cur, iso2]));

  const confirm = async () => {
    await confirmTripVisited(dbContext, trip.id, chosen);
    hapticMarked();
    onClose();
  };
  const decline = async () => {
    await declineTrip(dbContext, trip.id);
    onClose();
  };
  const later = async () => {
    await snoozeTripQuestion(dbContext, trip.id, today);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void later()}>
      <View style={styles.scrim}>
        <Animated.View
          entering={ZoomIn.duration(300).reduceMotion(ReduceMotion.System)}
          style={styles.card}
          accessibilityViewIsModal>
          <AppText variant="title" style={styles.center} accessibilityRole="header">
            {t('tripQuestion.title')}
          </AppText>
          <AppText variant="muted" style={styles.center}>
            {period ? t('tripQuestion.subtitle', { trip: trip.title, period }) : trip.title}
          </AppText>

          <View style={styles.list}>
            {trip.countries.map((iso2) => {
              const c = getCountry(iso2);
              const on = chosen.includes(iso2);
              return (
                <Pressable
                  key={iso2}
                  onPress={() => toggle(iso2)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <AppText style={styles.flag}>{c?.flag ?? ''}</AppText>
                  <AppText style={styles.name}>{c?.name[lang] ?? iso2}</AppText>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={on ? colors.gold : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>

          <Button
            variant="primary"
            label={t('tripQuestion.yes', { count: chosen.length })}
            onPress={() => void confirm()}
            disabled={chosen.length === 0}
          />
          <View style={styles.secondary}>
            <Button
              variant="secondary"
              label={t('tripQuestion.no')}
              onPress={() => void decline()}
              style={styles.flex}
            />
            <Button
              variant="secondary"
              label={t('tripQuestion.later')}
              onPress={() => void later()}
              style={styles.flex}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.scrim,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldBorder,
  },
  center: {
    textAlign: 'center',
  },
  list: {
    marginVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  flag: {
    fontSize: 22,
  },
  name: {
    flex: 1,
    fontFamily: fonts.sansMedium,
  },
  secondary: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
