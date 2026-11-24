import { DarkTheme, type Theme } from 'expo-router';

import { colors } from './colors';
import { fonts } from './fonts';

export { colors, goldAlpha, type ColorToken } from './colors';
export { fontAssets, fonts, fontSizes } from './fonts';
export { radius, spacing } from './spacing';

/** Тема для навігатора (фон екранів, заголовки, вкладки). */
export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.separator,
    notification: colors.gold,
  },
  fonts: {
    ...DarkTheme.fonts,
    regular: { fontFamily: fonts.sans, fontWeight: '400' },
    medium: { fontFamily: fonts.sansMedium, fontWeight: '500' },
    bold: { fontFamily: fonts.sansSemiBold, fontWeight: '600' },
    heavy: { fontFamily: fonts.serifBold, fontWeight: '700' },
  },
};
