/**
 * Схема SQLite (docs/SPEC.md → «Модель даних»).
 *
 * Правила:
 * - id — UUID (text); дати — 'YYYY-MM-DD'; мітки часу — ISO 8601 UTC.
 * - Кожна таблиця має updated_at і deleted_at (м'яке видалення) — під синхронізацію у v2.
 * - Гроші — цілі числа в мінімальних одиницях (копійки, центи).
 * - Довідник країн у базі не зберігається: country_iso → src/data/countries.json.
 * - Зовнішніх ключів (REFERENCES) свідомо немає: при синхронізації рядки можуть приходити
 *   в довільному порядку, а видалення — м'які. Цілісність тримають функції-запити.
 *
 * Після зміни схеми: npm run db:generate (створює нову міграцію в src/db/migrations).
 */
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
};

const id = () => text('id').primaryKey();

export const visits = sqliteTable(
  'visits',
  {
    id: id(),
    countryIso: text('country_iso').notNull(),
    startDate: text('start_date'),
    endDate: text('end_date'),
    ...timestamps,
  },
  (t) => [index('visits_country_idx').on(t.countryIso)],
);

export const TRIP_STATUSES = ['planned', 'done'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const trips = sqliteTable('trips', {
  id: id(),
  title: text('title').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  /** Мінімальні одиниці валюти `currency` */
  budget: integer('budget'),
  currency: text('currency'),
  status: text('status', { enum: TRIP_STATUSES }).notNull().default('planned'),
  notes: text('notes'),
  ...timestamps,
});

export const tripCountries = sqliteTable(
  'trip_countries',
  {
    tripId: text('trip_id').notNull(),
    countryIso: text('country_iso').notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.tripId, t.countryIso] }),
    index('trip_countries_country_idx').on(t.countryIso),
  ],
);

export const places = sqliteTable(
  'places',
  {
    id: id(),
    countryIso: text('country_iso').notNull(),
    tripId: text('trip_id'),
    title: text('title').notNull(),
    /** Може бути порожнім для місця «хочу відвідати», доданого без точки на карті */
    lat: real('lat'),
    lng: real('lng'),
    note: text('note'),
    isWishlist: integer('is_wishlist', { mode: 'boolean' }).notNull().default(false),
    visitedAt: text('visited_at'),
    /** QID Wikidata, якщо місце додано з пропозицій (src/data/landmarks.json) — без дублікатів */
    wikidataId: text('wikidata_id'),
    ...timestamps,
  },
  (t) => [index('places_country_idx').on(t.countryIso), index('places_trip_idx').on(t.tripId)],
);

export const photos = sqliteTable(
  'photos',
  {
    id: id(),
    countryIso: text('country_iso').notNull(),
    placeId: text('place_id'),
    /** Шлях відносно documentDirectory (photos/…), не абсолютний URI */
    fileUri: text('file_uri').notNull(),
    thumbUri: text('thumb_uri').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    takenAt: text('taken_at'),
    lat: real('lat'),
    lng: real('lng'),
    ...timestamps,
  },
  (t) => [index('photos_country_idx').on(t.countryIso), index('photos_place_idx').on(t.placeId)],
);

export const notes = sqliteTable(
  'notes',
  {
    id: id(),
    /** Нотатка належить країні, поїздці або обом */
    countryIso: text('country_iso'),
    tripId: text('trip_id'),
    text: text('text').notNull(),
    ...timestamps,
  },
  (t) => [index('notes_country_idx').on(t.countryIso), index('notes_trip_idx').on(t.tripId)],
);

export const EXPENSE_CATEGORIES = [
  'transport',
  'lodging',
  'food',
  'entertainment',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenses = sqliteTable(
  'expenses',
  {
    id: id(),
    countryIso: text('country_iso').notNull(),
    tripId: text('trip_id'),
    /** Мінімальні одиниці валюти (копійки, центи) */
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    category: text('category', { enum: EXPENSE_CATEGORIES }).notNull(),
    date: text('date').notNull(),
    comment: text('comment'),
    ...timestamps,
  },
  (t) => [index('expenses_country_idx').on(t.countryIso), index('expenses_trip_idx').on(t.tripId)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  ...timestamps,
});

export type Visit = typeof visits.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type Place = typeof places.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
