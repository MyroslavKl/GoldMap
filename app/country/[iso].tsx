import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { getCountry } from '@/data/countries';
import type { Language } from '@/i18n';

/** Картка країни. Наповнення — на етапі 6. */
export default function CountryScreen() {
  const { t, i18n } = useTranslation();
  const { iso } = useLocalSearchParams<{ iso: string }>();
  const country = getCountry(iso.toUpperCase());
  const lang = (i18n.resolvedLanguage ?? 'en') as Language;
  const title = country ? `${country.flag} ${country.name[lang]}` : t('country.unknown');

  return (
    <Screen title={title} edges={['bottom']}>
      <EmptyState text={t('common.comingSoon')} />
    </Screen>
  );
}
