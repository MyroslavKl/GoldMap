import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { getCountry } from '@/data/countries';
import { addTrip, parseSetting, settingQuery, updateTrip, type TripWithCountries } from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import { toIsoDate } from '@/lib/dates';
import { amountToInput, parseAmount } from '@/lib/money';
import { ensureReminderPermission } from '@/lib/trip-reminders';
import { useMoneySettings } from '@/lib/use-money-settings';
import { spacing } from '@/theme';

import { CountryPickerSheet } from './CountryPickerSheet';

type Props = {
  /** null — нова поїздка */
  trip: TripWithCountries | null;
  /** Країни нової поїздки наперед (кнопка «Запланувати» в картці країни) */
  initialCountries?: readonly string[];
  onSaved?: (tripId: string) => void;
  onClose: () => void;
};

/** Поїздка: назва, дати (можна майбутні), країни, бюджет, нотатки. */
export function TripSheet({ trip, initialCountries = [], onSaved, onClose }: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const { mainCurrency } = useMoneySettings();
  const { data: reminderRows } = useLiveQuery(settingQuery(expoDb, 'tripReminders'));

  const [countries, setCountries] = useState<string[]>(trip?.countries ?? [...initialCountries]);
  const [title, setTitle] = useState(
    trip?.title ?? (countries.length === 1 ? (getCountry(countries[0])?.name[lang] ?? '') : ''),
  );
  const [start, setStart] = useState<string | null>(trip?.startDate ?? null);
  const [end, setEnd] = useState<string | null>(trip?.endDate ?? null);
  const [currency, setCurrency] = useState(trip?.currency ?? mainCurrency);
  const [budgetText, setBudgetText] = useState(
    trip?.budget != null ? amountToInput(trip.budget, trip.currency ?? mainCurrency) : '',
  );
  const [notes, setNotes] = useState(trip?.notes ?? '');
  const [picking, setPicking] = useState(false);

  const budget = budgetText.trim() ? parseAmount(budgetText, currency) : null;
  const budgetInvalid = !!budgetText.trim() && budget === null;
  const datesInvalid = !!start && !!end && start > end;
  const canSave = !!title.trim() && countries.length > 0 && !budgetInvalid && !datesInvalid;

  const save = async () => {
    const input = {
      title,
      startDate: start,
      endDate: end,
      budget,
      currency: budget != null ? currency : null,
      notes,
      countries,
    };
    let id = trip?.id;
    if (trip) await updateTrip(dbContext, trip.id, input);
    else id = (await addTrip(dbContext, input)).id;
    // Дозвіл на нагадування питаємо при першій поїздці в майбутньому (якщо їх не вимкнули)
    const remindersOn = parseSetting('tripReminders', reminderRows) ?? true;
    if (remindersOn && start && start > toIsoDate(new Date())) await ensureReminderPermission();
    onClose();
    if (id) onSaved?.(id);
  };

  return (
    <Sheet
      visible
      title={trip ? t('trips.edit') : t('trips.new')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          label={t('common.save')}
          onPress={() => void save()}
          disabled={!canSave}
        />
      }>
      <TextField
        label={t('trips.name')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('trips.namePlaceholder')}
        autoFocus={!trip && !title}
      />

      <View style={styles.field}>
        <AppText variant="label">{t('trips.countries')}</AppText>
        {countries.length > 0 ? (
          <AppText>
            {countries
              .map((iso) => {
                const c = getCountry(iso);
                return c ? t('card.flagAndName', { flag: c.flag, name: c.name[lang] }) : iso;
              })
              .join(', ')}
          </AppText>
        ) : (
          <AppText variant="muted">{t('trips.noCountries')}</AppText>
        )}
        <Button
          small
          variant="ghost"
          icon="earth"
          label={countries.length ? t('trips.changeCountries') : t('trips.chooseCountries')}
          onPress={() => setPicking(true)}
          style={styles.left}
        />
      </View>

      <DateField
        label={t('trips.from')}
        value={start}
        onChange={setStart}
        optional
        maximumDate={end}
      />
      <DateField label={t('trips.to')} value={end} onChange={setEnd} optional minimumDate={start} />

      <TextField
        label={t('trips.budget')}
        value={budgetText}
        onChangeText={setBudgetText}
        keyboardType="decimal-pad"
        placeholder={t('trips.budgetPlaceholder')}
        error={budgetInvalid ? t('expenses.amountInvalid') : null}
      />
      {budgetText.trim() ? (
        <CurrencyPicker
          label={t('trips.budgetCurrency')}
          value={currency}
          onChange={setCurrency}
          suggestions={[mainCurrency, ...countries.map((iso) => getCountry(iso)?.currency)]}
        />
      ) : null}

      <TextField
        label={t('trips.notes')}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder={t('trips.notesPlaceholder')}
      />

      {picking ? (
        <CountryPickerSheet
          selected={countries}
          onDone={(list) => {
            setCountries(list);
            if (!title.trim() && list.length === 1) {
              setTitle(getCountry(list[0])?.name[lang] ?? '');
            }
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  left: {
    alignSelf: 'flex-start',
  },
});
