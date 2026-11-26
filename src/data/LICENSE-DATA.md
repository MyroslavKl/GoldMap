# Ліцензії даних у `src/data`

Файли згенеровано скриптом `scripts/build-data.ts` із закріплених джерел
(`scripts/data-sources.ts`, з контрольними сумами SHA-256). Вручну не редагувати —
правки вносити в `scripts/overrides.ts` і перезбирати (`npm run build:data`).

## borders.geojson, cities.json

**Natural Earth** v5.1.2 (дані 5.1.1) — суспільне надбання (public domain).
<https://www.naturalearthdata.com/about/terms-of-use/>

- Кордони: _Admin 0 – Countries_ 1:10m, версія з точкою зору України
  (`ne_10m_admin_0_countries_ukr`). Крим і всі тимчасово окуповані території — Україна.
  Спрощено через mapshaper; точність координат 4 знаки.
- Міста: _Populated Places_ 1:10m (населення ≥ 100 тис. і всі столиці). Країну кожного міста
  перераховано за полігонами з точкою зору України.

Атрибуція не обов'язкова; у додатку вказуємо «Made with Natural Earth».

## countries.json

Похідна база з двох джерел:

- **Natural Earth** (public domain) — ISO-коди, назви uk/en, континент, центр.
- **mledoze/countries** — столиці, валюти, членство в ООН.
  © Mohammed Le Doze, <https://github.com/mledoze/countries>,
  ліцензія **Open Database License (ODbL) 1.0**: <https://opendatacommons.org/licenses/odbl/1-0/>

Отже `countries.json` поширюється під **ODbL 1.0**: під час публікації треба зазначити
атрибуцію (у додатку — Налаштування → Атрибуції) і зберегти ту саму ліцензію для цієї бази.
Ліцензія не поширюється на решту коду додатку.

## Прапори

Прапори — емодзі Unicode (регіональні індикатори), окремої ліцензії не потребують.

## landmarks.json

Визначні місця («варто побачити») — з [Wikidata](https://www.wikidata.org), ліцензія
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (атрибуція не обов'язкова, але
вказуємо джерело). Збирає `scripts/build-landmarks.ts`: класи визначних об'єктів і пам'ятки
ЮНЕСКО, рейтинг — кількість мовних версій статей у Вікіпедії, до 15 на країну. Країну місця
визначають кордони з `borders.geojson` (точка зору України), а не поле країни у Wikidata.
