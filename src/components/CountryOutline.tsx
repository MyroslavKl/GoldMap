import { useEffect } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { getOutline } from '@/data/outlines';
import { colors } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Тривалість заливки золотом після позначки «був тут» (docs/SPEC.md → «Дизайн») */
export const FILL_DURATION_MS = 600;
const UNFILL_DURATION_MS = 300;

type Props = {
  iso2: string;
  /** Країна відвідана — силует залитий золотом */
  filled: boolean;
  /** Найбільша сторона силуету, px */
  size: number;
};

/** Золотий силует країни; при зміні `filled` плавно наливається або згасає. */
export function CountryOutline({ iso2, filled, size }: Props) {
  const outline = getOutline(iso2);
  const progress = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(filled ? 1 : 0, {
      duration: filled ? FILL_DURATION_MS : UNFILL_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [filled, progress]);

  const goldFill = useAnimatedProps(() => ({ fillOpacity: progress.value }));

  if (!outline) return null;
  const scale = size / Math.max(outline.w, outline.h);
  const pad = 2;
  const viewBox = `${-pad} ${-pad} ${outline.w + pad * 2} ${outline.h + pad * 2}`;

  return (
    <Svg
      width={(outline.w + pad * 2) * scale}
      height={(outline.h + pad * 2) * scale}
      viewBox={viewBox}
      accessible={false}>
      <Path d={outline.d} fill={colors.goldDim} fillRule="evenodd" />
      <AnimatedPath
        d={outline.d}
        fill={colors.gold}
        fillRule="evenodd"
        animatedProps={goldFill}
        stroke={colors.gold}
        strokeWidth={1.2 / scale} // ~1.2 px незалежно від розміру країни
        strokeLinejoin="round"
      />
    </Svg>
  );
}
