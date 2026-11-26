import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { findRate, parseRate, rateToInput, withRate, type Rates } from '@/lib/money';
import { saveExchangeRates } from '@/lib/use-money-settings';
import { fonts, spacing } from '@/theme';

type RatesSheetProps = {
  currencies: readonly string[];
  mainCurrency: string;
  rates: Rates;
  onClose: () => void;
};

/** Ручні курси: «1 EUR = [ ] UAH» для кожної валюти витрат, відмінної від основної. */
export function RatesSheet({ currencies, mainCurrency, rates, onClose }: RatesSheetProps) {
  const { t } = useTranslation();
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      currencies.map((c) => {
        const rate = findRate(rates, c, mainCurrency);
        return [c, rate === null ? '' : rateToInput(rate)];
      }),
    ),
  );
  const invalid = currencies.some((c) => texts[c]?.trim() && parseRate(texts[c]) === null);

  const save = async () => {
    const next = currencies.reduce<Rates>((acc, c) => {
      const text = texts[c]?.trim() ?? '';
      return withRate(acc, c, mainCurrency, text ? parseRate(text) : null);
    }, rates);
    await saveExchangeRates(next);
    onClose();
  };

  return (
    <Sheet
      visible
      title={t('expenses.ratesTitle')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          label={t('common.save')}
          onPress={() => void save()}
          disabled={invalid}
        />
      }>
      <AppText variant="muted">{t('expenses.ratesHint', { currency: mainCurrency })}</AppText>
      {currencies.map((c) => (
        <View key={c} style={styles.rateRow}>
          <AppText style={styles.rateLabel}>{t('expenses.rateOne', { currency: c })}</AppText>
          <View style={styles.rateInput}>
            <TextField
              value={texts[c] ?? ''}
              onChangeText={(text) => setTexts((s) => ({ ...s, [c]: text }))}
              keyboardType="decimal-pad"
              placeholder={t('expenses.ratePlaceholder')}
              accessibilityLabel={t('expenses.rateLabel', { from: c, to: mainCurrency })}
              error={
                texts[c]?.trim() && parseRate(texts[c]) === null ? t('expenses.rateInvalid') : null
              }
            />
          </View>
          <AppText style={styles.rateLabel}>{mainCurrency}</AppText>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rateLabel: {
    fontFamily: fonts.sansMedium,
  },
  rateInput: {
    flex: 1,
  },
});
