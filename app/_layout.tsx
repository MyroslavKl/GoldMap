import '@/i18n';

import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { DatabaseGate } from '@/components/DatabaseGate';
import { colors, fontAssets, navigationTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { t } = useTranslation();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const hideSplash = useCallback(() => void SplashScreen.hideAsync(), []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <DatabaseGate onReady={hideSplash}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="country/[iso]"
            options={{ presentation: 'modal', headerShown: true, title: '' }}
          />
          <Stack.Screen
            name="trip/[id]"
            options={{ presentation: 'modal', headerShown: true, title: t('trip.title') }}
          />
        </Stack>
      </DatabaseGate>
    </ThemeProvider>
  );
}
