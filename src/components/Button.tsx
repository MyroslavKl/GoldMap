import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  /** Компактна кнопка (у заголовку секції) */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: colors.bg,
  secondary: colors.text,
  danger: colors.danger,
  ghost: colors.gold,
};

/** Кнопка в стилі теми: золота головна, обведена другорядна, червона «Видалити». */
export function Button({
  label,
  onPress,
  variant = 'secondary',
  icon,
  disabled,
  small,
  style,
  accessibilityHint,
}: Props) {
  const color = TEXT_COLOR[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={small ? 8 : 0}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={color} /> : null}
      <AppText style={[styles.text, small && styles.smallText, { color }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  small: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  primary: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  secondary: {
    borderColor: colors.goldBorder,
  },
  danger: {
    borderColor: colors.danger,
  },
  ghost: {},
  text: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSizes.md,
  },
  smallText: {
    fontSize: fontSizes.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
