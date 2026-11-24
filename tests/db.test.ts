/**
 * Unit-тести бази: міграції та функції-запити. Запуск: npm run test:db
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import {
  addVisit,
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
    await addVisit(t, { countryIso: 'IT' });
    await addVisit(t, { countryIso: 'IT', startDate: '2025-08-01' });
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
