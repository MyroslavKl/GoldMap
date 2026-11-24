import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { getSetting } from '@/db';
import { dbContext, expoDb } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { applyLanguage } from '@/i18n';

type Props = {
  children: ReactNode;
  /** Викликається, коли база готова (або впала) — щоб сховати splash */
  onReady: () => void;
};

/**
 * Застосовує міграції й завантажує збережені налаштування перед показом додатку.
 * Поки йде міграція — нічого не рендерить (splash ще видно).
 */
export function DatabaseGate({ children, onReady }: Props) {
  const { t } = useTranslation();
  const { success, error } = useMigrations(expoDb, migrations);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (!success) return;
    getSetting(dbContext, 'language')
      .then((lang) => (lang ? applyLanguage(lang) : undefined))
      .catch((e: unknown) => console.warn('settings', e))
      .finally(() => setSettingsLoaded(true));
  }, [success]);

  const ready = (success && settingsLoaded) || !!error;
  useEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);

  if (error) {
    console.error('migrations', error);
    return (
      <Screen>
        <EmptyState text={t('errors.database')} />
      </Screen>
    );
  }
  if (!ready) return null;
  return children;
}
