import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { Screen } from '@/components/Screen';
import { parseSetting, setSetting, settingQuery } from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { setLanguage, SUPPORTED_LANGUAGES } from '@/i18n';
import { ensureReminderPermission } from '@/lib/trip-reminders';
import { deviceMainCurrency, setMainCurrency, useMoneySettings } from '@/lib/use-money-settings';
import { colors, radius, spacing } from '@/theme';

/** Вкладка «Налаштування». Повний набір — на етапі 9. */
export default function SettingsTab() {
  const { t, i18n } = useTranslation();
  const version = Constants.expoConfig?.version ?? '';
  const { mainCurrency } = useMoneySettings();
  const { data: reminderRows } = useLiveQuery(settingQuery(expoDb, 'tripReminders'));
  const remindersOn = parseSetting('tripReminders', reminderRows) ?? true;
  const setReminders = async (on: boolean) => {
    await setSetting(dbContext, 'tripReminders', on);
    if (on) await ensureReminderPermission();
  };

  return (
    <Screen title={t('settings.title')}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <AppText variant="label">{t('settings.language')}</AppText>
          <View style={styles.row}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = i18n.resolvedLanguage === lang;
              return (
                <Pressable
                  key={lang}
                  onPress={() => void setLanguage(lang)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.pill, active && styles.pillActive]}>
                  <AppText style={active ? styles.pillTextActive : undefined}>
                    {t(`languages.${lang}`)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <CurrencyPicker
            label={t('settings.currency')}
            value={mainCurrency}
            onChange={(c) => void setMainCurrency(c)}
            suggestions={[deviceMainCurrency()]}
          />
          <AppText variant="muted">{t('settings.currencyHint')}</AppText>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <AppText style={styles.switchLabel}>{t('settings.reminders')}</AppText>
            <Switch
              value={remindersOn}
              onValueChange={(on) => void setReminders(on)}
              trackColor={{ true: colors.gold, false: colors.surfaceRaised }}
              thumbColor={colors.text}
              ios_backgroundColor={colors.surfaceRaised}
              accessibilityLabel={t('settings.reminders')}
            />
          </View>
          <AppText variant="muted">{t('settings.remindersHint')}</AppText>
        </View>

        <AppText variant="muted" style={styles.version}>
          {t('settings.version', { version })}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  section: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: {
    flex: 1,
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  pillTextActive: {
    color: colors.bg,
  },
  version: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
    textAlign: 'center',
  },
});
