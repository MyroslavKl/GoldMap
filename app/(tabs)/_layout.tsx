import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { colors, fonts, fontSizes } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type TabIconProps = { color: ColorValue; focused: boolean; size: number };

function tabIcon(name: IconName, activeName: IconName) {
  return function TabIcon({ color, focused, size }: TabIconProps) {
    return <Ionicons name={focused ? activeName : name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.separator,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansMedium,
          fontSize: fontSizes.xs,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.globe'), tabBarIcon: tabIcon('globe-outline', 'globe') }}
      />
      <Tabs.Screen
        name="countries"
        options={{ title: t('tabs.countries'), tabBarIcon: tabIcon('flag-outline', 'flag') }}
      />
      <Tabs.Screen
        name="trips"
        options={{ title: t('tabs.trips'), tabBarIcon: tabIcon('airplane-outline', 'airplane') }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: tabIcon('settings-outline', 'settings'),
        }}
      />
    </Tabs>
  );
}
