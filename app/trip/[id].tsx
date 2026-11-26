import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ListRow } from '@/components/country/ListRow';
import { Section } from '@/components/country/Section';
import { EmptyState } from '@/components/EmptyState';
import { ExpenseSheet } from '@/components/expenses/ExpenseSheet';
import { BudgetMeter } from '@/components/trips/BudgetMeter';
import { useTripStatus } from '@/components/trips/TripRow';
import { TripSheet } from '@/components/trips/TripSheet';
import { WishlistSection } from '@/components/trips/WishlistSection';
import { getCountry } from '@/data/countries';
import { removeTrip, reopenTripQuestion, restoreTrip, tripExpensesQuery, type Expense } from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import { formatDay, formatPeriod } from '@/lib/dates';
import { budgetProgress, formatMoney, summarizeExpenses } from '@/lib/money';
import { showUndo } from '@/lib/undo';
import { useMoneySettings } from '@/lib/use-money-settings';
import { useToday, useTrips } from '@/lib/use-trips';
import { colors, fonts, radius, spacing } from '@/theme';

type Editing = Expense | 'new' | null;

/** Екран поїздки: країни й дати, бюджет проти витрат, витрати, «хочу відвідати», нотатки. */
export default function TripScreen() {
  const { t } = useTranslation();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();
  const months = t('months.short', { returnObjects: true });
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const today = useToday();
  const trip = useTrips().find((x) => x.id === id) ?? null;
  const status = useTripStatus();
  const { data: expenses } = useLiveQuery(tripExpensesQuery(expoDb, id ?? ''), [id]);
  const { mainCurrency, rates, numberStyle } = useMoneySettings();
  const [editingTrip, setEditingTrip] = useState(edit === '1');
  const [editingExpense, setEditingExpense] = useState<Editing>(null);

  const total = useMemo(
    () => summarizeExpenses(expenses, mainCurrency, rates),
    [expenses, mainCurrency, rates],
  );

  if (!trip) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState text={t('trips.notFound')} />
      </>
    );
  }

  const period = formatPeriod(trip.startDate, trip.endDate, months);
  const money = (minor: number, currency: string) => formatMoney(minor, currency, numberStyle);
  const progress =
    trip.budget != null && trip.currency
      ? budgetProgress(trip.budget, trip.currency, expenses, rates)
      : null;

  const remove = async () => {
    await removeTrip(dbContext, trip.id);
    router.back();
    showUndo({ message: t('undo.tripDeleted'), undo: () => restoreTrip(dbContext, trip.id) });
  };

  return (
    <>
      <Stack.Screen options={{ title: trip.title }} />
      <ScrollView
        style={styles.root}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            {trip.title}
          </AppText>
          <AppText variant="muted">
            {period
              ? t('trips.rowSubtitle', { period, status: status(trip, today) })
              : status(trip, today)}
          </AppText>
          <View style={styles.countries}>
            {trip.countries.map((iso) => {
              const c = getCountry(iso);
              return (
                <Button
                  key={iso}
                  small
                  variant="secondary"
                  label={c ? `${c.flag} ${c.name[lang]}` : iso}
                  onPress={() => router.push({ pathname: '/country/[iso]', params: { iso } })}
                />
              );
            })}
          </View>
          <Button
            small
            variant="ghost"
            icon="create-outline"
            label={t('trips.edit')}
            onPress={() => setEditingTrip(true)}
            style={styles.left}
          />
          {trip.status === 'cancelled' ? (
            <Button
              small
              variant="ghost"
              icon="refresh-outline"
              label={t('trips.reopen')}
              accessibilityHint={t('trips.reopenHint')}
              onPress={() => void reopenTripQuestion(dbContext, trip.id)}
              style={styles.left}
            />
          ) : null}
        </View>

        <Section title={t('budget.title')}>
          {progress ? (
            <BudgetMeter progress={progress} numberStyle={numberStyle} />
          ) : (
            <AppText variant="muted">{t('budget.none')}</AppText>
          )}
          {progress && progress.unconverted.size > 0 ? (
            <AppText variant="muted">
              {t('expenses.withoutRate', {
                amounts: [...progress.unconverted].map(([c, v]) => money(v, c)).join(' + '),
              })}
            </AppText>
          ) : null}
        </Section>

        <Section
          title={t('expenses.title')}
          actionLabel={t('common.add')}
          onAction={() => setEditingExpense('new')}>
          {expenses.length === 0 ? (
            <AppText variant="muted">{t('trips.noExpenses')}</AppText>
          ) : (
            <View style={styles.totalRow}>
              <AppText variant="label">{t('expenses.total')}</AppText>
              <AppText style={styles.total}>{money(total.total, total.currency)}</AppText>
            </View>
          )}
          <View style={styles.list}>
            {expenses.map((e) => (
              <ListRow
                key={e.id}
                title={e.comment ?? t(`expenses.categories.${e.category}`)}
                subtitle={`${getCountry(e.countryIso)?.flag ?? ''} ${formatDay(e.date, months)}`}
                trailing={money(e.amount, e.currency)}
                onPress={() => setEditingExpense(e)}
                accessibilityHint={t('common.editHint')}
              />
            ))}
          </View>
        </Section>

        <WishlistSection trip={trip} today={today} />

        {trip.notes ? (
          <Section title={t('trips.notes')}>
            <AppText>{trip.notes}</AppText>
          </Section>
        ) : null}

        <Button
          variant="danger"
          label={t('trips.delete')}
          onPress={() => void remove()}
          style={styles.delete}
        />
      </ScrollView>

      {editingTrip ? <TripSheet trip={trip} onClose={() => setEditingTrip(false)} /> : null}
      {editingExpense ? (
        <ExpenseSheet
          expense={editingExpense === 'new' ? null : editingExpense}
          countries={trip.countries}
          fixedTripId={trip.id}
          lastCurrency={expenses[0]?.currency ?? trip.currency}
          mainCurrency={mainCurrency}
          onClose={() => setEditingExpense(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  header: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  countries: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  left: {
    alignSelf: 'flex-start',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  total: {
    fontFamily: fonts.serifBold,
    color: colors.gold,
    fontVariant: ['tabular-nums'],
  },
  list: {
    gap: spacing.xs,
  },
  delete: {
    marginTop: spacing.xl,
  },
});
