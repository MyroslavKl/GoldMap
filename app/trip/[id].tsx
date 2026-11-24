import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

/** Екран поїздки. Наповнення — на етапі 8. */
export default function TripScreen() {
  const { t } = useTranslation();

  return (
    <Screen edges={['bottom']}>
      <EmptyState text={t('common.comingSoon')} />
    </Screen>
  );
}
