import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { CITIES } from '@/data/cities';
import { getCountry } from '@/data/countries';
import {
  addPlace,
  photosByCountryQuery,
  removePlace,
  restorePlace,
  setPlacePhotos,
  updatePlace,
  type Place,
} from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { useLanguage } from '@/i18n';
import { nearestCity } from '@/lib/photo-clusters';
import { photoUri } from '@/lib/photos';
import { showUndo } from '@/lib/undo';
import { usePhotoImport } from '@/lib/use-photo-import';
import { colors, radius, spacing } from '@/theme';

export type PlaceSheetTarget =
  { kind: 'new'; iso2: string; lat: number; lng: number } | { kind: 'edit'; place: Place };

const COLUMNS = 4;
const GAP = spacing.xs;

/** Нова точка (після довгого натискання) або редагування: назва, нотатка, фото країни. */
export function PlaceSheet({ target, onClose }: { target: PlaceSheetTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const place = target.kind === 'edit' ? target.place : null;
  const iso2 = place?.countryIso ?? (target.kind === 'new' ? target.iso2 : '');
  const country = getCountry(iso2);

  const { data: photos } = useLiveQuery(photosByCountryQuery(expoDb, iso2), [iso2]);
  const { progress, pickAndImport } = usePhotoImport(iso2);

  const [title, setTitle] = useState(() => {
    if (place) return place.title;
    if (target.kind !== 'new') return '';
    return nearestCity(CITIES, target.lat, target.lng)?.name[lang] ?? '';
  });
  const [note, setNote] = useState(place?.note ?? '');
  // null — ще не змінювали: беремо фото, вже прив'язані до точки
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const selected =
    picked ?? new Set(photos.filter((p) => place && p.placeId === place.id).map((p) => p.id));
  const [width, setWidth] = useState(0);
  const tile = width > 0 ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const addFromLibrary = async () => {
    const imported = await pickAndImport();
    if (imported.length) setPicked(new Set([...selected, ...imported.map((p) => p.id)]));
  };

  const save = async () => {
    let id: string;
    if (place) {
      await updatePlace(dbContext, place.id, { title, note });
      id = place.id;
    } else if (target.kind === 'new') {
      id = (
        await addPlace(dbContext, {
          countryIso: iso2,
          title,
          note,
          lat: target.lat,
          lng: target.lng,
        })
      ).id;
    } else return;
    await setPlacePhotos(dbContext, id, [...selected]);
    onClose();
  };

  const remove = async () => {
    if (!place) return;
    await removePlace(dbContext, place.id);
    onClose();
    showUndo({
      message: t('undo.placeDeleted'),
      undo: () => restorePlace(dbContext, place.id),
      // Час на «Скасувати» минув — фото відв'язуються й лишаються просто фото країни
      commit: () => setPlacePhotos(dbContext, place.id, []),
    });
  };

  return (
    <Sheet
      visible
      title={place ? t('places.edit') : t('places.new')}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            label={t('common.save')}
            onPress={() => void save()}
            disabled={!title.trim() || progress !== null}
          />
          {place ? (
            <Button variant="danger" label={t('common.delete')} onPress={() => void remove()} />
          ) : null}
        </>
      }>
      {country ? (
        <AppText variant="muted">
          {t('card.flagAndName', { flag: country.flag, name: country.name[lang] })}
        </AppText>
      ) : null}
      <TextField
        label={t('places.name')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('places.namePlaceholder')}
        autoFocus={!place && !title}
      />
      <TextField
        label={t('places.note')}
        value={note}
        onChangeText={setNote}
        multiline
        placeholder={t('places.notePlaceholder')}
      />

      <View style={styles.photosHeader}>
        <AppText variant="label">{t('places.photos', { count: selected.size })}</AppText>
        <Button
          small
          variant="ghost"
          icon="add"
          label={t('places.addPhotos')}
          onPress={() => void addFromLibrary()}
          disabled={progress !== null}
        />
      </View>
      {progress ? (
        <View style={styles.progress}>
          <ActivityIndicator color={colors.gold} />
          <AppText variant="muted">{t('photos.importing', progress)}</AppText>
        </View>
      ) : null}
      {photos.length === 0 ? (
        <AppText variant="muted">{t('places.noCountryPhotos')}</AppText>
      ) : (
        <>
          <AppText variant="muted">{t('places.pickHint')}</AppText>
          <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {tile > 0 &&
              photos.map((p, i) => {
                const on = selected.has(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggle(p.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={t('photos.open', { index: i + 1, total: photos.length })}
                    style={{ width: tile, height: tile }}>
                    <Image
                      source={{ uri: photoUri(p.thumbUri) }}
                      style={[styles.thumb, !on && styles.thumbOff]}
                      contentFit="cover"
                      recyclingKey={p.id}
                    />
                    {on ? (
                      <View style={styles.check}>
                        <Ionicons name="checkmark" size={14} color={colors.bg} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  thumb: {
    flex: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  thumbOff: {
    opacity: 0.45,
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
});
