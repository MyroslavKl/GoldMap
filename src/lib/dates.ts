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

/** Найпізніша дата початку візиту, або null, якщо дат немає. */
export function lastVisitDate(startDates: readonly (string | null)[]): string | null {
  let last: string | null = null;
  for (const d of startDates) if (d && (!last || d > last)) last = d;
  return last;
}

/** Date → 'YYYY-MM-DD' за місцевим часом телефону (те, що людина бачить у календарі). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → Date опівдні місцевого часу (опівдні — щоб перехід на літній час не зсунув день). */
export function fromIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** 'YYYY-MM-DD' → «15 бер. 2024». */
export function formatDay(date: string, monthsShort: readonly string[]): string {
  const [y, m, d] = date.split('-');
  const month = monthsShort[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

/**
 * Період візиту для рядка списку: «3 – 10 бер. 2024», «28 лют. – 3 бер. 2024»,
 * «30 груд. 2023 – 2 січ. 2024», або одна дата, якщо кінця немає чи він той самий день.
 * Повертає null, якщо дат немає зовсім.
 */
export function formatPeriod(
  start: string | null,
  end: string | null,
  monthsShort: readonly string[],
): string | null {
  if (!start && !end) return null;
  if (!start || !end || start === end) return formatDay((start ?? end)!, monthsShort);
  const [sy, sm, sd] = start.split('-');
  const [ey, em] = end.split('-');
  if (sy !== ey) return `${formatDay(start, monthsShort)} – ${formatDay(end, monthsShort)}`;
  if (sm !== em) {
    const startMonth = monthsShort[Number(sm) - 1] ?? sm;
    return `${Number(sd)} ${startMonth} – ${formatDay(end, monthsShort)}`;
  }
  return `${Number(sd)} – ${formatDay(end, monthsShort)}`;
}

/** Кількість днів візиту включно: 3–10 березня → 8. */
export function periodDays(start: string, end: string): number {
  const ms = Date.UTC(...ymd(end)) - Date.UTC(...ymd(start));
  return Math.round(ms / 86_400_000) + 1;
}

function ymd(value: string): [number, number, number] {
  const [y, m, d] = value.split('-').map(Number);
  return [y, m - 1, d];
}
