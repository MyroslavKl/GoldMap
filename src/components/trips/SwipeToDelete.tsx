import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AppText } from '@/components/AppText';
import { colors, fonts, radius, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  onDelete: () => void;
};

/**
 * Рядок, який можна потягнути вліво — з'являється «Видалити». Видалення м'яке, з
 * «Скасувати» (його показує onDelete), тож без додаткового підтвердження.
 * Для VoiceOver видалення — дія рядка (accessibilityActions у самому рядку).
 */
export function SwipeToDelete({ children, onDelete }: Props) {
  const { t } = useTranslation();

  const renderActions = (_p: unknown, _t: unknown, methods: SwipeableMethods) => (
    <Pressable
      onPress={() => {
        methods.close();
        onDelete();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('common.delete')}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <Ionicons name="trash-outline" size={20} color={colors.text} />
      <AppText style={styles.label}>{t('common.delete')}</AppText>
    </Pressable>
  );

  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderActions}>
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 96,
    marginLeft: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
