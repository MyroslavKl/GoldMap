import { eq } from 'drizzle-orm';

import type { DbContext } from '../context.ts';
import { settings } from '../schema.ts';

/** Відомі налаштування і типи їхніх значень. */
export type SettingValues = {
  /** Мова інтерфейсу */
  language: 'uk' | 'en';
  /** Основна валюта, ISO 4217 */
  currency: string;
  /** Знаменник лічильника: 193 члени ООН або всі території */
  countryListMode: 'un' | 'extended';
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
