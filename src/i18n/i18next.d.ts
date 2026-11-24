import 'i18next';

import type en from './en.json';

/** Типізовані ключі перекладів: t('tabs.globe') перевіряється компілятором. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
    returnNull: false;
  }
}
