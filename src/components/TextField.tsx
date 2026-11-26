import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  /** Текст помилки під полем */
  error?: string | null;
};

/** Поле вводу в стилі теми з підписом. */
export function TextField({ label, error, style, multiline, ...rest }: Props) {
  return (
    <View style={styles.root}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.gold}
        cursorColor={colors.gold}
        keyboardAppearance="dark"
        multiline={multiline}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        style={[styles.input, multiline && styles.multiline, !!error && styles.invalid, style]}
        {...rest}
      />
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  input: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.transparent,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
  },
  multiline: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  invalid: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: fontSizes.sm,
  },
});
