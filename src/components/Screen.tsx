import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, spacing } from '@/theme';

type Props = {
  title?: string;
  children?: ReactNode;
  /** За замовчуванням — лише верх: низ закриває панель вкладок. */
  edges?: Edge[];
};

/** Контейнер екрана: чорний фон, safe area, необов'язковий заголовок. */
export function Screen({ title, children, edges = ['top'] }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {title ? (
        <AppText variant="title" style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  title: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
