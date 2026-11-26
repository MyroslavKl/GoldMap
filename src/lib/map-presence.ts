import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Скільки екранів з мінікартою відкрито поверх вкладок. Поки > 0, вкладка «Глобус» вивантажує
 * свою WebView: дві MapLibre-карти (кожна — окремий WebGL-контекст і ~3,5 МБ HTML)
 * одночасно тримати в пам'яті не варто, особливо на слабких Android.
 */
export const useMapPresence = create<{ countryScreens: number }>(() => ({ countryScreens: 0 }));

/** Лише потрібна частина навігатора стека (подія beforeRemove — початок закриття екрана). */
type StackEvents = { addListener(type: 'beforeRemove', callback: () => void): () => void };

/**
 * Викликати на екрані з мінікартою. Глобус звільняється одразу при відкритті екрана, а
 * повертається вже на початку закриття (beforeRemove) — щоб встиг намалюватися за анімацію.
 */
export function useHoldsMap(): void {
  const navigation = useNavigation<StackEvents>();
  useEffect(() => {
    let held = true;
    const release = () => {
      if (!held) return;
      held = false;
      useMapPresence.setState((s) => ({ countryScreens: Math.max(0, s.countryScreens - 1) }));
    };
    useMapPresence.setState((s) => ({ countryScreens: s.countryScreens + 1 }));
    const unsubscribe = navigation.addListener('beforeRemove', release);
    return () => {
      unsubscribe();
      release();
    };
  }, [navigation]);
}
