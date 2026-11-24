import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { hapticSelection } from '@/lib/haptics';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Компактний вигляд (для другорядних перемикачів, напр. сортування) */
  size?: 'md' | 'sm';
};

/** Перемикач-сегменти в кольорах теми. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: Props<T>) {
  return (
    <View style={[styles.root, size === 'sm' && styles.rootSm]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (active) return;
              hapticSelection();
              onChange(o.value);
            }}
            style={[styles.item, size === 'sm' && styles.itemSm, active && styles.itemActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}>
            <AppText
              numberOfLines={1}
              style={[styles.label, size === 'sm' && styles.labelSm, active && styles.labelActive]}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldBorder,
  },
  rootSm: {
    backgroundColor: colors.transparent,
    borderWidth: 0,
    padding: 0,
    gap: spacing.xs,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  itemSm: {
    flex: 0,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  itemActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  labelSm: {
    fontSize: fontSizes.xs,
  },
  labelActive: {
    color: colors.bg,
  },
});
