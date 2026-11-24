// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

const COLOR_MESSAGE = 'Кольори — тільки з src/theme (colors.*). Див. CLAUDE.md.';

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*', 'node_modules/*'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    ignores: ['src/theme/**', 'eslint.config.js'],
    rules: {
      // Принцип: жодних кольорів прямо в компонентах.
      'no-restricted-syntax': [
        'error',
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
      ],
    },
  },
  {
    files: ['**/*.{tsx,jsx}'],
    rules: {
      // Принцип: увесь видимий текст — через i18n (t('key')).
      'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }],
    },
  },
]);
