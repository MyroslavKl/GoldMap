import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Section } from '@/components/country/Section';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { getCountry } from '@/data/countries';
import { getLandmarks } from '@/data/landmarks';
import {
  addWishlistPlace,
  markWishlistVisited,
  removePlace,
  restorePlace,
  tripPlacesQuery,
  unmarkWishlistVisited,
  type TripWithCountries,
} from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import { hapticSelection } from '@/lib/haptics';
import { tripPhase } from '@/lib/trips';
import { showUndo } from '@/lib/undo';
import { colors, fonts, radius, spacing } from '@/theme';

/** Скільки пропозицій видно одразу (решта — за «Показати всі») */
const SUGGESTIONS_SHOWN = 5;

type Props = { trip: TripWithCountries; today: string };

/**
 * «Хочу відвідати»: місця поїздки (з пропозицій одним тапом або вручну) і, після початку
 * поїздки, позначка «відвідано» — місце з координатами стає точкою на карті.
 */
export function WishlistSection({ trip, today }: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const { data: places } = useLiveQuery(tripPlacesQuery(expoDb, trip.id), [trip.id]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const started = tripPhase(trip, today) === 'ongoing' || tripPhase(trip, today) === 'past';
  const added = new Set(places.map((p) => p.wikidataId).filter(Boolean));
  // День відвідання: кінець поїздки (але не в майбутньому)
  const visitDay = [trip.endDate ?? trip.startDate ?? today, today].sort()[0];

  const toggleVisited = async (id: string, visited: boolean) => {
    hapticSelection();
    if (visited) await unmarkWishlistVisited(dbContext, id);
    else await markWishlistVisited(dbContext, id, visitDay);
  };

  const remove = async (id: string) => {
    await removePlace(dbContext, id);
    showUndo({ message: t('undo.placeDeleted'), undo: () => restorePlace(dbContext, id) });
  };

  return (
    <Section
      title={t('wishlist.title')}
      actionLabel={t('wishlist.addOwn')}
      onAction={() => setAdding(true)}>
      {places.length === 0 ? <AppText variant="muted">{t('wishlist.empty')}</AppText> : null}
      <View style={styles.list}>
        {places.map((p) => {
          const visited = !p.isWishlist;
          return (
            <View key={p.id} style={styles.row}>
              {started ? (
                <Pressable
                  onPress={() => void toggleVisited(p.id, visited)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: visited }}
                  accessibilityLabel={t('wishlist.markVisited', { place: p.title })}>
                  <Ionicons
                    name={visited ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={visited ? colors.gold : colors.textMuted}
                  />
                </Pressable>
              ) : (
                <Ionicons name="bookmark-outline" size={20} color={colors.gold} />
              )}
              <View style={styles.text}>
                <AppText style={visited && styles.visited}>{p.title}</AppText>
                <AppText variant="muted">
                  {getCountry(p.countryIso)?.flag ?? ''}{' '}
                  {visited ? t('wishlist.visited') : t('wishlist.want')}
                </AppText>
              </View>
              <Pressable
                onPress={() => void remove(p.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('wishlist.remove', { place: p.title })}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        })}
      </View>

      {trip.countries.map((iso2) => {
        const country = getCountry(iso2);
        const all = getLandmarks(iso2);
        if (!country || all.length === 0) return null;
        const open = expanded.has(iso2);
        const shown = open ? all : all.slice(0, SUGGESTIONS_SHOWN);
        return (
          <View key={iso2} style={styles.suggestions}>
            <AppText variant="label">
              {t('wishlist.suggested', { country: `${country.flag} ${country.name[lang]}` })}
            </AppText>
            {shown.map((l) => {
              const isAdded = added.has(l.id);
              return (
                <Pressable
                  key={l.id}
                  disabled={isAdded}
                  onPress={() => {
                    hapticSelection();
                    void addWishlistPlace(dbContext, {
                      tripId: trip.id,
                      countryIso: iso2,
                      title: l.name[lang],
                      lat: l.lat,
                      lng: l.lng,
                      wikidataId: l.id,
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isAdded }}
                  accessibilityLabel={
                    isAdded
                      ? t('wishlist.alreadyAdded', { place: l.name[lang] })
                      : t('wishlist.add', { place: l.name[lang] })
                  }
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                  <AppText style={styles.text} numberOfLines={2}>
                    {l.name[lang]}
                  </AppText>
                  <Ionicons
                    name={isAdded ? 'checkmark' : 'add-circle-outline'}
                    size={22}
                    color={colors.gold}
                  />
                </Pressable>
              );
            })}
            {all.length > SUGGESTIONS_SHOWN ? (
              <Button
                small
                variant="ghost"
                label={open ? t('wishlist.showLess') : t('wishlist.showAll', { count: all.length })}
                onPress={() =>
                  setExpanded((cur) => {
                    const next = new Set(cur);
                    if (next.has(iso2)) next.delete(iso2);
                    else next.add(iso2);
                    return next;
                  })
                }
                style={styles.more}
              />
            ) : null}
          </View>
        );
      })}

      {adding ? <OwnPlaceSheet trip={trip} onClose={() => setAdding(false)} /> : null}
    </Section>
  );
}

/** Своє місце «хочу відвідати» — лише назва й країна (без точки на карті). */
function OwnPlaceSheet({ trip, onClose }: { trip: TripWithCountries; onClose: () => void }) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const [title, setTitle] = useState('');
  const [iso2, setIso2] = useState(trip.countries[0] ?? '');

  const save = async () => {
    await addWishlistPlace(dbContext, { tripId: trip.id, countryIso: iso2, title });
    onClose();
  };

  return (
    <Sheet
      visible
      title={t('wishlist.addOwn')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          label={t('common.save')}
          onPress={() => void save()}
          disabled={!title.trim() || !iso2}
        />
      }>
      <TextField
        label={t('places.name')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('wishlist.ownPlaceholder')}
        autoFocus
      />
      {trip.countries.length > 1 ? (
        <Chips
          options={trip.countries.map((c) => {
            const country = getCountry(c);
            return {
              value: c,
              label: country ? `${country.flag} ${country.name[lang]}` : c,
            };
          })}
          value={iso2}
          onChange={setIso2}
          accessibilityLabel={t('expenses.country')}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
  },
  visited: {
    color: colors.gold,
    fontFamily: fonts.sansMedium,
  },
  suggestions: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  more: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.7,
  },
});
