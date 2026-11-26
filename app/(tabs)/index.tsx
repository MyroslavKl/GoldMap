import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CountryCard } from '@/components/CountryCard';
import {
  GlobeView,
  type GlobeCamera,
  type GlobeLongPress,
  type GlobeViewHandle,
} from '@/components/globe';
import { PlaceSheet, type PlaceSheetTarget } from '@/components/places/PlaceSheet';
import { countableIsos, getCountry } from '@/data/countries';
import { activeVisitDatesQuery, computeCounter, getPlace, plannedIsosQuery } from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { groupVisitDates } from '@/lib/country-list';
import { useLanguage } from '@/i18n';
import { hapticSelection } from '@/lib/haptics';
import { useMapPresence } from '@/lib/map-presence';
import { useDetailMapAllowed, useMapPoints } from '@/lib/use-map-data';
import { useToggleVisited } from '@/lib/use-toggle-visited';
import { spacing } from '@/theme';

/**
 * Вкладка «Глобус»: глобус на весь екран, лічильник поверх, картка країни — оверлеєм.
 * Поки відкрито екран країни (з мінікартою), глобус вивантажується, а потім повертається
 * на те саме місце (камера зберігається тут).
 */
export default function GlobeTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const globe = useRef<GlobeViewHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const toggleVisited = useToggleVisited();
  const lang = useLanguage();
  const { points } = useMapPoints();
  // Підписи Сонячної системи (з'являється, коли глобус дуже віддалений)
  const spaceLabels = useMemo(
    () => ({
      sun: t('space.sun'),
      mercury: t('space.mercury'),
      venus: t('space.venus'),
      earth: t('space.earth'),
      mars: t('space.mars'),
      jupiter: t('space.jupiter'),
      saturn: t('space.saturn'),
      uranus: t('space.uranus'),
      neptune: t('space.neptune'),
    }),
    [t],
  );
  const detailMap = useDetailMapAllowed();
  const [sheet, setSheet] = useState<PlaceSheetTarget | null>(null);

  const mapHeldElsewhere = useMapPresence((st) => st.countryScreens > 0);
  const camera = useRef<GlobeCamera | null>(null);
  const onCameraChange = useCallback((c: GlobeCamera) => {
    camera.current = c;
  }, []);
  // Камера в момент вивантаження — з неї глобус продовжить після повернення
  const [resumeCamera, setResumeCamera] = useState<GlobeCamera | null>(null);
  useEffect(
    () =>
      useMapPresence.subscribe((now, before) => {
        if (now.countryScreens > 0 && before.countryScreens === 0) {
          setResumeCamera(camera.current);
        }
      }),
    [],
  );

  const { data: visitRows } = useLiveQuery(activeVisitDatesQuery(expoDb));
  const { data: plannedRows } = useLiveQuery(plannedIsosQuery(expoDb));
  const visitsByCountry = useMemo(() => groupVisitDates(visitRows), [visitRows]);
  const visited = useMemo(() => [...visitsByCountry.keys()], [visitsByCountry]);
  const planned = useMemo(() => plannedRows.map((r) => r.countryIso), [plannedRows]);
  // TODO(етап 9): режим списку країн із налаштувань (un / extended).
  const counter = computeCounter(visited, countableIsos('un'));

  const selectCountry = useCallback((iso2: string) => {
    if (!getCountry(iso2)) return;
    setSelected(iso2);
    globe.current?.flyTo({ iso2 });
  }, []);

  const closeCard = useCallback(() => setSelected(null), []);

  const openCountry = useCallback(() => {
    if (!selected) return;
    setSelected(null);
    router.push({ pathname: '/country/[iso]', params: { iso: selected } });
  }, [selected]);

  const onLongPress = useCallback((e: GlobeLongPress) => {
    if (!e.iso2 || !getCountry(e.iso2)) return; // океан — точка завжди належить країні
    hapticSelection();
    setSelected(null);
    setSheet({ kind: 'new', iso2: e.iso2, lat: e.lat, lng: e.lng });
  }, []);

  const onPointPress = useCallback((id: string) => {
    void getPlace(dbContext, id).then((place) => {
      if (place) setSheet({ kind: 'edit', place });
    });
  }, []);

  const isSelectedVisited = selected ? visitsByCountry.has(selected) : false;
  const onToggleVisited = useCallback(() => {
    if (selected) void toggleVisited(selected, isSelectedVisited);
  }, [selected, isSelectedVisited, toggleVisited]);

  return (
    <View style={styles.root}>
      {mapHeldElsewhere ? null : (
        <GlobeView
          ref={globe}
          visited={visited}
          planned={planned}
          language={lang}
          points={points}
          spaceLabels={spaceLabels}
          detailMap={detailMap}
          // Повернення з екрана країни: те саме місце; обертання — після 5 с бездіяльності
          initialCamera={resumeCamera ?? undefined}
          onCountryPress={selectCountry}
          onLongPress={onLongPress}
          onPointPress={onPointPress}
          onCameraChange={onCameraChange}
        />
      )}
      <View pointerEvents="none" style={[styles.counter, { top: insets.top + spacing.md }]}>
        <AppText variant="counter" accessibilityRole="header">
          {t('globe.counter', counter)}
        </AppText>
      </View>

      {selected ? (
        <CountryCard
          key={selected}
          iso2={selected}
          visited={isSelectedVisited}
          planned={planned.includes(selected)}
          startDates={visitsByCountry.get(selected) ?? []}
          onToggleVisited={onToggleVisited}
          onOpen={openCountry}
          onClose={closeCard}
        />
      ) : null}
      {sheet ? <PlaceSheet target={sheet} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  counter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
