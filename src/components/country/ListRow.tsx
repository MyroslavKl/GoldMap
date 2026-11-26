import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, fonts, radius, spacing } from '@/theme';

type Props = {
  title: string;
  subtitle?: string | null;
  /** Значення праворуч (сума витрати) */
  trailing?: string;
  /** Скільки рядків заголовка показувати (нотатки — 3) */
  titleLines?: number;
  onPress: () => void;
  accessibilityHint?: string;
};

/** Рядок списку в секції: тап відкриває редагування. */
export function ListRow({
  title,
  subtitle,
  trailing,
  titleLines = 1,
  onPress,
  accessibilityHint,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.text}>
        <AppText numberOfLines={titleLines}>{title}</AppText>
        {subtitle ? (
          <AppText variant="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? <AppText style={styles.trailing}>{trailing}</AppText> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    fontFamily: fonts.sansMedium,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.7,
  },
});
