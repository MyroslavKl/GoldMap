/** Єдина точка для вібрацій. Помилки (симулятор, вимкнено в системі) ігноруються. */
import * as Haptics from 'expo-haptics';

/** Країну позначено «був тут» */
export function hapticMarked(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Позначку знято */
export function hapticUnmarked(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Легкий відгук на вибір (перемикачі) */
export function hapticSelection(): void {
  Haptics.selectionAsync().catch(() => {});
}
