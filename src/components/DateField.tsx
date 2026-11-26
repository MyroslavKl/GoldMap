import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useLanguage } from '@/i18n';
import { formatDay, fromIsoDate, toIsoDate } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme';

type Props = {
  label: string;
  /** 'YYYY-MM-DD' або null */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Можна очистити (напр. «по» у візиті) */
  optional?: boolean;
  minimumDate?: string | null;
  maximumDate?: string | null;
};

const LOCALES = { uk: 'uk-UA', en: 'en-GB' } as const;

/**
 * Поле дати. Дата показується з місяцями з i18n; на Android тап відкриває системний
 * діалог, на iOS — розгортає календар під полем.
 */
export function DateField({ label, value, onChange, optional, minimumDate, maximumDate }: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const [open, setOpen] = useState(false);
  const months = t('months.short', { returnObjects: true });
  const current = value ? fromIsoDate(value) : fromIsoDate(minimumDate ?? toIsoDate(new Date()));
  const min = minimumDate ? fromIsoDate(minimumDate) : undefined;
  const max = maximumDate ? fromIsoDate(maximumDate) : undefined;

  const pick = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onValueChange: (_e, date) => onChange(toIsoDate(date)),
      });
    } else {
      if (!value) onChange(toIsoDate(current));
      setOpen((o) => !o);
    }
  };

  return (
    <View style={styles.root}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.row}>
        <Pressable
          onPress={pick}
          style={({ pressed }) => [styles.field, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: value ? formatDay(value, months) : t('dates.notSet') }}>
          <Ionicons name="calendar-outline" size={18} color={colors.gold} />
          <AppText style={!value && styles.placeholder}>
            {value ? formatDay(value, months) : t('dates.notSet')}
          </AppText>
        </Pressable>
        {optional && value ? (
          <Pressable
            onPress={() => {
              setOpen(false);
              onChange(null);
            }}
            hitSlop={8}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel={t('dates.clear', { label })}>
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {open && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={current}
          mode="date"
          display="inline"
          themeVariant="dark"
          accentColor={colors.gold}
          locale={LOCALES[lang]}
          minimumDate={min}
          maximumDate={max}
          onValueChange={(_e, date) => onChange(toIsoDate(date))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  placeholder: {
    color: colors.textMuted,
  },
  clear: {
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
});
