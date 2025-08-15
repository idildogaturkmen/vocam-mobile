import React from 'react';
import { View, Image, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { SvgXml } from 'react-native-svg';

export type AvatarStyle = 'personas';

export interface HumanAvatarConfig {
  style: AvatarStyle;
  backgroundColor?: string;
  skinColor?: string;
  hairColor?: string;
  
  // Real DiceBear Personas parameters (from official docs)
  hair?: string;
  eyes?: string;
  mouth?: string;
  nose?: string;
  facialHair?: string;
  body?: string;
  clothingColor?: string;
}

interface HumanAvatarProps {
  config: HumanAvatarConfig;
  size?: number;
  seed?: string;
  style?: ViewStyle;
  onLoad?: () => void;
  onError?: () => void;
}

// FIXED: Real DiceBear Personas API values from official documentation
export const AVATAR_OPTIONS = {
  hair: [
    { id: 'bald', name: 'Bald' },
    { id: 'balding', name: 'Balding' },
    { id: 'beanie', name: 'Beanie' },
    { id: 'bobBangs', name: 'Bob with Bangs' },
    { id: 'bobCut', name: 'Bob Cut' },
    { id: 'bunUndercut', name: 'Bun Undercut' },
    { id: 'buzzcut', name: 'Buzzcut' },
    { id: 'cap', name: 'Cap' },
    { id: 'curly', name: 'Curly' },
    { id: 'curlyBun', name: 'Curly Bun' },
    { id: 'curlyHighTop', name: 'Curly High Top' },
    { id: 'extraLong', name: 'Extra Long' },
    { id: 'fade', name: 'Fade' },
    { id: 'long', name: 'Long' },
    { id: 'mohawk', name: 'Mohawk' },
    { id: 'pigtails', name: 'Pigtails' },
    { id: 'shortCombover', name: 'Short Combover' },
    { id: 'shortComboverChops', name: 'Short Combover Chops' },
    { id: 'sideShave', name: 'Side Shave' },
    { id: 'straightBun', name: 'Straight Bun' },
  ],
  eyes: [
    { id: 'glasses', name: 'Glasses' },
    { id: 'happy', name: 'Happy' },
    { id: 'open', name: 'Open' },
    { id: 'sleep', name: 'Sleep' },
    { id: 'sunglasses', name: 'Sunglasses' },
    { id: 'wink', name: 'Wink' },
  ],
  mouth: [
    { id: 'bigSmile', name: 'Big Smile' },
    { id: 'frown', name: 'Frown' },
    { id: 'lips', name: 'Lips' },
    { id: 'pacifier', name: 'Pacifier' },
    { id: 'smile', name: 'Smile' },
    { id: 'smirk', name: 'Smirk' },
    { id: 'surprise', name: 'Surprise' },
  ],
  nose: [
    { id: 'mediumRound', name: 'Medium Round' },
    { id: 'smallRound', name: 'Small Round' },
    { id: 'wrinkles', name: 'Wrinkles' },
  ],
  facialHair: [
    { id: 'none', name: 'None' },
    { id: 'beardMustache', name: 'Beard & Mustache' },
    { id: 'goatee', name: 'Goatee' },
    { id: 'pyramid', name: 'Pyramid' },
    { id: 'shadow', name: 'Shadow' },
    { id: 'soulPatch', name: 'Soul Patch' },
    { id: 'walrus', name: 'Walrus' },
  ],
  body: [
    { id: 'checkered', name: 'Checkered' },
    { id: 'rounded', name: 'Rounded' },
    { id: 'small', name: 'Small' },
    { id: 'squared', name: 'Squared' },
  ],
};

// Real DiceBear background colors from docs
export const BACKGROUND_COLORS = [
  { id: 'b6e3f4', name: 'Sky Blue', hex: '#b6e3f4' },
  { id: 'c0aede', name: 'Lavender', hex: '#c0aede' },
  { id: 'd1d4f9', name: 'Periwinkle', hex: '#d1d4f9' },
  { id: 'ffd5dc', name: 'Pink', hex: '#ffd5dc' },
  { id: 'ffdfbf', name: 'Peach', hex: '#ffdfbf' },
];

// Real DiceBear skin colors from docs
export const SKIN_COLORS = [
  { id: '623d36', name: 'Dark', hex: '#623d36' },
  { id: '92594b', name: 'Dark Medium', hex: '#92594b' },
  { id: 'b16a5b', name: 'Medium Dark', hex: '#b16a5b' },
  { id: 'd78774', name: 'Medium', hex: '#d78774' },
  { id: 'e5a07e', name: 'Light Medium', hex: '#e5a07e' },
  { id: 'e7a391', name: 'Light', hex: '#e7a391' },
  { id: 'eeb4a4', name: 'Very Light', hex: '#eeb4a4' },
];

// Real DiceBear hair colors from docs
export const HAIR_COLORS = [
  { id: '6c4545', name: 'Dark Brown', hex: '#6c4545' },
  { id: '362c47', name: 'Black', hex: '#362c47' },
  { id: 'dee1f5', name: 'Light Gray', hex: '#dee1f5' },
  { id: 'e15c66', name: 'Red', hex: '#e15c66' },
  { id: 'e16381', name: 'Pink', hex: '#e16381' },
  { id: 'f27d65', name: 'Orange', hex: '#f27d65' },
  { id: 'f29c65', name: 'Light Orange', hex: '#f29c65' },
];

// Real DiceBear clothing colors from docs
export const CLOTHING_COLORS = [
  { id: '6dbb58', name: 'Green', hex: '#6dbb58' },
  { id: '54d7c7', name: 'Teal', hex: '#54d7c7' },
  { id: '456dff', name: 'Blue', hex: '#456dff' },
  { id: '7555ca', name: 'Purple', hex: '#7555ca' },
  { id: 'e24553', name: 'Red', hex: '#e24553' },
  { id: 'f3b63a', name: 'Orange', hex: '#f3b63a' },
  { id: 'f55d81', name: 'Pink', hex: '#f55d81' },
];

const HumanAvatar: React.FC<HumanAvatarProps> = React.memo(({ 
  config, 
  size = 100, 
  seed,
  style,
  onLoad,
  onError 
}) => {
  const [error, setError] = React.useState(false);
  const [svgData, setSvgData] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Optimized URL building with proper memoization
  const avatarUrl = React.useMemo(() => {
    const baseUrl = `https://api.dicebear.com/9.x/personas/svg`;
    const params = new URLSearchParams();

    // Clean seed 
    const cleanSeed = seed ? seed.replace(/[^a-zA-Z0-9]/g, '') : 'user';
    params.append('seed', cleanSeed);
    params.append('scale', '100');

    // Add configuration parameters
    if (config.backgroundColor) params.append('backgroundColor', config.backgroundColor);
    if (config.skinColor) params.append('skinColor', config.skinColor);
    if (config.hairColor) params.append('hairColor', config.hairColor);
    if (config.clothingColor) params.append('clothingColor', config.clothingColor);
    if (config.hair && config.hair !== 'none') params.append('hair', config.hair);
    if (config.eyes && config.eyes !== 'none') params.append('eyes', config.eyes);
    if (config.mouth && config.mouth !== 'none') params.append('mouth', config.mouth);
    if (config.nose && config.nose !== 'none') params.append('nose', config.nose);
    if (config.body && config.body !== 'none') params.append('body', config.body);
    
    if (config.facialHair && config.facialHair !== 'none') {
      params.append('facialHair', config.facialHair);
      params.append('facialHairProbability', '100');
    }

    return `${baseUrl}?${params.toString()}`;
  }, [config, seed]);

  // Optimized fetch function with proper cleanup
  const fetchSvgData = React.useCallback(async (url: string) => {
    try {
      setError(false);
      setIsLoading(true);
      
      // Cancel previous requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Create new controller for this request
      abortControllerRef.current = new AbortController();
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 5000);
      fetchTimeoutRef.current = timeoutId;
      
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        cache: 'force-cache',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const svgText = await response.text();
      
      // Use setTimeout to prevent blocking UI
      setTimeout(() => {
        setSvgData(svgText);
        setError(false);
        onLoad?.();
      }, 0);
      
    } catch (fetchError: any) {
      if (fetchError.name !== 'AbortError') {
        setTimeout(() => {
          setError(true);
          onError?.();
        }, 0);
      }
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 0);
    }
  }, [onLoad, onError]);

  // Single effect to handle URL changes
  React.useEffect(() => {
    if (avatarUrl) {
      setSvgData(null);
      fetchSvgData(avatarUrl);
    }
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [avatarUrl, fetchSvgData]);

  // Render with minimal DOM manipulation
  const containerStyle = React.useMemo(() => [
    styles.container, 
    { width: size, height: size }, 
    style
  ], [size, style]);

  const avatarContainerStyle = React.useMemo(() => [
    styles.avatarContainer, 
    { borderRadius: size / 2, overflow: 'hidden' }
  ], [size]);

  const loadingContainerStyle = React.useMemo(() => [
    styles.loadingContainer, 
    { width: size, height: size, borderRadius: size / 2 }
  ], [size]);

  return (
    <View style={containerStyle}>
      {svgData ? (
        <View style={avatarContainerStyle}>
          <SvgXml
            xml={svgData}
            width={size}
            height={size}
          />
        </View>
      ) : isLoading ? (
        <View style={loadingContainerStyle}>
          <ActivityIndicator size="small" color="#3498db" />
        </View>
      ) : error ? (
        <View style={loadingContainerStyle}>
          <Image
            source={{ uri: `https://api.dicebear.com/9.x/personas/png?seed=${seed?.replace(/[^a-zA-Z0-9]/g, '') || 'user'}&size=${Math.min(size, 256)}` }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            onLoad={() => {
              setError(false);
              onLoad?.();
            }}
            onError={() => {
              setError(true);
              onError?.();
            }}
          />
        </View>
      ) : null}
    </View>
  );
}, (prevProps, nextProps) => {
  // Optimized comparison function - no logging
  if (prevProps.size !== nextProps.size || prevProps.seed !== nextProps.seed) {
    return false;
  }
  
  const prevConfig = prevProps.config;
  const nextConfig = nextProps.config;
  
  return (
    prevConfig.style === nextConfig.style &&
    prevConfig.backgroundColor === nextConfig.backgroundColor &&
    prevConfig.skinColor === nextConfig.skinColor &&
    prevConfig.hairColor === nextConfig.hairColor &&
    prevConfig.clothingColor === nextConfig.clothingColor &&
    prevConfig.hair === nextConfig.hair &&
    prevConfig.eyes === nextConfig.eyes &&
    prevConfig.mouth === nextConfig.mouth &&
    prevConfig.nose === nextConfig.nose &&
    prevConfig.facialHair === nextConfig.facialHair &&
    prevConfig.body === nextConfig.body
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  avatarContainer: {
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HumanAvatar;