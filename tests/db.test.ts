/**
 * Unit-тести бази: міграції та функції-запити. Запуск: npm run test:db
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import {
  addExpense,
  addNote,
  addPhoto,
  addVisit,
  expenses,
  getExpensesByCountry,
  getNotesByCountry,
  getPhotosByCountry,
  getPhotosForFileCleanup,
  removeExpense,
  removeNote,
  removePhoto,
  restoreExpense,
  restoreNote,
  restorePhoto,
  restoreVisit,
  updateExpense,
  updateNote,
  type NewPhoto,
  getCountryContentSummary,
  getPlannedCountryIsos,
  needsUnmarkConfirmation,
  notes,
  photos,
  tripCountries,
  trips,
  computeCounter,
  getSetting,
  getVisitedCounter,
  getVisitedCountries,
  getVisitsByCountry,
  isCountryVisited,
  removeVisit,
  setCountryVisited,
  setSetting,
  updateVisitDates,
} from '../src/db/index.ts';
import { DbValidationError } from '../src/db/validate.ts';
import { createTestDb, type TestDb } from './helpers/test-db.ts';

let t: TestDb;
beforeEach(() => {
  t = createTestDb();
});

describe('міграції', () => {
  test('створюють усі таблиці моделі даних', () => {
    const tables = (
      t.sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as { name: string }[]
    ).map((r) => r.name);
    assert.deepEqual(tables, [
      'expenses',
      'notes',
      'photos',
      'places',
      'settings',
      'trip_countries',
      'trips',
      'visits',
    ]);
  });

  test('кожна таблиця має updated_at і deleted_at', () => {
    for (const table of [
      'expenses',
      'notes',
      'photos',
      'places',
      'settings',
      'trip_countries',
      'trips',
      'visits',
    ]) {
      const cols = (
        t.sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
      ).map((c) => c.name);
      assert.ok(cols.includes('updated_at'), `${table}.updated_at`);
      assert.ok(cols.includes('deleted_at'), `${table}.deleted_at`);
    }
  });
});

describe('addVisit', () => {
  test('додає візит з UUID, датами й мітками часу', async () => {
    const v = await addVisit(t, {
      countryIso: 'PL',
      startDate: '2024-03-01',
      endDate: '2024-03-10',
    });
    assert.match(v.id, /^[0-9a-f-]{36}$/);
    assert.equal(v.createdAt, '2026-01-01T12:00:00.000Z');
    assert.equal(v.updatedAt, v.createdAt);
    assert.equal(v.deletedAt, null);

    const [stored] = await getVisitsByCountry(t, 'PL');
    assert.deepEqual(stored, v);
  });

  test('дати необов’язкові', async () => {
    const v = await addVisit(t, { countryIso: 'FR' });
    assert.equal(v.startDate, null);
    assert.equal(v.endDate, null);
  });

  test('кілька візитів на країну; сортування: новіші зверху, без дат — у кінці', async () => {
    await addVisit(t, { countryIso: 'IT', startDate: '2023-05-01' });
    await addVisit(t, { countryIso: 'IT', startDate: '2025-08-01' });
    await addVisit(t, { countryIso: 'IT' });
    const list = await getVisitsByCountry(t, 'IT');
    assert.deepEqual(
      list.map((v) => v.startDate),
      ['2025-08-01', '2023-05-01', null],
    );
  });

  test('відхиляє некоректні ISO-коди й дати', async () => {
    for (const countryIso of ['ua', 'UKR', '', 'U1']) {
      await assert.rejects(addVisit(t, { countryIso }), DbValidationError, countryIso);
    }
    await assert.rejects(
      addVisit(t, { countryIso: 'UA', startDate: '2025-02-30' }),
      DbValidationError,
    );
    await assert.rejects(
      addVisit(t, { countryIso: 'UA', startDate: '01.03.2025' }),
      DbValidationError,
    );
    await assert.rejects(
      addVisit(t, { countryIso: 'UA', startDate: '2025-03-10', endDate: '2025-03-01' }),
      DbValidationError,
    );
    assert.equal((await getVisitedCountries(t)).length, 0);
  });
});

describe('updateVisitDates / removeVisit', () => {
  test('оновлення дат змінює updated_at', async () => {
    const v = await addVisit(t, { countryIso: 'ES' });
    t.tick();
    await updateVisitDates(t, v.id, { startDate: '2025-01-02', endDate: '2025-01-05' });
    const [u] = await getVisitsByCountry(t, 'ES');
    assert.equal(u.startDate, '2025-01-02');
    assert.equal(u.updatedAt, '2026-01-01T12:00:01.000Z');
    assert.equal(u.createdAt, v.createdAt);
  });

  test('видалення м’яке: рядок лишається з deleted_at, але зникає зі списків', async () => {
    const v = await addVisit(t, { countryIso: 'DE' });
    t.tick();
    await removeVisit(t, v.id);
    assert.deepEqual(await getVisitsByCountry(t, 'DE'), []);
    assert.equal(await isCountryVisited(t, 'DE'), false);

    const raw = t.sqlite
      .prepare('SELECT deleted_at, updated_at FROM visits WHERE id = ?')
      .get(v.id) as {
      deleted_at: string;
      updated_at: string;
    };
    assert.equal(raw.deleted_at, '2026-01-01T12:00:01.000Z');
    assert.equal(raw.updated_at, raw.deleted_at);
  });

  test('видалений візит не можна «оживити» оновленням дат', async () => {
    const v = await addVisit(t, { countryIso: 'DE' });
    await removeVisit(t, v.id);
    await updateVisitDates(t, v.id, { startDate: '2025-01-01', endDate: null });
    assert.deepEqual(await getVisitsByCountry(t, 'DE'), []);
  });
});

describe('getVisitedCountries', () => {
  test('групує візити по країнах, рахує кількість і межі дат', async () => {
    await addVisit(t, { countryIso: 'PL', startDate: '2024-03-01' });
    await addVisit(t, { countryIso: 'PL', startDate: '2025-08-15' });
    await addVisit(t, { countryIso: 'PL' });
    await addVisit(t, { countryIso: 'CZ' });
    const removed = await addVisit(t, { countryIso: 'SK' });
    await removeVisit(t, removed.id);

    assert.deepEqual(await getVisitedCountries(t), [
      { countryIso: 'CZ', visitCount: 1, firstDate: null, lastDate: null },
      { countryIso: 'PL', visitCount: 3, firstDate: '2024-03-01', lastDate: '2025-08-15' },
    ]);
  });
});

describe('setCountryVisited', () => {
  test('true додає один візит без дат і не дублює', async () => {
    await setCountryVisited(t, 'GE', true);
    await setCountryVisited(t, 'GE', true);
    const list = await getVisitsByCountry(t, 'GE');
    assert.equal(list.length, 1);
    assert.equal(list[0].startDate, null);
  });

  test('true не додає візит, якщо країна вже відвідана з датами', async () => {
    await addVisit(t, { countryIso: 'GE', startDate: '2024-06-01' });
    await setCountryVisited(t, 'GE', true);
    assert.equal((await getVisitsByCountry(t, 'GE')).length, 1);
  });

  test('false м’яко видаляє всі візити країни, не чіпаючи інші', async () => {
    await addVisit(t, { countryIso: 'GE', startDate: '2024-06-01' });
    await addVisit(t, { countryIso: 'GE', startDate: '2025-06-01' });
    await addVisit(t, { countryIso: 'AM' });
    await setCountryVisited(t, 'GE', false);
    assert.equal(await isCountryVisited(t, 'GE'), false);
    assert.equal(await isCountryVisited(t, 'AM'), true);
  });
});

describe('лічильник', () => {
  const UN = new Set(['UA', 'PL', 'FR', 'DE']);

  test('computeCounter рахує унікальні країни зі списку', () => {
    assert.deepEqual(computeCounter(['UA', 'PL', 'UA'], UN), { visited: 2, total: 4 });
  });

  test('території поза списком (Гренландія) не йдуть у лічильник', () => {
    assert.deepEqual(computeCounter(['UA', 'GL'], UN), { visited: 1, total: 4 });
  });

  test('getVisitedCounter читає відвідані з бази, ігноруючи видалені', async () => {
    await addVisit(t, { countryIso: 'UA' });
    await addVisit(t, { countryIso: 'UA', startDate: '2025-01-01' });
    await addVisit(t, { countryIso: 'GL' });
    const pl = await addVisit(t, { countryIso: 'PL' });
    await removeVisit(t, pl.id);
    assert.deepEqual(await getVisitedCounter(t, UN), { visited: 1, total: 4 });
  });

  test('порожня база — 0 / total', async () => {
    assert.deepEqual(await getVisitedCounter(t, UN), { visited: 0, total: 4 });
  });
});

describe('settings', () => {
  test('немає значення — null', async () => {
    assert.equal(await getSetting(t, 'language'), null);
  });

  test('set + get з типами, повторний set оновлює значення', async () => {
    await setSetting(t, 'language', 'uk');
    await setSetting(t, 'countryListMode', 'extended');
    t.tick();
    await setSetting(t, 'language', 'en');
    assert.equal(await getSetting(t, 'language'), 'en');
    assert.equal(await getSetting(t, 'countryListMode'), 'extended');

    const raw = t.sqlite
      .prepare("SELECT created_at, updated_at FROM settings WHERE key = 'language'")
      .get() as {
      created_at: string;
      updated_at: string;
    };
    assert.notEqual(raw.created_at, raw.updated_at);
  });
});

/** Прямі вставки для таблиць, функції-запити до яких з'являться на етапах 6–8. */
function insertRow(table: 'photos' | 'notes' | 'expenses', countryIso: string) {
  const base = { id: t.newId(), createdAt: t.now(), updatedAt: t.now(), deletedAt: null };
  if (table === 'photos') {
    return t.db.insert(photos).values({
      ...base,
      countryIso,
      fileUri: 'photos/a.jpg',
      thumbUri: 'photos/a_t.jpg',
      width: 2000,
      height: 1500,
    });
  }
  if (table === 'notes') return t.db.insert(notes).values({ ...base, countryIso, text: 'x' });
  return t.db.insert(expenses).values({
    ...base,
    countryIso,
    amount: 12_50,
    currency: 'EUR',
    category: 'food',
    date: '2025-01-01',
  });
}

async function insertTrip(opts: { status: 'planned' | 'done'; isos: string[]; deleted?: boolean }) {
  const id = t.newId();
  const ts = t.now();
  await t.db.insert(trips).values({
    id,
    title: 'Trip',
    status: opts.status,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: opts.deleted ? ts : null,
  });
  for (const countryIso of opts.isos) {
    await t.db
      .insert(tripCountries)
      .values({ tripId: id, countryIso, createdAt: ts, updatedAt: ts, deletedAt: null });
  }
  return id;
}

describe('заплановані країни', () => {
  test('лише з активних поїздок зі статусом planned, без дублікатів', async () => {
    await insertTrip({ status: 'planned', isos: ['IT', 'FR'] });
    await insertTrip({ status: 'planned', isos: ['IT'] });
    await insertTrip({ status: 'done', isos: ['ES'] });
    await insertTrip({ status: 'planned', isos: ['PT'], deleted: true });
    assert.deepEqual(await getPlannedCountryIsos(t), ['FR', 'IT']);
  });

  test('м’яко видалена країна з поїздки не рахується', async () => {
    const id = await insertTrip({ status: 'planned', isos: ['GR'] });
    t.sqlite.prepare('UPDATE trip_countries SET deleted_at = ? WHERE trip_id = ?').run(t.now(), id);
    assert.deepEqual(await getPlannedCountryIsos(t), []);
  });
});

describe('зняття позначки «був» і підтвердження', () => {
  test('позначка без дат і без вмісту — підтвердження не потрібне', async () => {
    await setCountryVisited(t, 'HU', true);
    const s = await getCountryContentSummary(t, 'HU');
    assert.deepEqual(s, { datedVisits: 0, photos: 0, notes: 0, expenses: 0 });
    assert.equal(needsUnmarkConfirmation(s), false);
  });

  test('є дати візиту — потрібне підтвердження', async () => {
    await addVisit(t, { countryIso: 'HU', startDate: '2024-04-01' });
    assert.equal(needsUnmarkConfirmation(await getCountryContentSummary(t, 'HU')), true);
  });

  for (const table of ['photos', 'notes', 'expenses'] as const) {
    test(`є ${table} — потрібне підтвердження`, async () => {
      await setCountryVisited(t, 'HU', true);
      await insertRow(table, 'HU');
      const s = await getCountryContentSummary(t, 'HU');
      assert.equal(s[table], 1);
      assert.equal(needsUnmarkConfirmation(s), true);
    });
  }

  test('вміст інших країн не впливає', async () => {
    await insertRow('photos', 'AT');
    assert.equal(needsUnmarkConfirmation(await getCountryContentSummary(t, 'HU')), false);
  });

  test('зняття позначки видаляє візити, але НЕ фото, нотатки й витрати', async () => {
    await addVisit(t, { countryIso: 'HU', startDate: '2024-04-01' });
    await insertRow('photos', 'HU');
    await insertRow('notes', 'HU');
    await insertRow('expenses', 'HU');

    await setCountryVisited(t, 'HU', false);

    assert.equal(await isCountryVisited(t, 'HU'), false);
    const s = await getCountryContentSummary(t, 'HU');
    assert.deepEqual(s, { datedVisits: 0, photos: 1, notes: 1, expenses: 1 });
    for (const table of ['photos', 'notes', 'expenses']) {
      const row = t.sqlite
        .prepare(`SELECT deleted_at FROM ${table} WHERE country_iso = 'HU'`)
        .get() as {
        deleted_at: string | null;
      };
      assert.equal(row.deleted_at, null, `${table} видалено`);
    }
  });
});

describe('візит без дат і перший візит з датами', () => {
  test('«Був тут», потім візит з датами — заповнює той самий запис, а не створює другий', async () => {
    await setCountryVisited(t, 'PT', true);
    const [undated] = await getVisitsByCountry(t, 'PT');
    t.tick();

    const filled = await addVisit(t, {
      countryIso: 'PT',
      startDate: '2025-05-01',
      endDate: '2025-05-07',
    });

    const list = await getVisitsByCountry(t, 'PT');
    assert.equal(list.length, 1, 'другий візит не створено');
    assert.equal(filled.id, undated.id);
    assert.deepEqual(list[0], filled);
    assert.equal(list[0].startDate, '2025-05-01');
    assert.equal(list[0].endDate, '2025-05-07');
    assert.equal(list[0].createdAt, undated.createdAt);
    assert.equal(list[0].updatedAt, '2026-01-01T12:00:01.000Z');
  });

  test('наступний візит з датами — вже окремий запис', async () => {
    await setCountryVisited(t, 'PT', true);
    await addVisit(t, { countryIso: 'PT', startDate: '2025-05-01' });
    await addVisit(t, { countryIso: 'PT', startDate: '2025-11-10' });
    assert.deepEqual(
      (await getVisitsByCountry(t, 'PT')).map((v) => v.startDate),
      ['2025-11-10', '2025-05-01'],
    );
  });

  test('досить і однієї дати (лише кінець) — запис без дат теж заповнюється', async () => {
    await setCountryVisited(t, 'PT', true);
    await addVisit(t, { countryIso: 'PT', endDate: '2025-05-07' });
    const list = await getVisitsByCountry(t, 'PT');
    assert.equal(list.length, 1);
    assert.equal(list[0].endDate, '2025-05-07');
  });

  test('візит без дат не заповнює інший візит без дат; чужі країни й видалені не чіпаються', async () => {
    await setCountryVisited(t, 'PT', true);
    await addVisit(t, { countryIso: 'PT' });
    assert.equal((await getVisitsByCountry(t, 'PT')).length, 2);

    await setCountryVisited(t, 'ES', true);
    const removed = await addVisit(t, { countryIso: 'AD' });
    await removeVisit(t, removed.id);
    await addVisit(t, { countryIso: 'AD', startDate: '2024-01-01' });
    assert.equal((await getVisitsByCountry(t, 'ES'))[0].startDate, null);
    const ad = t.sqlite
      .prepare("SELECT COUNT(*) AS n FROM visits WHERE country_iso = 'AD'")
      .get() as {
      n: number;
    };
    assert.equal(ad.n, 2, 'видалений візит не «оживає»');
  });
});

describe('restoreVisit', () => {
  test('«Скасувати» повертає видалений візит і позначку країни', async () => {
    const v = await addVisit(t, { countryIso: 'NO', startDate: '2024-07-01' });
    await removeVisit(t, v.id);
    assert.equal(await isCountryVisited(t, 'NO'), false);
    await restoreVisit(t, v.id);
    assert.equal(await isCountryVisited(t, 'NO'), true);
    assert.equal((await getVisitsByCountry(t, 'NO'))[0].startDate, '2024-07-01');
  });
});

describe('фото', () => {
  const photo = (over: Partial<NewPhoto> = {}): NewPhoto => ({
    countryIso: 'JP',
    fileUri: 'photos/abc.jpg',
    thumbUri: 'photos/abc_t.jpg',
    width: 2000,
    height: 1500,
    ...over,
  });

  test('зберігає шляхи, розмір, дату зйомки й GPS з EXIF; id можна задати наперед', async () => {
    const p = await addPhoto(
      t,
      photo({ id: 'fixed-id', takenAt: '2024-04-02T10:11:12', lat: 35.6586, lng: 139.7454 }),
    );
    assert.equal(p.id, 'fixed-id');
    const [stored] = await getPhotosByCountry(t, 'JP');
    assert.deepEqual(stored, p);
    assert.equal(stored.takenAt, '2024-04-02T10:11:12');
    assert.equal(stored.lat, 35.6586);
    assert.equal(stored.lng, 139.7454);
  });

  test('без EXIF — дата й координати порожні', async () => {
    const p = await addPhoto(t, photo());
    assert.equal(p.takenAt, null);
    assert.equal(p.lat, null);
    assert.equal(p.lng, null);
  });

  test('відхиляє абсолютні шляхи, «..», нульовий розмір і половину координат', async () => {
    for (const bad of [
      photo({ fileUri: 'file:///var/mobile/photo.jpg' }),
      photo({ fileUri: 'photos/../goldmap.db' }),
      photo({ thumbUri: '/photos/a_t.jpg' }),
      photo({ width: 0 }),
      photo({ lat: 10 }),
      photo({ lat: 91, lng: 0 }),
      photo({ countryIso: 'jp' }),
    ]) {
      await assert.rejects(addPhoto(t, bad), DbValidationError, JSON.stringify(bad));
    }
    assert.deepEqual(await getPhotosByCountry(t, 'JP'), []);
  });

  test('сітка: за датою зйомки, без дати — у кінці за порядком додавання', async () => {
    await addPhoto(t, photo({ id: 'nodate1' }));
    t.tick();
    await addPhoto(t, photo({ id: 'late', takenAt: '2024-05-01T08:00:00' }));
    await addPhoto(t, photo({ id: 'early', takenAt: '2023-01-01T08:00:00' }));
    t.tick();
    await addPhoto(t, photo({ id: 'nodate2' }));
    assert.deepEqual(
      (await getPhotosByCountry(t, 'JP')).map((p) => p.id),
      ['early', 'late', 'nodate1', 'nodate2'],
    );
  });

  test('видалення м’яке, «Скасувати» повертає фото', async () => {
    const p = await addPhoto(t, photo());
    await removePhoto(t, p.id);
    assert.deepEqual(await getPhotosByCountry(t, 'JP'), []);
    await restorePhoto(t, p.id);
    assert.equal((await getPhotosByCountry(t, 'JP')).length, 1);
  });

  test('файли до прибирання — лише видалених раніше за межу', async () => {
    const old = await addPhoto(t, photo({ id: 'old', fileUri: 'photos/old.jpg' }));
    const fresh = await addPhoto(t, photo({ id: 'fresh', fileUri: 'photos/fresh.jpg' }));
    await addPhoto(t, photo({ id: 'alive' }));
    await removePhoto(t, old.id);
    t.tick(10 * 60_000);
    const cutoff = t.now();
    t.tick();
    await removePhoto(t, fresh.id);

    assert.deepEqual(await getPhotosForFileCleanup(t, cutoff), [
      { id: 'old', fileUri: 'photos/old.jpg', thumbUri: 'photos/abc_t.jpg' },
    ]);
  });
});

describe('нотатки', () => {
  test('додавання обрізає пробіли, порожню не зберігає', async () => {
    const n = await addNote(t, { countryIso: 'IS', text: '  Блакитна лагуна  ' });
    assert.equal(n.text, 'Блакитна лагуна');
    await assert.rejects(addNote(t, { countryIso: 'IS', text: '   ' }), DbValidationError);
    assert.equal((await getNotesByCountry(t, 'IS')).length, 1);
  });

  test('редагування змінює текст і updated_at; нові нотатки зверху', async () => {
    const first = await addNote(t, { countryIso: 'IS', text: 'перша' });
    t.tick();
    await addNote(t, { countryIso: 'IS', text: 'друга' });
    t.tick();
    await updateNote(t, first.id, 'перша, виправлена');
    const list = await getNotesByCountry(t, 'IS');
    assert.deepEqual(
      list.map((n) => n.text),
      ['друга', 'перша, виправлена'],
    );
    assert.equal(list[1].updatedAt, '2026-01-01T12:00:02.000Z');
    await assert.rejects(updateNote(t, first.id, ''), DbValidationError);
  });

  test('видалення м’яке, «Скасувати» повертає нотатку', async () => {
    const n = await addNote(t, { countryIso: 'IS', text: 'x' });
    await removeNote(t, n.id);
    assert.deepEqual(await getNotesByCountry(t, 'IS'), []);
    await restoreNote(t, n.id);
    assert.equal((await getNotesByCountry(t, 'IS'))[0].text, 'x');
  });
});

describe('витрати', () => {
  const expense = {
    countryIso: 'CZ',
    amount: 45_000,
    currency: 'CZK',
    category: 'lodging' as const,
    date: '2025-03-02',
  };

  test('кожна витрата зі своєю валютою; новіші зверху', async () => {
    await addExpense(t, expense);
    await addExpense(t, {
      ...expense,
      amount: 12_50,
      currency: 'EUR',
      category: 'food',
      date: '2025-03-04',
      comment: '  обід ',
    });
    const list = await getExpensesByCountry(t, 'CZ');
    assert.deepEqual(
      list.map((e) => [e.amount, e.currency, e.category, e.comment]),
      [
        [1250, 'EUR', 'food', 'обід'],
        [45000, 'CZK', 'lodging', null],
      ],
    );
  });

  test('відхиляє дробову, нульову чи від’ємну суму, біту валюту, категорію й дату', async () => {
    for (const bad of [
      { amount: 12.5 },
      { amount: 0 },
      { amount: -100 },
      { currency: 'eur' },
      { currency: 'EURO' },
      { category: 'shopping' as never },
      { date: '2025-02-30' },
    ]) {
      await assert.rejects(addExpense(t, { ...expense, ...bad }), DbValidationError);
    }
    assert.deepEqual(await getExpensesByCountry(t, 'CZ'), []);
  });

  test('редагування й «Скасувати» після видалення', async () => {
    const e = await addExpense(t, expense);
    await updateExpense(t, e.id, { ...expense, amount: 50_000, comment: '' });
    assert.equal((await getExpensesByCountry(t, 'CZ'))[0].amount, 50_000);
    await removeExpense(t, e.id);
    assert.deepEqual(await getExpensesByCountry(t, 'CZ'), []);
    await restoreExpense(t, e.id);
    assert.equal((await getExpensesByCountry(t, 'CZ'))[0].amount, 50_000);
  });
});

describe('ручні курси в налаштуваннях', () => {
  test('зберігаються словником пар валют', async () => {
    await setSetting(t, 'currency', 'UAH');
    await setSetting(t, 'exchangeRates', { 'EUR>UAH': 45, 'CZK>UAH': 1.8 });
    assert.deepEqual(await getSetting(t, 'exchangeRates'), { 'EUR>UAH': 45, 'CZK>UAH': 1.8 });
  });
});

describe('візит — лише минуле', () => {
  // Тестовий годинник: 2026-01-01T12:00Z
  test('дата в майбутньому відхиляється і при додаванні, і при зміні', async () => {
    await assert.rejects(
      addVisit(t, { countryIso: 'FI', startDate: '2026-12-06', endDate: '2026-12-10' }),
      DbValidationError,
    );
    await assert.rejects(
      addVisit(t, { countryIso: 'FI', startDate: '2025-12-28', endDate: '2026-02-01' }),
      DbValidationError,
      'кінець у майбутньому',
    );
    const v = await addVisit(t, { countryIso: 'FI', startDate: '2025-12-20' });
    await assert.rejects(
      updateVisitDates(t, v.id, { startDate: '2026-03-01', endDate: null }),
      DbValidationError,
    );
    assert.equal((await getVisitsByCountry(t, 'FI'))[0].startDate, '2025-12-20');
  });

  test('сьогодні можна; завтра за UTC теж (на телефоні в UTC+2 це вже може бути сьогодні)', async () => {
    await addVisit(t, { countryIso: 'FI', startDate: '2026-01-01' });
    await addVisit(t, { countryIso: 'EE', startDate: '2025-12-31', endDate: '2026-01-02' });
    await assert.rejects(
      addVisit(t, { countryIso: 'LV', startDate: '2026-01-03' }),
      DbValidationError,
    );
  });
});
