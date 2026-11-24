/**
 * Анімація заливки країн золотом на глобусі (docs/SPEC.md: ~600 мс).
 * Чистий модуль: годинник, кадри й запис стану передаються ззовні — тестується в Node.
 */

export const FILL_MS = 600;
export const UNFILL_MS = 300;

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

type Animation = { from: number; to: number; start: number; duration: number };

export type FillAnimatorDeps = {
  /** Записати рівень заливки країни: 0 — тьмяна, 1 — золота */
  setFill: (iso: string, value: number) => void;
  now: () => number;
  requestFrame: (cb: (now: number) => void) => void;
};

export function createFillAnimator(deps: FillAnimatorDeps) {
  const current = new Map<string, number>();
  const running = new Map<string, Animation>();
  let visited = new Set<string>();
  let first = true;
  let scheduled = false;

  function set(iso: string, value: number) {
    current.set(iso, value);
    deps.setFill(iso, value);
  }

  function step(now: number) {
    scheduled = false;
    for (const [iso, a] of running) {
      const t = Math.min(1, Math.max(0, (now - a.start) / a.duration));
      set(iso, a.from + (a.to - a.from) * easeOutCubic(t));
      if (t >= 1) running.delete(iso);
    }
    schedule();
  }

  function schedule() {
    if (scheduled || running.size === 0) return;
    scheduled = true;
    deps.requestFrame(step);
  }

  function animate(iso: string, to: number) {
    const from = current.get(iso) ?? 0;
    running.set(iso, {
      from,
      to,
      start: deps.now(),
      duration: to > from ? FILL_MS : UNFILL_MS,
    });
    schedule();
  }

  return {
    /** Новий набір відвіданих. Перший виклик — без анімації (стан при відкритті). */
    setVisited(next: ReadonlySet<string>) {
      const animated = !first;
      first = false;
      for (const iso of visited) {
        if (!next.has(iso)) {
          if (animated) animate(iso, 0);
          else set(iso, 0);
        }
      }
      for (const iso of next) {
        if (!visited.has(iso)) {
          if (animated) animate(iso, 1);
          else set(iso, 1);
        }
      }
      visited = new Set(next);
    },
    /** Чи йде зараз анімація (для тестів) */
    isAnimating: () => running.size > 0,
  };
}
