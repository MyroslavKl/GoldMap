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

Expo SDK 58 (React Native, TypeScript strict), expo-router, expo-sqlite + Drizzle, i18next +
expo-localization. Далі за етапами: Zustand лише для UI-стану.

**Глобус: зараз WebView, перед публікацією — нативний Mapbox.** У автора iPhone без Apple
Developer акаунта, тож development build на iOS неможливий, а додаток має працювати в **Expo Go**.
Тому `GlobeView` зараз — MapLibre GL JS (globe) у react-native-webview; перед публікацією його
замінить @rnmapbox/maps (див. `docs/SPEC.md` → «Технічний стек», «Публікація»). Правила:

- Глобус — тільки через `@/components/globe` (`GlobeView`, `GlobeViewProps`, `GlobeViewHandle`).
  `react-native-webview`, `maplibre-gl` і `web/*` поза `src/components/globe` не імпортувати.
- Контракт у `types.ts` не залежить від реалізації: жодних WebView/MapLibre-типів у пропсах.
  Нова можливість глобуса = пропс/команда в `types.ts` + реалізація, яку потім повторить Mapbox.
- Не додавати нативних модулів, яких немає в Expo Go, без рішення автора.
- Код у WebView — `src/components/globe/web/main.ts`; кольори імпортує з `src/theme/colors.ts`.
  RN ⇄ WebView — лише типізовані повідомлення з `protocol.ts`.
- `web/globe-html.generated.ts` генерується (`npm run build:globe`, автоматично після
  `npm install`), у git не потрапляє, руками не редагувати. Після змін у `web/main.ts`, темі чи
  `src/data` — перезібрати.
- Офлайн: MapLibre, його воркер (Blob URL), кордони, міста, точки підписів і шрифт Inter (style
  `font-faces`, data: URL — текст малюється локально) вшиті в HTML. Жодних тайлів, сервера гліфів
  , спрайтів чи шрифтів з мережі; це перевіряє `npm run test:globe`.
- Кордони поверх золота (між відвіданими сусідами) — темний пунктир `borderOnGold`, інакше
  межа зливається із заливкою.
- Ліцензія MapLibre GL JS — BSD-3-Clause: текст має бути в «Атрибуціях» (етап 9).

- Пакети ставити **тільки** `npx expo install <pkg>` (сумісні з SDK версії).
- Expo змінюється з кожним SDK — не покладайся на пам'ять, звіряйся з
  `https://docs.expo.dev/versions/v58.0.0/`.
- `ios/` і `android/` генеруються (CNG) і в git не потрапляють. Нативні налаштування — через
  `app.json` і config-плагіни.
- Нативні модулі поза Expo Go (Mapbox тощо) потребують development build (EAS) — до публікації
  їх не додаємо (див. вище).

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
- `src/data/*.json|geojson` — згенеровані (`npm run build:data`), руками не редагувати.
  Джерела закріплені за комітом і SHA-256 у `scripts/data-sources.ts`, ручні правки —
  у `scripts/overrides.ts` (кожна з причиною). Типи — `src/data/types.ts`.
- Кордони — Natural Earth `_ukr` (1:10m, спрощено до ~1 МБ). Країну міста визначає полігон,
  а не поле джерела. Після будь-якої зміни даних — `npm run test:data` (Сімферополь ∈ UA).
- `countries.json` — похідна від mledoze/countries під **ODbL**: атрибуція обов'язкова
  (див. `src/data/LICENSE-DATA.md`).
- Лічильник: 193 члени ООН (Ватикан і Палестина — спостерігачі, не входять). Косово в
  кордонах з точкою зору України — частина Сербії; Мартиніка, Гваделупа, Реюньйон — Франції.

## База даних (`src/db`)

- Схема — `src/db/schema.ts`. Змінив схему → `npm run db:generate` → нова міграція в
  `src/db/migrations` (комітити разом). Старі міграції не редагувати.
- Міграції застосовує `DatabaseGate` при старті додатку (`useMigrations`).
- Функції-запити — `src/db/queries/*`, приймають `DbContext` (`db`, `newId`, `now`) і пишуться
  через `await`: у додатку працюють з expo-sqlite (`dbContext` з `@/db/client`), у тестах — з
  `node:sqlite` (`tests/helpers/test-db.ts`). Компоненти не пишуть SQL напряму.
- Читання завжди фільтрує `deleted_at IS NULL`; видалення — лише м'яке (`deleted_at`, `updated_at`).
- Нова функція-запит = unit-тест у `tests/db.test.ts`.
- Відносні імпорти всередині `src/db` — з розширенням `.ts` (потрібно для Node-тестів;
  Metro їх розуміє). `src/db` не імпортує нічого з `@/…` і з Expo, крім `client.ts`.
- Живі дані в компонентах — `useLiveQuery` з `drizzle-orm/expo-sqlite` (напр. `visitedIsosQuery`).

## Позначка «був тут»

- Позначати / знімати — лише через `useToggleVisited()` (`src/lib/use-toggle-visited.ts`): одна
  логіка для картки на глобусі й галочки у списку (вібрація, підтвердження).
- Перед зняттям позначки, якщо в країни є дати візитів, фото, нотатки чи витрати —
  підтвердження (`needsUnmarkConfirmation`). Зняття видаляє **лише візити**; фото, нотатки й
  витрати не чіпати ніколи (є тест).
- Картка країни на глобусі — оверлей (`CountryCard`) поверх глобуса, не окремий екран.
- Заливка золотом ~600 мс: на глобусі — `web/fill-animator.ts`, у картці — `CountryOutline`.
- Силуети — `src/data/outlines.json` (генерує `build:data`); тест перевіряє, що Сімферополь
  усередині силуету UA.

## Чисті модулі й тести

- Логіка без React/Expo — у `src/lib/*.ts` (напр. `country-list.ts`, `dates.ts`) з відносними
  імпортами `.ts`; тести — `tests/lib.test.ts`. Хуки й код з Expo — окремими файлами.
- Назви місяців — з i18n (`months.short`), не з `Intl`: однаково на iOS і Android.

## Команди

```bash
npx expo start         # dev-сервер (Expo Go)
npm run typecheck      # tsc: додаток, scripts, tests
npm run lint           # ESLint (expo + prettier + правила проєкту)
npm run format         # Prettier
npm run build:data     # перезібрати src/data з джерел (потрібен інтернет)
npm run test:data      # тести даних (кордони України, 193, назви)
npm run test:db        # unit-тести бази (node:sqlite у пам'яті)
npm run test:lib       # чисті модулі src/lib (список країн, дати)
npm test               # усі тести
npm run db:generate    # нова міграція після зміни схеми
npm run build:globe    # перезібрати офлайн-HTML глобуса
npm run test:globe     # тести глобуса (офлайн-HTML, протокол)
npm run check          # typecheck + lint + format:check + усі тести — перед комітом
npx expo-doctor        # перевірка залежностей і конфігу
```

## Як працювати

- Перед завершенням етапу: `npm run check` зелений, `npx expo-doctor` без помилок.
- Наприкінці етапу — коміт `Stage N: <назва>`.
- Відкриті питання з `docs/SPEC.md` вирішує автор; до рішення — варіант «за замовчуванням».
- Пиши код і коментарі зрозуміло; коментарі можна українською.
