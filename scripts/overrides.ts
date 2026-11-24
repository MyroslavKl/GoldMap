/**
 * Ручні правки поверх джерел. Кожна правка — з причиною.
 */
import type { Continent, LocalizedName } from '../src/data/types.ts';

/** Natural Earth ставить острівні держави в «Seven seas (open ocean)»; Кіпр — в Азію. */
export const CONTINENT_OVERRIDES: Record<string, Continent> = {
  SC: 'africa', // Сейшели
  MU: 'africa', // Маврикій
  SH: 'africa', // Острів Святої Єлени
  MV: 'asia', // Мальдіви
  IO: 'asia', // Британська територія в Індійському океані
  TF: 'antarctica', // Французькі Південні території
  HM: 'antarctica', // Острови Херд і Макдональд
  GS: 'antarctica', // Південна Джорджія
  CY: 'europe', // член ЄС; МЗС України відносить до Європи
};

/** Коротші або прийняті в Україні назви замість довгих форм із Natural Earth. */
export const NAME_OVERRIDES: Record<string, Partial<LocalizedName>> = {
  TW: { uk: 'Тайвань' },
  CN: { uk: 'Китай', en: 'China' }, // NE: «Китайська Народна Республіка»
  ZA: { uk: 'ПАР' }, // NE: «Південно-Африканська Республіка»
  CD: { uk: 'ДР Конго', en: 'DR Congo' },
  FM: { en: 'Micronesia' }, // NE: «Federated States of Micronesia»
  KP: { uk: 'Північна Корея' },
  US: { uk: 'США', en: 'United States' },
  CZ: { en: 'Czechia' },
  CI: { en: "Côte d'Ivoire" },
};

/**
 * Столиці: застарілі назви в Natural Earth і території, для яких у джерелах
 * немає української назви.
 */
export const CAPITAL_OVERRIDES: Record<string, LocalizedName> = {
  KZ: { uk: 'Астана', en: 'Astana' }, // NE: «Нур-Султан» (перейменовано назад у 2022)
  NR: { uk: 'Ярен', en: 'Yaren' },
  HK: { uk: 'Вікторія', en: 'Victoria' },
  AI: { uk: 'Валлі', en: 'The Valley' },
  BL: { uk: 'Густавія', en: 'Gustavia' },
  EH: { uk: 'Ель-Аюн', en: 'El Aaiún' },
  GG: { uk: 'Сент-Пітер-Порт', en: 'St. Peter Port' },
  GS: { uk: 'Кінг-Едвард-Пойнт', en: 'King Edward Point' },
  IO: { uk: 'Дієго-Гарсія', en: 'Diego Garcia' },
  JE: { uk: 'Сент-Гельєр', en: 'Saint Helier' },
  MF: { uk: 'Маріго', en: 'Marigot' },
  MP: { uk: 'Сайпан', en: 'Saipan' },
  MS: { uk: 'Плімут', en: 'Plymouth' },
  NU: { uk: 'Алофі', en: 'Alofi' },
  PF: { uk: 'Папеете', en: 'Papeete' },
  PM: { uk: "Сен-П'єр", en: 'Saint-Pierre' },
  PN: { uk: 'Адамстаун', en: 'Adamstown' },
  SH: { uk: 'Джеймстаун', en: 'Jamestown' },
  SX: { uk: 'Філіпсбург', en: 'Philipsburg' },
  TF: { uk: 'Порт-о-Франсе', en: 'Port-aux-Français' },
  VG: { uk: 'Род-Таун', en: 'Road Town' },
  VI: { uk: 'Шарлотта-Амалія', en: 'Charlotte Amalie' },
  WF: { uk: 'Мата-Уту', en: 'Mata-Utu' },
};

/** mledoze бере першу валюту за абеткою; тут — основна в обігу. */
export const CURRENCY_OVERRIDES: Record<string, string> = {
  PS: 'ILS', // mledoze: EGP, ILS, JOD
  EH: 'MAD', // mledoze: DZD, MAD, MRU
  FM: 'USD', // у mledoze валюта не вказана; офіційна — долар США
};

/**
 * Міста, чия точка в Natural Earth лежить поза своїм полігоном і «прилипає» до сусіда.
 * Ключ — NAME з Natural Earth. НЕ використовувати для окупованих територій:
 * їх країну визначають полігони з точкою зору України.
 */
export const CITY_COUNTRY_OVERRIDES: Record<string, string> = {
  Gibraltar: 'GI', // точка в затоці, найближчий берег — Іспанія
};
