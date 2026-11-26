import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { getCountry } from '@/data/countries';
import {
  getCountryContentSummary,
  needsUnmarkConfirmation,
  setCountryVisited,
  type CountryContentSummary,
} from '@/db';
import { dbContext } from '@/db/client';
import { useLanguage } from '@/i18n';
import { hapticMarked, hapticUnmarked } from '@/lib/haptics';

/**
 * Позначити / зняти позначку «був тут» — спільно для картки на глобусі й галочки у списку.
 * Якщо в країни вже є дати візитів, фото, нотатки чи витрати — спершу питає підтвердження.
 * Зняття видаляє лише візити; фото, нотатки й витрати лишаються.
 *
 * Повертає Promise<boolean>: чи змінився стан.
 */
export function useToggleVisited() {
  const { t } = useTranslation();
  const lang = useLanguage();

  return useCallback(
    async (iso2: string, currentlyVisited: boolean): Promise<boolean> => {
      if (!currentlyVisited) {
        await setCountryVisited(dbContext, iso2, true);
        hapticMarked();
        return true;
      }

      const summary = await getCountryContentSummary(dbContext, iso2);
      if (needsUnmarkConfirmation(summary)) {
        const confirmed = await confirmUnmark(
          t('unmark.title', { country: getCountry(iso2)?.name[lang] ?? iso2 }),
          t('unmark.message', { items: describeContent(summary, t) }),
          t('unmark.cancel'),
          t('unmark.confirm'),
        );
        if (!confirmed) return false;
      }
      await setCountryVisited(dbContext, iso2, false);
      hapticUnmarked();
      return true;
    },
    [t, lang],
  );
}

type T = ReturnType<typeof useTranslation>['t'];

function describeContent(s: CountryContentSummary, t: T): string {
  const parts: string[] = [];
  if (s.datedVisits) parts.push(t('unmark.datedVisits', { count: s.datedVisits }));
  if (s.photos) parts.push(t('unmark.photos', { count: s.photos }));
  if (s.places) parts.push(t('unmark.places', { count: s.places }));
  if (s.notes) parts.push(t('unmark.notes', { count: s.notes }));
  if (s.expenses) parts.push(t('unmark.expenses', { count: s.expenses }));
  return parts.join(', ');
}

function confirmUnmark(
  title: string,
  message: string,
  cancel: string,
  confirm: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirm, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
