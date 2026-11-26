import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { COUNTRIES } from '@/data/countries';
import { useLanguage } from '@/i18n';
import { normalizeForSearch } from '@/lib/country-list';
import { colors, radius, spacing } from '@/theme';

type Props = {
  selected: readonly string[];
  onDone: (countries: string[]) => void;
  onClose: () => void;
};

/** Вибір кількох країн поїздки: пошук за назвою, вибрані — зверху. */
export function CountryPickerSheet({ selected, onDone, onClose }: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();
  const [chosen, setChosen] = useState<string[]>([...selected]);
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = normalizeForSearch(query);
    const sorted = [...COUNTRIES].sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang));
    const matches = q
      ? sorted.filter(
          (c) =>
            normalizeForSearch(c.name.uk).includes(q) || normalizeForSearch(c.name.en).includes(q),
        )
      : sorted;
    // Вибрані — зверху (в порядку вибору), щоб їх було видно без прокрутки
    const picked = new Set(selected);
    return [
      ...matches.filter((c) => picked.has(c.iso2)),
      ...matches.filter((c) => !picked.has(c.iso2)),
    ];
  }, [query, lang, selected]);

  const toggle = (iso2: string) =>
    setChosen((cur) => (cur.includes(iso2) ? cur.filter((x) => x !== iso2) : [...cur, iso2]));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.root, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.header}>
          <AppText variant="heading" accessibilityRole="header">
            {t('trips.chooseCountries')}
          </AppText>
          <Button small variant="ghost" label={t('common.close')} onPress={onClose} />
        </View>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('countries.search')}
          accessibilityLabel={t('countries.search')}
          autoCorrect={false}
        />
        <FlatList
          data={list}
          keyExtractor={(c) => c.iso2}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => {
            const on = chosen.includes(item.iso2);
            return (
              <Pressable
                onPress={() => toggle(item.iso2)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <AppText style={styles.flag}>{item.flag}</AppText>
                <AppText style={styles.name}>{item.name[lang]}</AppText>
                <Ionicons
                  name={on ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={on ? colors.gold : colors.textMuted}
                />
              </Pressable>
            );
          }}
        />
        <Button
          variant="primary"
          label={t('trips.countriesDone', { count: chosen.length })}
          onPress={() => onDone(chosen)}
          disabled={chosen.length === 0}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  flag: {
    fontSize: 22,
  },
  name: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
