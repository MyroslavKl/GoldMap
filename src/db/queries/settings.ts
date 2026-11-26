import { and, eq, isNull } from 'drizzle-orm';

import type { AppDatabase, DbContext } from '../context.ts';
import { settings } from '../schema.ts';

/** Відомі налаштування і типи їхніх значень. */
export type SettingValues = {
  /** Мова інтерфейсу */
  language: 'uk' | 'en';
  /** Основна валюта, ISO 4217 */
  currency: string;
  /** Знаменник лічильника: 193 члени ООН або всі території */
  countryListMode: 'un' | 'extended';
  /**
   * Ручні курси для підсумку витрат: ключ 'EUR>UAH' — скільки UAH за 1 EUR.
   * Див. src/lib/money.ts (rateKey, convert).
   */
  exchangeRates: Record<string, number>;
  /** Фото з GPS, для яких людина пропустила пропозицію «створити точку» — більше не пропонуємо */
  skippedGpsPhotos: string[];
  /**
   * «Пізніше» в питанні після поїздки: id поїздки → дата 'YYYY-MM-DD', з якої попап знову
   * показується (до того питання видно лише в «Скриньці»).
   */
  tripQuestionSnooze: Record<string, string>;
  /** Нагадування перед поїздкою (за місяць, тиждень, 3 дні, день). За замовчуванням увімкнено */
  tripReminders: boolean;
};
export type SettingKey = keyof SettingValues;

export async function getSetting<K extends SettingKey>(
  ctx: DbContext,
  key: K,
): Promise<SettingValues[K] | null> {
  const [row] = await ctx.db
    .select({ value: settings.value, deletedAt: settings.deletedAt })
    .from(settings)
    .where(eq(settings.key, key));
  if (!row || row.deletedAt) return null;
  return JSON.parse(row.value) as SettingValues[K];
}

/** Записати налаштування (upsert). Значення зберігається як JSON. */
export async function setSetting<K extends SettingKey>(
  ctx: DbContext,
  key: K,
  value: SettingValues[K],
): Promise<void> {
  const ts = ctx.now();
  const json = JSON.stringify(value);
  await ctx.db
    .insert(settings)
    .values({ key, value: json, createdAt: ts, updatedAt: ts, deletedAt: null })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: json, updatedAt: ts, deletedAt: null },
    });
}

/** Рядок налаштування — для useLiveQuery; значення розбирає parseSetting. */
export function settingQuery(db: AppDatabase, key: SettingKey) {
  return db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.key, key), isNull(settings.deletedAt)));
}

/** Значення з рядків settingQuery, або null. */
export function parseSetting<K extends SettingKey>(
  _key: K,
  rows: readonly { value: string }[],
): SettingValues[K] | null {
  const row = rows[0];
  return row ? (JSON.parse(row.value) as SettingValues[K]) : null;
}
