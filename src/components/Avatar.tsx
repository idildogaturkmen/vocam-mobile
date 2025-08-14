import React from 'react';
import { View, Image, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { supabase } from '../../database/config';

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

const HumanAvatar: React.FC<HumanAvatarProps> = ({ 
  config, 
  size = 100, 
  seed,
  style,
  onLoad,
  onError 
}) => {
  const [error, setError] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [svgData, setSvgData] = React.useState<string | null>(null);
  const [isLoadingSvg, setIsLoadingSvg] = React.useState(false);

  // OPTIMIZED: Use SVG format for much faster loading
  const buildAvatarUrl = (simplified = false) => {
    const baseUrl = `https://api.dicebear.com/9.x/personas/svg`;
    const params = new URLSearchParams();

    // Clean seed 
    const cleanSeed = seed ? seed.replace(/[^a-zA-Z0-9]/g, '') : 'user';
    params.append('seed', cleanSeed);
    
    // SVG format - no size limit and much faster loading
    if (size > 0) {
      params.append('scale', '100'); // Always use 100% scale for crisp rendering
    }

    if (!simplified) {
      // Colors (these work)
      if (config.backgroundColor) {
        params.append('backgroundColor', config.backgroundColor);
      }
      
      if (config.skinColor) {
        params.append('skinColor', config.skinColor);
      }
      
      if (config.hairColor) {
        params.append('hairColor', config.hairColor);
      }

      if (config.clothingColor) {
        params.append('clothingColor', config.clothingColor);
      }

      // FIXED: Real feature parameters from DiceBear docs
      if (config.hair && config.hair !== 'none') {
        params.append('hair', config.hair);
      }
      
      if (config.eyes && config.eyes !== 'none') {
        params.append('eyes', config.eyes);
      }
      
      if (config.mouth && config.mouth !== 'none') {
        params.append('mouth', config.mouth);
      }

      if (config.nose && config.nose !== 'none') {
        params.append('nose', config.nose);
      }

      if (config.facialHair && config.facialHair !== 'none') {
        params.append('facialHair', config.facialHair);
        // FIXED: Add facialHairProbability to ensure facial hair actually shows
        params.append('facialHairProbability', '100');
      }

      if (config.body && config.body !== 'none') {
        params.append('body', config.body);
      }
    }

    const queryString = params.toString();
    const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

    return finalUrl;
  };

  // Load avatar URL from database or generate new one
  const loadAvatarUrl = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return buildAvatarUrl();

      // Try to get existing avatar URL from database
      const { data: avatarData } = await supabase
        .from('avatars')
        .select('avatar_url')
        .eq('user_id', user.id)
        .single();

      if (avatarData?.avatar_url) {
        return avatarData.avatar_url;
      } else {
        // Generate new URL and store it
        const newUrl = buildAvatarUrl();
        
        await supabase
          .from('avatars')
          .upsert({
            user_id: user.id,
            avatar_url: newUrl,
            avatar_config: config,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
        
        return newUrl;
      }
    } catch (error) {
      console.error('Error loading avatar URL:', error);
      return buildAvatarUrl();
    }
  };

  const [avatarUrl, setAvatarUrl] = React.useState<string>('');

  // Fetch SVG data directly for faster rendering
  const fetchSvgData = async (url: string) => {
    try {
      setIsLoadingSvg(true);
      const response = await fetch(url);
      const svgText = await response.text();
      setSvgData(svgText);
      setError(false);
      setImageLoaded(true);
      onLoad?.();
    } catch (fetchError) {
      console.error('Error fetching SVG:', fetchError);
      setError(true);
      onError?.();
    } finally {
      setIsLoadingSvg(false);
    }
  };

  const handleImageLoad = () => {
    setError(false);
    setImageLoaded(true);
    setRetryCount(0);
    onLoad?.();
  };


  const handleImageError = (errorEvent: any) => {
    console.error('❌ Avatar failed to load:', errorEvent.nativeEvent?.error || 'Unknown error');
    console.error('❌ Avatar URL was:', avatarUrl);
    
    // Try a simpler URL on error
    if (retryCount < 1) {
      setRetryCount(prev => prev + 1);
      const cleanSeed = seed ? seed.replace(/[^a-zA-Z0-9]/g, '') : 'user';
      const simpleUrl = `https://api.dicebear.com/9.x/personas/png?seed=${cleanSeed}&size=${Math.min(size, 256)}`;
      setAvatarUrl(simpleUrl);
      setImageLoaded(false);
    } else {
      setError(true);
      setImageLoaded(false);
    }
    
    onError?.();
  };

  // Update avatar URL in database when config changes
  const updateAvatarUrl = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newUrl = buildAvatarUrl();
      
      await supabase
        .from('avatars')
        .upsert({
          user_id: user.id,
          avatar_url: newUrl,
          avatar_config: config,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      setAvatarUrl(newUrl);
      setImageLoaded(false);
      setError(false);
    } catch (error) {
      console.error('Error updating avatar URL:', error);
    }
  };

  // Load initial avatar URL only once on mount
  React.useEffect(() => {
    const initializeAvatar = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // For authenticated users, try to load from database
          const { data: avatarData } = await supabase
            .from('avatars')
            .select('avatar_config')
            .eq('user_id', user.id)
            .single();
          
          // If we have saved config, use it; otherwise use current config
          const configToUse = avatarData?.avatar_config || config;
          const url = buildAvatarUrl();
          setAvatarUrl(url);
          fetchSvgData(url);
        } else {
          // For non-authenticated users, just generate URL from config
          const url = buildAvatarUrl();
          setAvatarUrl(url);
          fetchSvgData(url);
        }
      } catch (error) {
        // Fallback to building URL from config
        const url = buildAvatarUrl();
        setAvatarUrl(url);
        fetchSvgData(url);
      }
      setImageLoaded(false);
      setError(false);
    };

    if (!avatarUrl) {
      initializeAvatar();
    }
  }, []);


  // Update avatar URL when config changes and fetch SVG data
  React.useEffect(() => {
    if (config && Object.keys(config).length > 0) {
      const newUrl = buildAvatarUrl();
      // Only update if URL actually changed
      if (newUrl !== avatarUrl) {
        setAvatarUrl(newUrl);
        setImageLoaded(false);
        setError(false);
        setRetryCount(0);
        setSvgData(null);
        // Fetch SVG data immediately for faster rendering
        fetchSvgData(newUrl);
      }
    }
  }, [config, size, seed, avatarUrl]);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Show SVG if available, otherwise loading indicator */}
      {svgData ? (
        <View style={[styles.avatarContainer, { borderRadius: size / 2, overflow: 'hidden' }]}>
          <SvgXml
            xml={svgData}
            width={size}
            height={size}
          />
        </View>
      ) : isLoadingSvg ? (
        <View style={[styles.loadingContainer, { width: size, height: size, borderRadius: size / 2 }]}>
          <ActivityIndicator size="small" color="#3498db" />
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, { width: size, height: size, borderRadius: size / 2 }]}>
          {/* Fallback to Image component if SVG fails */}
          <Image
            source={{ uri: avatarUrl }}
            style={[
              styles.avatar,
              { 
                width: size, 
                height: size, 
                borderRadius: size / 2,
              }
            ]}
            onLoad={handleImageLoad}
            onError={handleImageError}
            key={`${avatarUrl}-${retryCount}`}
          />
        </View>
      ) : null}
    </View>
  );
};

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
  errorContainer: {
    backgroundColor: '#f0f0f0',
  },
  avatar: {
    backgroundColor: '#f0f0f0',
  },
});

export default HumanAvatar;