import { and, desc, eq, isNull } from 'drizzle-orm';

import type { AppDatabase, DbContext } from '../context.ts';
import { notes, type Note } from '../schema.ts';
import { assertIso2, DbValidationError } from '../validate.ts';

const active = isNull(notes.deletedAt);

/** Порожня нотатка не зберігається; пробіли по краях обрізаються. */
function cleanText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new DbValidationError('Нотатка порожня');
  return trimmed;
}

export async function addNote(
  ctx: DbContext,
  input: { countryIso: string; text: string; tripId?: string | null },
): Promise<Note> {
  assertIso2(input.countryIso);
  const ts = ctx.now();
  const row: Note = {
    id: ctx.newId(),
    countryIso: input.countryIso,
    tripId: input.tripId ?? null,
    text: cleanText(input.text),
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  await ctx.db.insert(notes).values(row);
  return row;
}

export async function updateNote(ctx: DbContext, id: string, text: string): Promise<void> {
  await ctx.db
    .update(notes)
    .set({ text: cleanText(text), updatedAt: ctx.now() })
    .where(and(eq(notes.id, id), active));
}

export async function removeNote(ctx: DbContext, id: string): Promise<void> {
  const ts = ctx.now();
  await ctx.db
    .update(notes)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(notes.id, id), active));
}

export async function restoreNote(ctx: DbContext, id: string): Promise<void> {
  await ctx.db.update(notes).set({ deletedAt: null, updatedAt: ctx.now() }).where(eq(notes.id, id));
}

/** Нотатки країни: щойно створені зверху. Для useLiveQuery. */
export function notesByCountryQuery(db: AppDatabase, countryIso: string) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.countryIso, countryIso), active))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}

export async function getNotesByCountry(ctx: DbContext, countryIso: string): Promise<Note[]> {
  return notesByCountryQuery(ctx.db, countryIso);
}
