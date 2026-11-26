module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Міграції Drizzle (src/db/migrations/*.sql) і кордони (src/data/borders.geojson)
    // вшиваються в бандл як рядки.
    plugins: [['inline-import', { extensions: ['.sql', '.geojson'] }]],
  };
};
