import '@/i18n';

import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DatabaseGate } from '@/components/DatabaseGate';
import { TripsHost } from '@/components/trips/TripsHost';
import { UndoToast } from '@/components/UndoToast';
import { cleanupDeletedPhotoFiles } from '@/lib/photos';
import { colors, fontAssets, navigationTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { t } = useTranslation();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const onDatabaseReady = useCallback(() => {
    void SplashScreen.hideAsync();
    // Файли фото, видалених до закриття додатку (поки ще було видно «Скасувати»)
    cleanupDeletedPhotoFiles().catch((e: unknown) => console.warn('[photos] cleanup failed', e));
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    // Корінь жестів — для свайпу рядків (react-native-gesture-handler)
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        <DatabaseGate onReady={onDatabaseReady}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="country/[iso]"
              // Звичайний перехід, не модальне вікно: поверх нього має бути видно «Скасувати»
              options={{ headerShown: true, title: '', headerBackButtonDisplayMode: 'minimal' }}
            />
            <Stack.Screen
              name="trip/[id]"
              options={{ headerShown: true, title: '', headerBackButtonDisplayMode: 'minimal' }}
            />
            <Stack.Screen
              name="inbox"
              options={{
                headerShown: true,
                title: t('inbox.title'),
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
          </Stack>
          <TripsHost />
          <UndoToast />
        </DatabaseGate>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
