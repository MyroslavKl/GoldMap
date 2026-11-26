/** Формати файлів у src/data (їх читає і додаток, і тести). */

export type Continent =
  'europe' | 'asia' | 'africa' | 'north-america' | 'south-america' | 'oceania' | 'antarctica';

export type LocalizedName = { uk: string; en: string };

export type Country = {
  iso2: string;
  iso3: string;
  name: LocalizedName;
  capital: LocalizedName | null;
  continent: Continent;
  /** ISO 4217, напр. "UAH" */
  currency: string | null;
  /** Прапор-емодзі */
  flag: string;
  /** Входить у базовий лічильник «N / 193» */
  unMember: boolean;
  /** Центр для камери глобуса */
  lat: number;
  lng: number;
  /** Наближення, з якого на глобусі видно назву (Natural Earth MIN_LABEL) */
  labelZoom: number;
};

export type City = {
  name: LocalizedName;
  iso2: string;
  lat: number;
  lng: number;
  capital: boolean;
  pop: number;
};

export type BorderProps = { iso2: string };

/** Визначне місце «варто побачити» (src/data/landmarks.json, з Wikidata). */
export type Landmark = {
  /** Wikidata QID, напр. "Q215003" — щоб не додати те саме місце двічі */
  id: string;
  name: LocalizedName;
  lat: number;
  lng: number;
  /** Кількість мовних версій статей у Вікіпедії — чим більше, тим відоміше */
  rank: number;
};

export type LandmarksFile = {
  source: string;
  /** Дата запиту до Wikidata, YYYY-MM-DD */
  fetchedAt: string;
  /** ISO2 → до 15 місць, від найвідоміших */
  countries: Record<string, Landmark[]>;
};
