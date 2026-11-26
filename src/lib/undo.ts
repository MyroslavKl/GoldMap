import { create } from 'zustand';

/** Скільки секунд видно «Скасувати» після видалення. */
export const UNDO_MS = 5000;

type Pending = {
  id: number;
  message: string;
  /** Повернути видалене (deleted_at = null) */
  undo: () => Promise<void> | void;
  /** Час на скасування минув — остаточні дії (напр. стерти файли фото) */
  commit?: () => Promise<void> | void;
};

type UndoState = { pending: Pending | null };

/** Стан сповіщення «… видалено · Скасувати» (UI-стан, тому Zustand, а не база). */
export const useUndoStore = create<UndoState>(() => ({ pending: null }));

let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function takePending(): Pending | null {
  const { pending } = useUndoStore.getState();
  if (timer) clearTimeout(timer);
  timer = null;
  useUndoStore.setState({ pending: null });
  return pending;
}

/**
 * Показати сповіщення після м'якого видалення. Нове сповіщення закриває попереднє
 * (його видалення стає остаточним).
 */
export function showUndo(options: Omit<Pending, 'id'>): void {
  void takePending()?.commit?.();
  const id = ++seq;
  useUndoStore.setState({ pending: { ...options, id } });
  timer = setTimeout(() => {
    if (useUndoStore.getState().pending?.id === id) void takePending()?.commit?.();
  }, UNDO_MS);
}

/** Натиснуто «Скасувати». */
export async function undoPending(): Promise<void> {
  await takePending()?.undo();
}

/** Закрити сповіщення без скасування (видалення остаточне). */
export function dismissUndo(): void {
  void takePending()?.commit?.();
}
