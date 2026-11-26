import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { getCountry } from '@/data/countries';
import {
  addExpense,
  EXPENSE_CATEGORIES,
  expensesByCountryQuery,
  removeExpense,
  restoreExpense,
  updateExpense,
  type Expense,
  type ExpenseCategory,
} from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { formatDay, toIsoDate } from '@/lib/dates';
import {
  amountToInput,
  findRate,
  foreignCurrencies,
  formatMoney,
  parseAmount,
  parseRate,
  rateToInput,
  summarizeExpenses,
  withRate,
  type Rates,
} from '@/lib/money';
import { showUndo } from '@/lib/undo';
import { saveExchangeRates, useMoneySettings } from '@/lib/use-money-settings';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme';

import { CategoryChart } from './CategoryChart';
import { ListRow } from './ListRow';
import { Section } from './Section';

type Editing = Expense | 'new' | null;

export function ExpensesSection({ iso2 }: { iso2: string }) {
  const { t } = useTranslation();
  const months = t('months.short', { returnObjects: true });
  const { data: expenses } = useLiveQuery(expensesByCountryQuery(expoDb, iso2), [iso2]);
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
          iso2={iso2}
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

type ExpenseSheetProps = {
  iso2: string;
  expense: Expense | null;
  lastCurrency: string | null;
  mainCurrency: string;
  onClose: () => void;
};

function ExpenseSheet({ iso2, expense, lastCurrency, mainCurrency, onClose }: ExpenseSheetProps) {
  const { t } = useTranslation();
  const countryCurrency = getCountry(iso2)?.currency ?? null;
  const [currency, setCurrency] = useState(
    expense?.currency ?? lastCurrency ?? countryCurrency ?? mainCurrency,
  );
  const [amountText, setAmountText] = useState(
    expense ? amountToInput(expense.amount, expense.currency) : '',
  );
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'food');
  const [date, setDate] = useState(expense?.date ?? toIsoDate(new Date()));
  const [comment, setComment] = useState(expense?.comment ?? '');
  const amount = parseAmount(amountText, currency);
  const amountError = amountText.trim() && amount === null ? t('expenses.amountInvalid') : null;

  const save = async () => {
    if (amount === null) return;
    const input = { amount, currency, category, date, comment };
    if (expense) await updateExpense(dbContext, expense.id, input);
    else await addExpense(dbContext, { ...input, countryIso: iso2 });
    onClose();
  };

  const remove = async () => {
    if (!expense) return;
    await removeExpense(dbContext, expense.id);
    onClose();
    showUndo({
      message: t('undo.expenseDeleted'),
      undo: () => restoreExpense(dbContext, expense.id),
    });
  };

  return (
    <Sheet
      visible
      title={expense ? t('expenses.edit') : t('expenses.new')}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            label={t('common.save')}
            onPress={() => void save()}
            disabled={amount === null}
          />
          {expense ? (
            <Button variant="danger" label={t('common.delete')} onPress={() => void remove()} />
          ) : null}
        </>
      }>
      <TextField
        label={t('expenses.amount')}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder={t('expenses.amountPlaceholder')}
        autoFocus={!expense}
        error={amountError}
      />
      <CurrencyPicker
        label={t('expenses.currency')}
        value={currency}
        onChange={setCurrency}
        suggestions={[countryCurrency, mainCurrency, lastCurrency]}
      />
      <View style={styles.field}>
        <AppText variant="label">{t('expenses.category')}</AppText>
        <Chips
          options={EXPENSE_CATEGORIES.map((c) => ({
            value: c,
            label: t(`expenses.categories.${c}`),
          }))}
          value={category}
          onChange={setCategory}
          accessibilityLabel={t('expenses.category')}
        />
      </View>
      <DateField label={t('expenses.date')} value={date} onChange={(d) => d && setDate(d)} />
      <TextField
        label={t('expenses.comment')}
        value={comment}
        onChangeText={setComment}
        placeholder={t('expenses.commentPlaceholder')}
      />
    </Sheet>
  );
}

type RatesSheetProps = {
  currencies: readonly string[];
  mainCurrency: string;
  rates: Rates;
  onClose: () => void;
};

/** Ручні курси: «1 EUR = [ ] UAH» для кожної валюти витрат, відмінної від основної. */
function RatesSheet({ currencies, mainCurrency, rates, onClose }: RatesSheetProps) {
  const { t } = useTranslation();
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      currencies.map((c) => {
        const rate = findRate(rates, c, mainCurrency);
        return [c, rate === null ? '' : rateToInput(rate)];
      }),
    ),
  );
  const invalid = currencies.some((c) => texts[c]?.trim() && parseRate(texts[c]) === null);

  const save = async () => {
    const next = currencies.reduce<Rates>((acc, c) => {
      const text = texts[c]?.trim() ?? '';
      return withRate(acc, c, mainCurrency, text ? parseRate(text) : null);
    }, rates);
    await saveExchangeRates(next);
    onClose();
  };

  return (
    <Sheet
      visible
      title={t('expenses.ratesTitle')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          label={t('common.save')}
          onPress={() => void save()}
          disabled={invalid}
        />
      }>
      <AppText variant="muted">{t('expenses.ratesHint', { currency: mainCurrency })}</AppText>
      {currencies.map((c) => (
        <View key={c} style={styles.rateRow}>
          <AppText style={styles.rateLabel}>{t('expenses.rateOne', { currency: c })}</AppText>
          <View style={styles.rateInput}>
            <TextField
              value={texts[c] ?? ''}
              onChangeText={(text) => setTexts((s) => ({ ...s, [c]: text }))}
              keyboardType="decimal-pad"
              placeholder={t('expenses.ratePlaceholder')}
              accessibilityLabel={t('expenses.rateLabel', { from: c, to: mainCurrency })}
              error={
                texts[c]?.trim() && parseRate(texts[c]) === null ? t('expenses.rateInvalid') : null
              }
            />
          </View>
          <AppText style={styles.rateLabel}>{mainCurrency}</AppText>
        </View>
      ))}
    </Sheet>
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
  field: {
    gap: spacing.sm,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rateLabel: {
    fontFamily: fonts.sansMedium,
  },
  rateInput: {
    flex: 1,
  },
});
