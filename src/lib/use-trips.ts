import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
  groupTripCountries,
  parseSetting,
  settingQuery,
  tripCountriesQuery,
  tripsAwaitingAnswer,
  tripsQuery,
  type TripWithCountries,
} from '@/db';
import { expoDb } from '@/db/client';
import { toIsoDate } from '@/lib/dates';

/** Сьогоднішня дата 'YYYY-MM-DD'; оновлюється, коли додаток повертається з фону. */
export function useToday(): string {
  const [today, setToday] = useState(() => toIsoDate(new Date()));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toIsoDate(new Date()));
    });
    return () => sub.remove();
  }, []);
  return today;
}

/** Усі поїздки з країнами (живі дані). */
export function useTrips(): TripWithCountries[] {
  const { data: trips } = useLiveQuery(tripsQuery(expoDb));
  const { data: pairs } = useLiveQuery(tripCountriesQuery(expoDb));
  return useMemo(() => {
    const byTrip = groupTripCountries(pairs);
    return trips.map((trip) => ({ ...trip, countries: byTrip.get(trip.id) ?? [] }));
  }, [trips, pairs]);
}

/** Поїздки, що закінчились і чекають на «Чи були ви…?» (для «Скриньки» й лічильника). */
export function useTripQuestions(today: string) {
  const trips = useTrips();
  const { data: snoozeRows } = useLiveQuery(settingQuery(expoDb, 'tripQuestionSnooze'));
  return useMemo(
    () => ({
      awaiting: tripsAwaitingAnswer(trips, today),
      snooze: parseSetting('tripQuestionSnooze', snoozeRows) ?? {},
    }),
    [trips, today, snoozeRows],
  );
}
