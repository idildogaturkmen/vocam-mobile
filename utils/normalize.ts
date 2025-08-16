import { Dimensions, PixelRatio, Platform } from 'react-native';

// Reference: iPhone 14 Pro (2022) - 393 x 852 points
const guidelineBaseWidth = 393;
const guidelineBaseHeight = 852;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SCALE_FACTOR = 0.75; // Global scaling factor for all sizes

export function scale(size: number) {
  return ((SCREEN_WIDTH / guidelineBaseWidth) * size) * SCALE_FACTOR;
}

export function verticalScale(size: number) {
  return ((SCREEN_HEIGHT / guidelineBaseHeight) * size) * SCALE_FACTOR;
}

export function moderateScale(size: number, factor = 0.5) {
  return size + (scale(size) - size) * factor;
}

export function normalizeFont(size: number) {
  const newSize = scale(size);
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
}
