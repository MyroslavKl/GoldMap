// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

const COLOR_MESSAGE = 'Кольори — тільки з src/theme (colors.*). Див. CLAUDE.md.';
const TEXT_MESSAGE = 'Текст для користувача — тільки через i18n (t(...)). Див. CLAUDE.md.';

/** Принцип: жодних кольорів прямо в компонентах. */
const NO_INLINE_COLORS = [
  {
    selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
    message: COLOR_MESSAGE,
  },
  {
    selector: 'Literal[value=/^(?:rgb|rgba|hsl|hsla)\\(/i]',
    message: COLOR_MESSAGE,
  },
  {
    selector: 'TemplateLiteral > TemplateElement[value.raw=/(?:rgb|rgba|hsl|hsla)\\(/i]',
    message: COLOR_MESSAGE,
  },
  {
    selector: 'Property[key.name=/[cC]olor$/] > Literal[value=/^(?!transparent$)[a-z]+$/]',
    message: COLOR_MESSAGE,
  },
];

/**
 * jsx-no-literals з ignoreProps пропускає пропси, але ці користувач бачить або чує (VoiceOver).
 * Рядок з літерами в них — помилка; t('...') — ні.
 */
const NO_PROP_TEXTS = [
  {
    selector:
      'JSXAttribute[name.name=/^(placeholder|accessibilityLabel|accessibilityHint|title|label)$/] > Literal[value=/[A-Za-zА-Яа-яІіЇїЄєҐґ]/]',
    message: TEXT_MESSAGE,
  },
];

// У flat-конфігу пізніший `no-restricted-syntax` ЗАМІНЮЄ попередній для тих самих файлів,
// тому для .tsx/.jsx обидва набори правил задаються разом.
module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*', 'node_modules/*'],
  },
  {
    files: ['**/*.{ts,js}'],
    ignores: ['src/theme/**', 'eslint.config.js'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_INLINE_COLORS],
    },
  },
  {
    files: ['**/*.{tsx,jsx}'],
    ignores: ['src/theme/**'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_INLINE_COLORS, ...NO_PROP_TEXTS],
      // Принцип: увесь видимий текст — через i18n (t('key')).
      'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }],
    },
  },
]);
