/**
 * Форматування дат візитів: «бер. 2024, серп. 2025».
 * Назви місяців передаються з i18n (`months.short`), а не з Intl — щоб формат був
 * однаковим на iOS і Android. Чистий модуль: без React і Expo (тестується в Node).
 */

/** Максимум періодів у рядку; решта — «+N». */
export const MAX_DATES_SHOWN = 3;

/** 'YYYY-MM-DD' → «бер. 2024». */
export function formatMonthYear(date: string, monthsShort: readonly string[]): string {
  const [y, m] = date.split('-');
  const month = monthsShort[Number(m) - 1];
  return month ? `${month} ${y}` : y;
}

/**
 * Дати початку візитів → «бер. 2024, серп. 2025, +2».
 * Порядок хронологічний, однаковий місяць не повторюється, візити без дат пропускаються.
 */
export function formatVisitDates(
  startDates: readonly (string | null)[],
  monthsShort: readonly string[],
): string {
  const months = [
    ...new Set(
      startDates.filter((d): d is string => !!d).map((d) => d.slice(0, 7)), // YYYY-MM
    ),
  ].sort();
  const shown = months
    .slice(0, MAX_DATES_SHOWN)
    .map((ym) => formatMonthYear(`${ym}-01`, monthsShort));
  const rest = months.length - shown.length;
  return rest > 0 ? `${shown.join(', ')}, +${rest}` : shown.join(', ');
}
