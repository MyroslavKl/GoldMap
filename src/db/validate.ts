/** Перевірки вхідних даних для запитів. Кидають DbValidationError. */

export class DbValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbValidationError';
  }
}

export function assertIso2(iso: string): void {
  if (!/^[A-Z]{2}$/.test(iso)) throw new DbValidationError(`Некоректний ISO-код країни: «${iso}»`);
}

/** Дата 'YYYY-MM-DD', що реально існує (не 2025-02-30). */
export function assertDate(value: string, field: string): void {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!m || !d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    throw new DbValidationError(`${field}: очікується дата YYYY-MM-DD, отримано «${value}»`);
  }
}

export function assertDateRange(start?: string | null, end?: string | null): void {
  if (start) assertDate(start, 'startDate');
  if (end) assertDate(end, 'endDate');
  if (start && end && start > end) {
    throw new DbValidationError(`Початок (${start}) пізніше за кінець (${end})`);
  }
}
