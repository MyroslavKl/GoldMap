import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { getCountry } from '@/data/countries';
import { createPlaceFromPhotos, isCountryVisited, setCountryVisited, setSetting } from '@/db';
import { dbContext } from '@/db/client';
import { useLanguage } from '@/i18n';
import { formatDay } from '@/lib/dates';
import { hapticMarked } from '@/lib/haptics';
import type { PlaceSuggestion } from '@/lib/photo-clusters';
import { colors, radius, spacing } from '@/theme';

type Props = {
  suggestions: readonly PlaceSuggestion[];
  /** Уже пропущені фото (налаштування skippedGpsPhotos) */
  skipped: readonly string[];
  onClose: () => void;
};

type Choice = 'create' | 'skip';

/** Країна точки: за координатами, а якщо поза кордонами (море) — країна, куди додано фото. */
function targetIso(s: PlaceSuggestion): string {
  return s.countryIso ?? s.sourceIso;
}

/**
 * Пропозиції точок з фото з GPS: кожну групу можна створити (з назвою) або пропустити.
 * Група, знята в іншій країні, пропонується в ту країну — її буде позначено відвіданою,
 * а фото переїдуть туди разом із точкою.
 */
export function GpsSuggestionsSheet({ suggestions, skipped, onClose }: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const months = t('months.short', { returnObjects: true });

  const defaultTitle = (s: PlaceSuggestion) => {
    const place = s.city?.[lang] ?? getCountry(targetIso(s))?.name[lang] ?? '';
    return s.date ? t('places.suggestTitle', { place, date: formatDay(s.date, months) }) : place;
  };

  const [choices, setChoices] = useState<Choice[]>(() => suggestions.map(() => 'create'));
  const [titles, setTitles] = useState<string[]>(() => suggestions.map(defaultTitle));
  const creating = choices.filter((c) => c === 'create').length;
  const invalid = suggestions.some((_, i) => choices[i] === 'create' && !titles[i]?.trim());

  const apply = async () => {
    const skip: string[] = [];
    for (const [i, s] of suggestions.entries()) {
      if (choices[i] === 'skip') {
        skip.push(...s.photoIds);
        continue;
      }
      const iso2 = targetIso(s);
      if (iso2 !== s.sourceIso && !(await isCountryVisited(dbContext, iso2))) {
        await setCountryVisited(dbContext, iso2, true);
        hapticMarked();
      }
      await createPlaceFromPhotos(dbContext, {
        countryIso: iso2,
        title: titles[i],
        lat: s.lat,
        lng: s.lng,
        visitedAt: s.date,
        photoIds: s.photoIds,
      });
    }
    if (skip.length) {
      await setSetting(dbContext, 'skippedGpsPhotos', [...new Set([...skipped, ...skip])]);
    }
    onClose();
  };

  return (
    <Sheet
      visible
      title={t('places.suggestTitleSheet')}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            label={
              creating > 0
                ? t('places.suggestCreate', { count: creating })
                : t('places.suggestSkipAll')
            }
            onPress={() => void apply()}
            disabled={invalid}
          />
          <Button variant="ghost" label={t('places.suggestLater')} onPress={onClose} />
        </>
      }>
      <AppText variant="muted">{t('places.suggestHint')}</AppText>
      {suggestions.map((s, i) => {
        const iso2 = targetIso(s);
        const other = iso2 !== s.sourceIso ? getCountry(iso2) : null;
        return (
          <View key={s.photoIds.join(',')} style={styles.card}>
            <AppText variant="label">
              {t('places.suggestPhotos', { count: s.photoIds.length })}
            </AppText>
            {other ? (
              <AppText style={styles.other}>
                {t('places.suggestOtherCountry', {
                  country: t('card.flagAndName', { flag: other.flag, name: other.name[lang] }),
                })}
              </AppText>
            ) : null}
            <Chips<Choice>
              options={[
                {
                  value: 'create',
                  label: other
                    ? t('places.suggestAddTo', { country: other.name[lang] })
                    : t('places.suggestAdd'),
                },
                { value: 'skip', label: t('places.suggestSkip') },
              ]}
              value={choices[i]}
              onChange={(c) => setChoices((list) => list.map((v, j) => (j === i ? c : v)))}
            />
            {choices[i] === 'create' ? (
              <TextField
                value={titles[i]}
                onChangeText={(text) =>
                  setTitles((list) => list.map((v, j) => (j === i ? text : v)))
                }
                accessibilityLabel={t('places.name')}
                placeholder={t('places.namePlaceholder')}
              />
            ) : null}
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  other: {
    color: colors.gold,
  },
});
