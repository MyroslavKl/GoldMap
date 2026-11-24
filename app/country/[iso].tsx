import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

/** Картка країни. Наповнення — на етапі 6. */
export default function CountryScreen() {
  const { t } = useTranslation();
  const { iso } = useLocalSearchParams<{ iso: string }>();

  return (
    <Screen title={t('country.title', { iso: iso.toUpperCase() })} edges={['bottom']}>
      <EmptyState text={t('common.comingSoon')} />
    </Screen>
  );
}
