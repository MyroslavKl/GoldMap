import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { formatMoney, type BudgetProgress, type NumberStyle } from '@/lib/money';
import { colors, fonts, fontSizes, spacing } from '@/theme';

type Props = { progress: BudgetProgress; numberStyle: NumberStyle };

const BAR_HEIGHT = 10;

/**
 * Бюджет проти витрат: одна смуга-лічильник (доріжка — бюджет, заливка — витрачено).
 * Перевищення — не лише колір: окремий рядок з іконкою й сумою понад бюджет.
 */
export function BudgetMeter({ progress, numberStyle }: Props) {
  const { t } = useTranslation();
  const money = (v: number) => formatMoney(v, progress.currency, numberStyle);
  const share = Math.min(1, progress.ratio);
  const over = progress.over > 0;
  const percent = Number.isFinite(progress.ratio) ? Math.round(progress.ratio * 100) : 100;

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={t('budget.a11y', {
        spent: money(progress.spent),
        budget: money(progress.budget),
        percent,
      })}>
      <View style={styles.labels}>
        <AppText style={styles.spent}>{money(progress.spent)}</AppText>
        <AppText variant="muted">{t('budget.of', { budget: money(progress.budget) })}</AppText>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, over && styles.fillOver, { width: `${Math.max(share * 100, 1)}%` }]}
        />
      </View>
      {over ? (
        <View style={styles.overRow}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <AppText style={styles.overText}>
            {t('budget.over', { amount: money(progress.over) })}
          </AppText>
        </View>
      ) : (
        <AppText variant="muted">
          {t('budget.left', { amount: money(progress.budget - progress.spent), percent })}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  labels: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  spent: {
    fontFamily: fonts.serifBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.goldDim,
    overflow: 'hidden',
  },
  fill: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.gold,
  },
  fillOver: {
    backgroundColor: colors.danger,
  },
  overRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  overText: {
    color: colors.danger,
    fontFamily: fonts.sansMedium,
  },
});
