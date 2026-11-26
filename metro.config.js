// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Міграції Drizzle — .sql; кордони для пошуку країни за GPS — .geojson.
// Обидва вшиваються рядками через babel-plugin-inline-import (див. babel.config.js).
config.resolver.sourceExts.push('sql', 'geojson');

module.exports = config;
