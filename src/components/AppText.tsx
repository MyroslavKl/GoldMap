import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts, fontSizes } from '@/theme';

type Variant = 'counter' | 'title' | 'heading' | 'body' | 'muted' | 'label';

type Props = TextProps & {
  variant?: Variant;
};

/**
 * Базовий текст з типографікою теми.
 * Вміст — лише з i18n: <AppText>{t('key')}</AppText>.
 */
export function AppText({ variant = 'body', style, ...rest }: Props) {
  return <Text style={[styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  counter: {
    fontFamily: fonts.serifBold,
    fontSize: fontSizes.counter,
    color: colors.gold,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: fontSizes.xl,
    color: colors.gold,
  },
  heading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  muted: {
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
