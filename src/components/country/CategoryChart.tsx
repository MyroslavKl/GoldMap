import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { ExpenseCategory } from '@/db';
import { formatMoney, type NumberStyle } from '@/lib/money';
import { colors, fonts, spacing } from '@/theme';

type Props = {
  byCategory: ReadonlyMap<ExpenseCategory, number>;
  total: number;
  currency: string;
  numberStyle: NumberStyle;
};

const BAR_HEIGHT = 8;

/**
 * Витрати за категоріями: впорядковані горизонтальні смуги на спільній базовій лінії,
 * одним кольором (золото), найбільша зверху. Кожен рядок має назву, суму й частку — тож
 * рядки водночас є таблицею даних, і колір не єдиний носій інформації.
 */
export function CategoryChart({ byCategory, total, currency, numberStyle }: Props) {
  const { t } = useTranslation();
  const rows = [...byCategory].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0 || total <= 0) return null;
  const max = rows[0][1];

  return (
    <View style={styles.root} accessibilityLabel={t('expenses.chartLabel')}>
      {rows.map(([category, value]) => {
        const share = Math.round((value / total) * 100);
        const amount = formatMoney(value, currency, numberStyle);
        const name = t(`expenses.categories.${category}`);
        return (
          <View
            key={category}
            style={styles.row}
            accessible
            accessibilityLabel={t('expenses.chartRow', { category: name, amount, share })}>
            <View style={styles.labels}>
              <AppText style={styles.name}>{name}</AppText>
              <AppText style={styles.value}>{t('expenses.amountShare', { amount, share })}</AppText>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${(value / max) * 100}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm + 2,
  },
  row: {
    gap: spacing.xs,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
  value: {
    color: colors.textMuted,
    fontFamily: fonts.sansMedium,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: BAR_HEIGHT,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.goldDim,
  },
  bar: {
    height: BAR_HEIGHT,
    // Заокруглений лише кінець з даними; початок прив'язаний до базової лінії
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.gold,
    minWidth: 2,
  },
});
