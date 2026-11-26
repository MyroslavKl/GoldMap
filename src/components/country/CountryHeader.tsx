import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CountryOutline } from '@/components/CountryOutline';
import type { Country } from '@/data/types';
import { useLanguage } from '@/i18n';
import { spacing } from '@/theme';

const OUTLINE_SIZE = 140;

type Props = {
  country: Country;
  visited: boolean;
  onToggleVisited: () => void;
};

/** Шапка екрана країни: золотий силует, прапор і назва, столиця, континент, валюта, «Був тут». */
export function CountryHeader({ country, visited, onToggleVisited }: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const facts = [
    country.capital ? t('country.capital', { capital: country.capital[lang] }) : null,
    t(`continents.${country.continent}`),
    country.currency ? t('country.currency', { currency: country.currency }) : null,
  ].filter((f): f is string => !!f);

  return (
    <View style={styles.root}>
      <View style={styles.outline}>
        <CountryOutline iso2={country.iso2} filled={visited} size={OUTLINE_SIZE} />
      </View>
      <AppText variant="title" style={styles.center} accessibilityRole="header">
        {t('card.flagAndName', { flag: country.flag, name: country.name[lang] })}
      </AppText>
      <AppText variant="muted" style={styles.center}>
        {facts.join(' · ')}
      </AppText>
      {!country.unMember ? (
        <AppText variant="muted" style={styles.center}>
          {t('card.territory')}
        </AppText>
      ) : null}
      <Button
        variant={visited ? 'secondary' : 'primary'}
        icon={visited ? 'checkmark' : undefined}
        label={visited ? t('card.visited') : t('card.markVisited')}
        onPress={onToggleVisited}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  outline: {
    height: OUTLINE_SIZE + spacing.md,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
});
