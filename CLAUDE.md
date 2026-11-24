# Goldmap — правила проєкту

Мобільний трекер подорожей (iOS + Android): 3D-глобус, відвідані країни світяться золотом.
Повне ТЗ — `docs/SPEC.md`. Перед кожним етапом прочитай його; один етап = одна сесія = один коміт.

## Принципи (тримати завжди)

1. **Local-first.** Усі дані й фото — лише на телефоні (SQLite + `documentDirectory`).
   Жодного власного сервера у версії 1.
2. **Офлайн.** Глобус, список країн і всі записи працюють без інтернету. Довідкові дані
   (країни, кордони, міста), шрифти й іконки вшиті в додаток. Мережа — лише для детальних
   тайлів карти при наближенні.
3. **Без витрат зі зростом аудиторії.** Не підключати сервіси з оплатою за користувача
   (MAU, запити, місця) без окремого рішення автора. Сумніваєшся — спитай.
4. **Приватність.** Ніякої аналітики, реклами, трекінгу, crash-репортерів з передачею даних.
   Додаток не збирає даних про користувача.
5. **Кольори — тільки з `src/theme`.** У компонентах жодних `#hex`, `rgb()`, `'white'`:
   лише `colors.*` (і `goldAlpha()` для прозорості). Потрібен новий колір — додай токен у
   `src/theme/colors.ts`. Перевіряє ESLint (`no-restricted-syntax`).
6. **Тексти — тільки через i18n.** Увесь видимий текст — `t('key')`, ключі в `src/i18n/uk.json` і
   `src/i18n/en.json` (обидві мови одночасно, ключі типізовані за `en.json`). Літерали в JSX
   заборонені (`react/jsx-no-literals`). Те саме для accessibility-підписів і заголовків екранів.
7. **Кордони.** Крим і всі тимчасово окуповані території — це Україна (Natural Earth `_ukr`).
   Не змінювати без перевірки Сімферополя (44.95, 34.10) ∈ UA.

## Стек

Expo SDK 58 (React Native, TypeScript strict), expo-router. Далі за етапами: @rnmapbox/maps
через обгортку `GlobeView` (щоб замінити на MapLibre), expo-sqlite + Drizzle (міграції з першого
дня), Zustand лише для UI-стану, i18next + expo-localization.

- Пакети ставити **тільки** `npx expo install <pkg>` (сумісні з SDK версії).
- Expo змінюється з кожним SDK — не покладайся на пам'ять, звіряйся з
  `https://docs.expo.dev/versions/v58.0.0/`.
- `ios/` і `android/` генеруються (CNG) і в git не потрапляють. Нативні налаштування — через
  `app.json` і config-плагіни.
- Нативні модулі поза Expo Go (Mapbox тощо) потребують development build (EAS), не Expo Go.

## Структура

```
app/                  # маршрути expo-router (лише екрани й _layout)
  (tabs)/             # Глобус (index), Країни, Поїздки, Налаштування
  country/[iso].tsx   # модальний екран країни
  trip/[id].tsx       # модальний екран поїздки
src/
  components/         # AppText, Screen, EmptyState, далі GlobeView, CountryCard ...
  db/                 # схема Drizzle, міграції, запити
  data/               # countries.json, borders.geojson, cities.json
  theme/              # colors, fonts, spacing, navigationTheme
  i18n/               # uk.json, en.json, ініціалізація
  lib/                # фото, експорт, валюти
docs/SPEC.md          # ТЗ
```

Імпорти з `src` — через аліас `@/…` (`@/theme`, `@/components/AppText`).

## Дані

- id — UUID; дати — рядки `YYYY-MM-DD`; у кожній таблиці `updated_at` і `deleted_at`
  (м'яке видалення).
- Гроші — цілі числа в мінімальних одиницях (копійки, центи).
- Фото — файли в `documentDirectory/photos`, у базі тільки шляхи.
- Довідник країн у базу не пишеться: `src/data/countries.json`, зв'язок за ISO-кодом.

## Команди

```bash
npx expo start         # dev-сервер (Expo Go на етапах 1–3)
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint (expo + prettier + правила проєкту)
npm run format         # Prettier
npm run check          # typecheck + lint + format:check — запускати перед комітом
npx expo-doctor        # перевірка залежностей і конфігу
```

## Як працювати

- Перед завершенням етапу: `npm run check` зелений, `npx expo-doctor` без помилок.
- Наприкінці етапу — коміт `Stage N: <назва>`.
- Відкриті питання з `docs/SPEC.md` вирішує автор; до рішення — варіант «за замовчуванням».
- Пиши код і коментарі зрозуміло; коментарі можна українською.
