import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { Language } from '@/i18n';
import type { CountryRowData } from '@/lib/country-list';
import { formatVisitDates } from '@/lib/dates';
import { colors, fontSizes, spacing } from '@/theme';

type Props = {
  row: CountryRowData;
  lang: Language;
  /** Показати галочку швидкої позначки (режим «Всі») */
  showCheckbox: boolean;
  onPress: (iso2: string) => void;
  onToggle: (iso2: string, visited: boolean) => void;
};

/** Рядок списку країн: прапор, назва, столиця, дати візитів, (галочка). */
export const CountryRow = memo(function CountryRow({
  row,
  lang,
  showCheckbox,
  onPress,
  onToggle,
}: Props) {
  const { t } = useTranslation();
  const { country, visited, startDates } = row;
  const name = country.name[lang];
  const capital = country.capital?.[lang] ?? '';
  const dates = formatVisitDates(startDates, t('months.short', { returnObjects: true }));
  const subtitle =
    capital && dates ? t('countries.rowCapitalDates', { capital, dates }) : capital || dates;

  return (
    <Pressable
      onPress={() => onPress(country.iso2)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button">
      <AppText style={styles.flag} accessible={false}>
        {country.flag}
      </AppText>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <AppText numberOfLines={1} style={[styles.name, visited && styles.nameVisited]}>
            {name}
          </AppText>
          {!country.unMember ? (
            <AppText variant="muted" style={styles.tag}>
              {t('countries.territory')}
            </AppText>
          ) : null}
        </View>
        {subtitle ? (
          <AppText variant="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {showCheckbox ? (
        <Pressable
          onPress={() => onToggle(country.iso2, visited)}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: visited }}
          accessibilityLabel={
            visited
              ? t('countries.unmarkVisited', { country: name })
              : t('countries.markVisited', { country: name })
          }>
          <Ionicons
            name={visited ? 'checkmark-circle' : 'ellipse-outline'}
            size={28}
            color={visited ? colors.gold : colors.textMuted}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  pressed: {
    opacity: 0.6,
  },
  flag: {
    fontSize: 28,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
  nameVisited: {
    color: colors.gold,
  },
  tag: {
    fontSize: fontSizes.xs,
  },
});
