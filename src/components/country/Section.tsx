import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme';

type Props = {
  title: string;
  /** Кнопка «+ Додати» праворуч від заголовка */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  children: ReactNode;
};

/** Секція екрана країни: заголовок, дія, вміст. */
export function Section({ title, actionLabel, onAction, actionDisabled, children }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="label" accessibilityRole="header">
          {title}
        </AppText>
        {actionLabel && onAction ? (
          <Button
            small
            variant="ghost"
            icon="add"
            label={actionLabel}
            onPress={onAction}
            disabled={actionDisabled}
          />
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
});
