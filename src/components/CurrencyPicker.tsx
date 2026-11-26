import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chips } from '@/components/Chips';
import { TextField } from '@/components/TextField';
import { isCurrencyCode } from '@/lib/money';
import { spacing } from '@/theme';

type Props = {
  label: string;
  value: string;
  onChange: (currency: string) => void;
  /** Швидкий вибір: валюта країни, основна, ост. використана… (дублікати прибираються) */
  suggestions: readonly (string | null | undefined)[];
};

const COMMON = ['UAH', 'EUR', 'USD'];

/** Валюта: кілька «пігулок» і поле для будь-якого коду ISO 4217. */
export function CurrencyPicker({ label, value, onChange, suggestions }: Props) {
  const { t } = useTranslation();
  const options = [...new Set([...suggestions, ...COMMON, value].filter((c): c is string => !!c))];
  const [custom, setCustom] = useState('');

  return (
    <View style={styles.root}>
      <AppText variant="label">{label}</AppText>
      <Chips
        options={options.map((c) => ({ value: c, label: c }))}
        value={value}
        onChange={(c) => {
          setCustom('');
          onChange(c);
        }}
        accessibilityLabel={label}
      />
      <TextField
        value={custom}
        onChangeText={(text) => {
          const code = text
            .toUpperCase()
            .replace(/[^A-Z]/g, '')
            .slice(0, 3);
          setCustom(code);
          if (isCurrencyCode(code)) onChange(code);
        }}
        placeholder={t('currency.otherPlaceholder')}
        accessibilityLabel={t('currency.other')}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
});
