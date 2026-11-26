/**
 * Гроші: цілі мінімальні одиниці (копійки, центи), ручні курси, підсумок витрат.
 * Чистий модуль без React і Expo (тестується в Node). Без Intl: однаково на iOS і Android.
 */

/** Валюти ISO 4217 без дробової частини. */
const ZERO_DECIMALS = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND',
  'VUV', 'XAF', 'XOF', 'XPF',
]); // prettier-ignore

/** Валюти ISO 4217 з трьома знаками після коми. */
const THREE_DECIMALS = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** Скільки знаків після коми має валюта (UAH — 2, JPY — 0, KWD — 3). */
export function currencyDigits(currency: string): number {
  if (ZERO_DECIMALS.has(currency)) return 0;
  if (THREE_DECIMALS.has(currency)) return 3;
  return 2;
}

export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

/**
 * Введений текст → мінімальні одиниці. «12,5» і «12.50» → 1250 (UAH); «1 200» → 120000.
 * null — якщо це не додатна сума або знаків після коми більше, ніж має валюта.
 */
export function parseAmount(text: string, currency: string): number | null {
  const clean = text.replace(/[\s  ]/g, '').replace(',', '.');
  const digits = currencyDigits(currency);
  const m = /^(\d+)(?:\.(\d*))?$/.exec(clean);
  if (!m) return null;
  const frac = m[2] ?? '';
  if (frac.length > digits) return null;
  const minor = Number(m[1]) * 10 ** digits + Number(frac.padEnd(digits, '0') || 0);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** Мінімальні одиниці → текст для поля вводу: 1250 → «12.50», без групування. */
export function amountToInput(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  if (digits === 0) return String(minor);
  const s = String(Math.abs(minor)).padStart(digits + 1, '0');
  return `${minor < 0 ? '-' : ''}${s.slice(0, -digits)}.${s.slice(-digits)}`;
}

export type NumberStyle = { group: string; decimal: string };

/** Українська: «1 234,50»; англійська: «1,234.50». */
export const NUMBER_STYLES: Record<'uk' | 'en', NumberStyle> = {
  uk: { group: ' ', decimal: ',' },
  en: { group: ',', decimal: '.' },
};

/**
 * Сума з кодом валюти: «1 234,50 UAH» / «1,234.50 UAH».
 * Нульові копійки не показуються: «300 EUR». Код, а не символ: $ буває різним.
 */
export function formatMoney(minor: number, currency: string, style: NumberStyle): string {
  const digits = currencyDigits(currency);
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 10 ** digits);
  const frac = abs % 10 ** digits;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, style.group);
  const fracPart = digits > 0 && frac > 0 ? style.decimal + String(frac).padStart(digits, '0') : '';
  return `${negative ? '-' : ''}${grouped}${fracPart} ${currency}`;
}

/** Ключ ручного курсу в налаштуваннях: 'EUR>UAH' = скільки UAH за 1 EUR. */
export function rateKey(from: string, to: string): string {
  return `${from}>${to}`;
}

export type Rates = Readonly<Record<string, number>>;

/** Курс from→to: прямий, або обернений до збереженого to→from. null — курсу немає. */
export function findRate(rates: Rates, from: string, to: string): number | null {
  if (from === to) return 1;
  const direct = rates[rateKey(from, to)];
  if (direct && direct > 0) return direct;
  const inverse = rates[rateKey(to, from)];
  if (inverse && inverse > 0) return 1 / inverse;
  return null;
}

/** Перевести суму в іншу валюту за ручним курсом (з округленням до мінімальної одиниці). */
export function convert(minor: number, from: string, to: string, rates: Rates): number | null {
  const rate = findRate(rates, from, to);
  if (rate === null) return null;
  const major = (minor / 10 ** currencyDigits(from)) * rate;
  return Math.round(major * 10 ** currencyDigits(to));
}

/**
 * Введений курс → число: «41,5» → 41.5. null — якщо не додатне число.
 */
export function parseRate(text: string): number | null {
  const clean = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return n > 0 && Number.isFinite(n) ? n : null;
}

/** Курс для поля вводу: без зайвих нулів, до 6 значущих знаків після коми. */
export function rateToInput(rate: number): string {
  return String(Number(rate.toFixed(6)));
}

export type MoneyItem<C extends string> = { amount: number; currency: string; category: C };

export type ExpenseSummary<C extends string> = {
  /** Основна валюта підсумку */
  currency: string;
  /** Сума всіх витрат, які вдалося перевести в основну валюту */
  total: number;
  /** Те саме за категоріями (в основній валюті) */
  byCategory: Map<C, number>;
  /**
   * Валюти без курсу до основної: суми в оригінальній валюті. Вони не входять у total —
   * екран показує їх окремо й пропонує ввести курс.
   */
  unconverted: Map<string, number>;
};

/** Підсумок витрат в основній валюті за ручними курсами. */
export function summarizeExpenses<C extends string>(
  items: readonly MoneyItem<C>[],
  mainCurrency: string,
  rates: Rates,
): ExpenseSummary<C> {
  let total = 0;
  const byCategory = new Map<C, number>();
  const unconverted = new Map<string, number>();
  for (const item of items) {
    const value = convert(item.amount, item.currency, mainCurrency, rates);
    if (value === null) {
      unconverted.set(item.currency, (unconverted.get(item.currency) ?? 0) + item.amount);
      continue;
    }
    total += value;
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + value);
  }
  return { currency: mainCurrency, total, byCategory, unconverted };
}

/** Валюти витрат, відмінні від основної (для екрана ручних курсів), за абеткою. */
export function foreignCurrencies(
  items: readonly { currency: string }[],
  mainCurrency: string,
): string[] {
  return [...new Set(items.map((i) => i.currency))].filter((c) => c !== mainCurrency).sort();
}

/**
 * Основна валюта за замовчуванням — за регіоном телефону: Україна → UAH, інакше USD.
 * Користувач змінює її в Налаштуваннях.
 */
export function defaultMainCurrency(regionCode: string | null | undefined): string {
  return regionCode?.toUpperCase() === 'UA' ? 'UAH' : 'USD';
}

/**
 * Новий словник курсів із курсом from→to (null — прибрати). Обернений to→from прибирається,
 * щоб для пари був один джерельний курс.
 */
export function withRate(rates: Rates, from: string, to: string, rate: number | null): Rates {
  const next: Record<string, number> = { ...rates };
  delete next[rateKey(to, from)];
  if (rate === null) delete next[rateKey(from, to)];
  else next[rateKey(from, to)] = rate;
  return next;
}
