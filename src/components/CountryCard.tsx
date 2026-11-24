import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { CountryOutline } from '@/components/CountryOutline';
import { getCountry } from '@/data/countries';
import { useLanguage } from '@/i18n';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme';

const OUTLINE_SIZE = 168;
const ENTER_MS = 350;
const EXIT_MS = 200;

type Props = {
  iso2: string;
  visited: boolean;
  planned: boolean;
  visitCount: number;
  onToggleVisited: () => void;
  onOpen: () => void;
  onClose: () => void;
};

/**
 * Картка країни поверх глобуса: фон затемнюється й розмивається, силует країни
 * «виїжджає» вперед. Закривається тапом по фону, ✕ або кнопкою «Назад» (Android).
 */
export function CountryCard({
  iso2,
  visited,
  planned,
  visitCount,
  onToggleVisited,
  onOpen,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const country = getCountry(iso2);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  if (!country) return null;

  const status = visited
    ? t('card.statusVisited', { count: visitCount })
    : planned
      ? t('card.statusPlanned')
      : t('card.statusNotVisited');

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        entering={FadeIn.duration(ENTER_MS).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(EXIT_MS).reduceMotion(ReduceMotion.System)}
        style={StyleSheet.absoluteFill}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('card.close')}
        />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          entering={ZoomIn.duration(ENTER_MS).reduceMotion(ReduceMotion.System)}
          exiting={ZoomOut.duration(EXIT_MS).reduceMotion(ReduceMotion.System)}
          style={styles.card}
          accessibilityViewIsModal>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel={t('card.close')}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>

          <View style={styles.outline}>
            <CountryOutline iso2={iso2} filled={visited} size={OUTLINE_SIZE} />
          </View>

          <AppText variant="title" style={styles.name} accessibilityRole="header">
            {t('card.flagAndName', { flag: country.flag, name: country.name[lang] })}
          </AppText>
          {country.capital ? (
            <AppText variant="muted" style={styles.centerText}>
              {t('card.capital', { capital: country.capital[lang] })}
            </AppText>
          ) : null}
          <AppText style={[styles.status, visited && styles.statusVisited]}>{status}</AppText>
          {!country.unMember ? (
            <AppText variant="muted" style={styles.centerText}>
              {t('card.territory')}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onToggleVisited}
              style={({ pressed }) => [
                styles.primary,
                visited && styles.primaryDone,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ checked: visited }}>
              {visited ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
              <AppText style={[styles.primaryText, visited && styles.primaryTextDone]}>
                {visited ? t('card.visited') : t('card.markVisited')}
              </AppText>
            </Pressable>

            <View style={styles.row}>
              {/* TODO(етап 8): створення поїздки */}
              <Pressable
                disabled
                style={[styles.secondary, styles.disabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityHint={t('card.planSoon')}>
                <AppText style={styles.secondaryText}>{t('card.plan')}</AppText>
                <AppText variant="muted" style={styles.soon}>
                  {t('card.planSoon')}
                </AppText>
              </Pressable>
              <Pressable
                onPress={onOpen}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                accessibilityRole="button">
                <AppText style={styles.secondaryText}>{t('card.open')}</AppText>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: colors.scrim,
  },
  center: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldBorder,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  close: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  outline: {
    height: OUTLINE_SIZE + spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  name: {
    textAlign: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  status: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontFamily: fonts.sansMedium,
  },
  statusVisited: {
    color: colors.gold,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  primaryDone: {
    backgroundColor: colors.transparent,
  },
  primaryText: {
    color: colors.bg,
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSizes.md,
  },
  primaryTextDone: {
    color: colors.gold,
  },
  secondary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  secondaryText: {
    fontFamily: fonts.sansMedium,
  },
  soon: {
    fontSize: fontSizes.xs,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
