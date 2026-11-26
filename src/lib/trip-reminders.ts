/**
 * Нагадування перед поїздкою — локальні сповіщення (expo-notifications): телефон планує їх
 * сам, без сервера й push-сервісів, тож вони працюють офлайн і нічого не коштують.
 * За місяць, тиждень, 3 дні й день до початку о 9:00 (див. src/lib/trips.ts).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getCountry } from '@/data/countries';
import i18n, { type Language } from '@/i18n';
import { toIsoDate } from '@/lib/dates';
import { REMINDER_HOUR, tripReminders } from '@/lib/trips';

const ID_PREFIX = 'trip-';
const CHANNEL = 'trips';

// Показувати сповіщення й тоді, коли додаток відкрито
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
});

export type ReminderTrip = {
  id: string;
  title: string;
  status: 'planned' | 'done' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
  countries: readonly string[];
};

/** Дозвіл на сповіщення: питаємо лише раз — при першій запланованій поїздці. */
export async function ensureReminderPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/**
 * Привести заплановані сповіщення у відповідність до поїздок: прибрати всі наші й поставити
 * актуальні. Викликається при зміні поїздок, мови чи перемикача в налаштуваннях.
 */
export async function syncTripReminders(
  trips: readonly ReminderTrip[],
  enabled: boolean,
): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(ID_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    if (!enabled) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: i18n.t('reminders.channel'),
        // AndroidImportance.DEFAULT (= 5). Енум реекспортовано з .types-файла, і
        // eslint import/namespace його не бачить — беремо значення з типізацією.
        importance: 5 as Notifications.AndroidImportance,
      });
    }

    const now = new Date();
    const byId = new Map(trips.map((trip) => [trip.id, trip]));
    const lang = (i18n.resolvedLanguage === 'uk' ? 'uk' : 'en') as Language;
    for (const reminder of tripReminders(trips, toIsoDate(now), now.getHours())) {
      const trip = byId.get(reminder.tripId);
      if (!trip) continue;
      const [y, m, d] = reminder.date.split('-').map(Number);
      const countries = trip.countries
        .map((iso) => {
          const c = getCountry(iso);
          return c ? `${c.flag} ${c.name[lang]}` : iso;
        })
        .join(', ');
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: i18n.t('reminders.title', { count: reminder.daysBefore, trip: trip.title }),
          body: countries,
          data: { tripId: trip.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(y, m - 1, d, REMINDER_HOUR),
          channelId: CHANNEL,
        },
      });
    }
  } catch (error) {
    console.warn('[reminders] sync failed', error);
  }
}
