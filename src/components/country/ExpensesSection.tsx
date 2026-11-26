import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ExpenseSheet } from '@/components/expenses/ExpenseSheet';
import { RatesSheet } from '@/components/expenses/RatesSheet';
import { expensesByCountryQuery, tripsWithCountryQuery, type Expense } from '@/db';
import { expoDb } from '@/db/client';
import { formatDay } from '@/lib/dates';
import { foreignCurrencies, formatMoney, summarizeExpenses } from '@/lib/money';
import { useLiveJoinQuery } from '@/lib/use-live-query';
import { useMoneySettings } from '@/lib/use-money-settings';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme';

import { CategoryChart } from './CategoryChart';
import { ListRow } from './ListRow';
import { Section } from './Section';

type Editing = Expense | 'new' | null;

export function ExpensesSection({ iso2 }: { iso2: string }) {
  const { t } = useTranslation();
  const months = t('months.short', { returnObjects: true });
  const { data: expenses } = useLiveQuery(expensesByCountryQuery(expoDb, iso2), [iso2]);
  const tripOptions = useLiveJoinQuery(tripsWithCountryQuery(expoDb, iso2), [iso2]);
  const { mainCurrency, rates, numberStyle } = useMoneySettings();
  const [editing, setEditing] = useState<Editing>(null);
  const [ratesOpen, setRatesOpen] = useState(false);

  const summary = useMemo(
    () => summarizeExpenses(expenses, mainCurrency, rates),
    [expenses, mainCurrency, rates],
  );
  const foreign = foreignCurrencies(expenses, mainCurrency);
  const money = (minor: number, currency: string) => formatMoney(minor, currency, numberStyle);

  return (
    <Section
      title={t('expenses.title')}
      actionLabel={t('common.add')}
      onAction={() => setEditing('new')}>
      {expenses.length === 0 ? (
        <AppText variant="muted">{t('expenses.empty')}</AppText>
      ) : (
        <View style={styles.summary}>
          <AppText variant="label">{t('expenses.total')}</AppText>
          <AppText style={styles.total} accessibilityRole="summary">
            {money(summary.total, summary.currency)}
          </AppText>
          {summary.unconverted.size > 0 ? (
            <AppText variant="muted">
              {t('expenses.withoutRate', {
                amounts: [...summary.unconverted].map(([c, v]) => money(v, c)).join(' + '),
              })}
            </AppText>
          ) : null}
          <CategoryChart
            byCategory={summary.byCategory}
            total={summary.total}
            currency={summary.currency}
            numberStyle={numberStyle}
          />
          {foreign.length > 0 ? (
            <Button
              small
              variant="ghost"
              icon="swap-horizontal"
              label={summary.unconverted.size > 0 ? t('expenses.setRates') : t('expenses.rates')}
              onPress={() => setRatesOpen(true)}
              style={styles.ratesButton}
            />
          ) : null}
        </View>
      )}

      <View style={styles.list}>
        {expenses.map((e) => (
          <ListRow
            key={e.id}
            title={e.comment ?? t(`expenses.categories.${e.category}`)}
            subtitle={
              e.comment
                ? t('expenses.rowSubtitle', {
                    category: t(`expenses.categories.${e.category}`),
                    date: formatDay(e.date, months),
                  })
                : formatDay(e.date, months)
            }
            trailing={money(e.amount, e.currency)}
            onPress={() => setEditing(e)}
            accessibilityHint={t('common.editHint')}
          />
        ))}
      </View>

      {editing ? (
        <ExpenseSheet
          countries={[iso2]}
          tripOptions={tripOptions}
          expense={editing === 'new' ? null : editing}
          lastCurrency={expenses[0]?.currency ?? null}
          mainCurrency={mainCurrency}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {ratesOpen ? (
        <RatesSheet
          currencies={foreign}
          mainCurrency={mainCurrency}
          rates={rates}
          onClose={() => setRatesOpen(false)}
        />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  total: {
    fontFamily: fonts.serifBold,
    fontSize: fontSizes.xl,
    color: colors.gold,
    fontVariant: ['tabular-nums'],
  },
  ratesButton: {
    alignSelf: 'flex-start',
  },
  list: {
    gap: spacing.xs,
  },
});
