// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Міграції Drizzle — .sql-файли.
config.resolver.sourceExts.push('sql');

module.exports = config;
