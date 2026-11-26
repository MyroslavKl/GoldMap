/**
 * Поїздки: фаза (майбутня / триває / минула), дні до початку, порядок у списку, розклад
 * нагадувань. Чистий модуль без React і Expo (тестується в Node).
 */

export type TripDates = { startDate: string | null; endDate: string | null };
export type TripPhase = 'upcoming' | 'ongoing' | 'past' | 'undated';

/** Дні між датами 'YYYY-MM-DD' (b − a). */
export function daysBetween(a: string, b: string): number {
  const ms = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

export function tripPhase(trip: TripDates, today: string): TripPhase {
  const start = trip.startDate;
  const end = trip.endDate ?? trip.startDate;
  if (!start || !end) return 'undated';
  if (today < start) return 'upcoming';
  if (today > end) return 'past';
  return 'ongoing';
}

/** Скільки днів до початку (для «через 12 днів»); null — без дати або вже почалась. */
export function daysUntilStart(trip: TripDates, today: string): number | null {
  if (!trip.startDate || today >= trip.startDate) return null;
  return daysBetween(today, trip.startDate);
}

/**
 * Список поїздок: спершу ті, що тривають, далі майбутні (найближча зверху), без дат,
 * потім минулі (найсвіжіша зверху).
 */
export function splitTrips<T extends TripDates>(
  trips: readonly T[],
  today: string,
): { current: T[]; past: T[] } {
  const rank = { ongoing: 0, upcoming: 1, undated: 2, past: 3 } as const;
  const sorted = [...trips].sort((a, b) => {
    const pa = tripPhase(a, today);
    const pb = tripPhase(b, today);
    if (pa !== pb) return rank[pa] - rank[pb];
    const da = a.startDate ?? '';
    const db = b.startDate ?? '';
    return pa === 'past' ? db.localeCompare(da) : da.localeCompare(db);
  });
  return {
    current: sorted.filter((t) => tripPhase(t, today) !== 'past'),
    past: sorted.filter((t) => tripPhase(t, today) === 'past'),
  };
}

/** За скільки днів до початку нагадуємо */
export const REMINDER_DAYS = [30, 7, 3, 1] as const;
/** О котрій годині (місцевий час) приходить нагадування */
export const REMINDER_HOUR = 9;

export type Reminder = {
  /** Стабільний id — щоб перепланувати чи скасувати, нічого не зберігаючи */
  id: string;
  tripId: string;
  daysBefore: number;
  /** День нагадування 'YYYY-MM-DD' */
  date: string;
};

/** Дата 'YYYY-MM-DD' мінус n днів. */
export function minusDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

/**
 * Нагадування для запланованих поїздок: за місяць, тиждень, 3 дні й день до початку о
 * REMINDER_HOUR. Лише майбутні моменти: `now` — 'YYYY-MM-DD' і година зараз.
 */
export function tripReminders(
  trips: readonly (TripDates & { id: string; status: 'planned' | 'done' | 'cancelled' })[],
  today: string,
  hourNow: number,
): Reminder[] {
  const out: Reminder[] = [];
  for (const trip of trips) {
    if (trip.status !== 'planned' || !trip.startDate) continue;
    for (const daysBefore of REMINDER_DAYS) {
      const date = minusDays(trip.startDate, daysBefore);
      const future = date > today || (date === today && hourNow < REMINDER_HOUR);
      if (future)
        out.push({ id: `trip-${trip.id}-${daysBefore}`, tripId: trip.id, daysBefore, date });
    }
  }
  return out;
}
