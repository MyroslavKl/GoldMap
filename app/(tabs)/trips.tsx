import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

/** Вкладка «Поїздки». Список — на етапі 8. */
export default function TripsTab() {
  const { t } = useTranslation();

  return (
    <Screen title={t('trips.title')}>
      <EmptyState text={t('trips.empty')} />
    </Screen>
  );
}
