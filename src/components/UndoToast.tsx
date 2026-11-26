import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { dismissUndo, undoPending, useUndoStore } from '@/lib/undo';
import { colors, fonts, radius, spacing } from '@/theme';

/** Сповіщення «… видалено · Скасувати» внизу екрана. Рендериться один раз у корені. */
export function UndoToast() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pending = useUndoStore((s) => s.pending);
  if (!pending) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + spacing.md }]}
      accessibilityLiveRegion="polite">
      <Animated.View
        key={pending.id}
        entering={FadeInDown.duration(200).reduceMotion(ReduceMotion.System)}
        exiting={FadeOutDown.duration(150).reduceMotion(ReduceMotion.System)}
        style={styles.toast}>
        <Pressable
          style={styles.message}
          onPress={dismissUndo}
          accessibilityRole="button"
          accessibilityHint={t('undo.dismiss')}>
          <AppText numberOfLines={2}>{pending.message}</AppText>
        </Pressable>
        <Pressable
          onPress={() => void undoPending()}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button">
          <AppText style={styles.actionText}>{t('undo.action')}</AppText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldBorder,
  },
  message: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  action: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    color: colors.gold,
    fontFamily: fonts.sansSemiBold,
  },
  pressed: {
    opacity: 0.7,
  },
});
