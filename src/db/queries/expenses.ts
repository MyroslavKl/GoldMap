import { and, desc, eq, isNull } from 'drizzle-orm';

import type { AppDatabase, DbContext } from '../context.ts';
import { EXPENSE_CATEGORIES, expenses, type Expense, type ExpenseCategory } from '../schema.ts';
import { assertDate, assertIso2, DbValidationError } from '../validate.ts';

const active = isNull(expenses.deletedAt);

export type ExpenseInput = {
  /** Мінімальні одиниці валюти (копійки, центи), > 0 */
  amount: number;
  /** ISO 4217 */
  currency: string;
  category: ExpenseCategory;
  date: string;
  comment?: string | null;
};

function assertExpense(input: ExpenseInput): void {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new DbValidationError(
      `Сума — додатне ціле в мінімальних одиницях, отримано ${input.amount}`,
    );
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new DbValidationError(`Некоректний код валюти: «${input.currency}»`);
  }
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) {
    throw new DbValidationError(`Невідома категорія: «${input.category}»`);
  }
  assertDate(input.date, 'date');
}

function cleanComment(comment: string | null | undefined): string | null {
  const trimmed = comment?.trim();
  return trimmed ? trimmed : null;
}

export async function addExpense(
  ctx: DbContext,
  input: ExpenseInput & { countryIso: string; tripId?: string | null },
): Promise<Expense> {
  assertIso2(input.countryIso);
  assertExpense(input);
  const ts = ctx.now();
  const row: Expense = {
    id: ctx.newId(),
    countryIso: input.countryIso,
    tripId: input.tripId ?? null,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
    date: input.date,
    comment: cleanComment(input.comment),
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  await ctx.db.insert(expenses).values(row);
  return row;
}

export async function updateExpense(
  ctx: DbContext,
  id: string,
  input: ExpenseInput,
): Promise<void> {
  assertExpense(input);
  await ctx.db
    .update(expenses)
    .set({
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      date: input.date,
      comment: cleanComment(input.comment),
      updatedAt: ctx.now(),
    })
    .where(and(eq(expenses.id, id), active));
}

export async function removeExpense(ctx: DbContext, id: string): Promise<void> {
  const ts = ctx.now();
  await ctx.db
    .update(expenses)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(expenses.id, id), active));
}

export async function restoreExpense(ctx: DbContext, id: string): Promise<void> {
  await ctx.db
    .update(expenses)
    .set({ deletedAt: null, updatedAt: ctx.now() })
    .where(eq(expenses.id, id));
}

/** Витрати країни: новіші зверху. Для useLiveQuery. */
export function expensesByCountryQuery(db: AppDatabase, countryIso: string) {
  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.countryIso, countryIso), active))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
}

export async function getExpensesByCountry(ctx: DbContext, countryIso: string): Promise<Expense[]> {
  return expensesByCountryQuery(ctx.db, countryIso);
}
