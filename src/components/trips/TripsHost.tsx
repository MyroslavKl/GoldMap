import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { parseSetting, settingQuery, tripsForPopup } from '@/db';
import { expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import { syncTripReminders } from '@/lib/trip-reminders';
import { useToday, useTripQuestions, useTrips } from '@/lib/use-trips';

import { TripQuestionCard } from './TripQuestionCard';

/**
 * Фонова робота поїздок (рендериться один раз у корені):
 * - тримає локальні нагадування в актуальному стані;
 * - після кінця поїздки показує попап «Ви були в …?» (крім відкладених «Пізніше» до завтра);
 * - тап по нагадуванню відкриває поїздку.
 */
export function TripsHost() {
  const today = useToday();
  const lang = useLanguage();
  const trips = useTrips();
  const { awaiting, snooze } = useTripQuestions(today);
  const { data: reminderRows } = useLiveQuery(settingQuery(expoDb, 'tripReminders'));
  const remindersOn = parseSetting('tripReminders', reminderRows) ?? true;

  // Нагадування: переплановуємо, коли змінились поїздки, мова чи перемикач
  const remindersKey = JSON.stringify(
    trips.map((t) => [t.id, t.title, t.status, t.startDate, t.endDate, t.countries]),
  );
  useEffect(() => {
    void syncTripReminders(trips, remindersOn);
    // trips у залежностях через remindersKey — щоб не переплановувати на кожен рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindersKey, remindersOn, lang]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const tripId = (response.notification.request.content.data as { tripId?: unknown })?.tripId;
      if (typeof tripId === 'string') {
        router.push({ pathname: '/trip/[id]', params: { id: tripId } });
      }
    });
    return () => sub.remove();
  }, []);

  const next = tripsForPopup(awaiting, snooze, today)[0];
  if (!next) return null;
  // key: після відповіді на одну поїздку картка наступної починає зі свіжими галочками
  return <TripQuestionCard key={next.id} trip={next} today={today} onClose={() => {}} />;
}
