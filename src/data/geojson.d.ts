/** src/data/borders.geojson імпортується як рядок (babel-plugin-inline-import). */
declare module '*.geojson' {
  const text: string;
  export default text;
}
