import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { spacing } from '@/theme';

/** Вкладка «Глобус». GlobeView з'явиться на етапі 4, лічильник з бази — на етапі 3. */
export default function GlobeTab() {
  const { t } = useTranslation();

  return (
    <Screen>
      <View style={styles.counter}>
        <AppText variant="counter">{t('globe.counter', { visited: 0, total: 193 })}</AppText>
      </View>
      <EmptyState text={t('globe.placeholder')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  counter: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
});
