import { useState } from 'react';
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
  removeExpense,
  restoreExpense,
  updateExpense,
  type Expense,
  type ExpenseCategory,
} from '@/db';
import { dbContext } from '@/db/client';
import { useLanguage } from '@/i18n';
import { toIsoDate } from '@/lib/dates';
import { amountToInput, parseAmount } from '@/lib/money';
import { showUndo } from '@/lib/undo';
import { spacing } from '@/theme';

const NO_TRIP = '__none__';

type Props = {
  expense: Expense | null;
  /** Країни на вибір (на екрані країни — одна, у поїздці — країни поїздки) */
  countries: readonly string[];
  /** Поїздка задана наперед (екран поїздки) — вибору поїздки немає */
  fixedTripId?: string;
  /** Поїздки, до яких можна прив'язати (екран країни): чипи «Без поїздки» + ці */
  tripOptions?: readonly { id: string; title: string }[];
  lastCurrency: string | null;
  mainCurrency: string;
  onClose: () => void;
};

/** Витрата: сума, валюта, категорія, дата, коментар; країна й поїздка — якщо є вибір. */
export function ExpenseSheet({
  expense,
  countries,
  fixedTripId,
  tripOptions = [],
  lastCurrency,
  mainCurrency,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const [countryIso, setCountryIso] = useState(expense?.countryIso ?? countries[0] ?? '');
  const countryCurrency = getCountry(countryIso)?.currency ?? null;
  const [currency, setCurrency] = useState(
    expense?.currency ?? lastCurrency ?? countryCurrency ?? mainCurrency,
  );
  const [amountText, setAmountText] = useState(
    expense ? amountToInput(expense.amount, expense.currency) : '',
  );
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'food');
  const [date, setDate] = useState(expense?.date ?? toIsoDate(new Date()));
  const [comment, setComment] = useState(expense?.comment ?? '');
  const [tripChoice, setTripChoice] = useState(expense?.tripId ?? NO_TRIP);
  const amount = parseAmount(amountText, currency);
  const amountError = amountText.trim() && amount === null ? t('expenses.amountInvalid') : null;

  const tripId = fixedTripId ?? (tripChoice === NO_TRIP ? null : tripChoice);

  const save = async () => {
    if (amount === null) return;
    const input = { amount, currency, category, date, comment, tripId };
    if (expense) await updateExpense(dbContext, expense.id, input);
    else await addExpense(dbContext, { ...input, countryIso });
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
            disabled={amount === null || !countryIso}
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
      {countries.length > 1 ? (
        <View style={styles.field}>
          <AppText variant="label">{t('expenses.country')}</AppText>
          <Chips
            options={countries.map((iso) => {
              const c = getCountry(iso);
              return {
                value: iso,
                label: c ? t('card.flagAndName', { flag: c.flag, name: c.name[lang] }) : iso,
              };
            })}
            value={countryIso}
            onChange={setCountryIso}
            accessibilityLabel={t('expenses.country')}
          />
        </View>
      ) : null}
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
      {!fixedTripId && tripOptions.length > 0 ? (
        <View style={styles.field}>
          <AppText variant="label">{t('expenses.trip')}</AppText>
          <Chips
            options={[
              { value: NO_TRIP, label: t('expenses.noTrip') },
              ...tripOptions.map((trip) => ({ value: trip.id, label: trip.title })),
            ]}
            value={tripChoice}
            onChange={setTripChoice}
            accessibilityLabel={t('expenses.trip')}
          />
        </View>
      ) : null}
      <TextField
        label={t('expenses.comment')}
        value={comment}
        onChangeText={setComment}
        placeholder={t('expenses.commentPlaceholder')}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
});
