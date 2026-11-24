import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';

/**
 * Шрифти вшиті в додаток (працюють офлайн), обидва підтримують кирилицю.
 * Заголовки й лічильник — Lora (м'який серифний), текст — Inter.
 */
export const fontAssets = {
  Lora_600SemiBold,
  Lora_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
};

export const fonts = {
  serif: 'Lora_600SemiBold',
  serifBold: 'Lora_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
  counter: 56,
} as const;
