import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { spacing } from '@/theme';

type Props = {
  text: string;
};

/** Заглушка для порожнього екрана або списку. */
export function EmptyState({ text }: Props) {
  return (
    <View style={styles.root}>
      <AppText variant="muted" style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  text: {
    textAlign: 'center',
  },
});
