import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { getLocales } from 'expo-localization';
import { useMemo } from 'react';

import { parseSetting, setSetting, settingQuery } from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import { defaultMainCurrency, NUMBER_STYLES, type Rates } from '@/lib/money';

/** Основна валюта, якщо людина ще не вибрала: за регіоном телефону. */
export function deviceMainCurrency(): string {
  return defaultMainCurrency(getLocales()[0]?.regionCode);
}

/** Основна валюта, ручні курси й формат чисел поточної мови — живі, з таблиці settings. */
export function useMoneySettings() {
  const lang = useLanguage();
  const { data: currencyRows } = useLiveQuery(settingQuery(expoDb, 'currency'));
  const { data: rateRows } = useLiveQuery(settingQuery(expoDb, 'exchangeRates'));
  return useMemo(() => {
    const rates: Rates = parseSetting('exchangeRates', rateRows) ?? {};
    return {
      mainCurrency: parseSetting('currency', currencyRows) ?? deviceMainCurrency(),
      rates,
      numberStyle: NUMBER_STYLES[lang],
    };
  }, [currencyRows, rateRows, lang]);
}

export function setMainCurrency(currency: string): Promise<void> {
  return setSetting(dbContext, 'currency', currency);
}

/** Зберегти словник ручних курсів (див. withRate у src/lib/money.ts). */
export function saveExchangeRates(rates: Rates): Promise<void> {
  return setSetting(dbContext, 'exchangeRates', { ...rates });
}
