import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

/** Вкладка «Країни». Список — на етапі 5. */
export default function CountriesTab() {
  const { t } = useTranslation();

  return (
    <Screen title={t('countries.title')}>
      <EmptyState text={t('countries.empty')} />
    </Screen>
  );
}
