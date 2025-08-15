import * as Speech from 'expo-speech';
import { Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';
import AudioManager from './AudioManager';

interface VoiceInfo {
  identifier: string;
  language: string;
  quality: Speech.VoiceQuality;
  name: string;
}

interface SpeechOptions {
  language: string;
  pitch: number;
  rate: number;
  volume: number;
  quality: Speech.VoiceQuality;
  voice?: string;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

class SpeechService {
  private isSpeaking: boolean = false;
  private speechQueue: string[] = [];
  private isInitialized: boolean = false;
  private availableVoices: VoiceInfo[] = [];
  private audioConfigured: boolean = false;
  private silentModeOverrideAttempted: boolean = false;
  
  private languageMapping: Record<string, string> = {
    // Enhanced mappings with primary and fallback variants
    'ar': 'ar-SA',      // Arabic (Saudi Arabia - most supported)
    'ko': 'ko-KR',      // Korean
    'fa': 'fa-IR',      // Persian (Iran)
    
    // East Asian languages with improved mappings
    'zh-CN': 'zh-CN',   // Chinese (Simplified)
    'zh-TW': 'zh-TW',   // Chinese (Traditional)
    'ja': 'ja-JP',      // Japanese
    'th': 'th-TH',      // Thai
    
    // South Asian languages
    'hi': 'hi-IN',      // Hindi
    'bn': 'bn-IN',      // Bengali (try India first, then Bangladesh)
    'gu': 'gu-IN',      // Gujarati
    'pa': 'pa-IN',      // Punjabi
    'ur': 'ur-PK',      // Urdu
    'ta': 'ta-IN',      // Tamil
    'te': 'te-IN',      // Telugu
    
    // Semitic languages
    'he': 'he-IL',      // Hebrew
    
    // African languages
    'sw': 'sw-TZ',      // Swahili (Tanzania - more native)
    
    // European languages
    'bg': 'bg-BG',      // Bulgarian
    'hr': 'hr-HR',      // Croatian
    'cs': 'cs-CZ',      // Czech
    'da': 'da-DK',      // Danish
    'nl': 'nl-NL',      // Dutch
    'fi': 'fi-FI',      // Finnish
    'fr': 'fr-FR',      // French
    'de': 'de-DE',      // German
    'el': 'el-GR',      // Greek
    'hu': 'hu-HU',      // Hungarian
    'is': 'is-IS',      // Icelandic
    'it': 'it-IT',      // Italian
    'no': 'nb-NO',      // Norwegian
    'pl': 'pl-PL',      // Polish
    'pt': 'pt-PT',      // Portuguese
    'ro': 'ro-RO',      // Romanian
    'ru': 'ru-RU',      // Russian
    'sr': 'sr-RS',      // Serbian
    'sk': 'sk-SK',      // Slovak
    'es': 'es-ES',      // Spanish
    'sv': 'sv-SE',      // Swedish
    'tr': 'tr-TR',      // Turkish
    'uk': 'uk-UA',      // Ukrainian
    
    // Southeast Asian
    'id': 'id-ID',      // Indonesian
    'ms': 'ms-MY',      // Malay
    'tl': 'fil-PH',     // Filipino (Tagalog)
    'vi': 'vi-VN',      // Vietnamese
    
    // Classical/Other
    'la': 'la',         // Latin
    'en': 'en-US'       // English (default)
  };

  // Alternative language variants to try if primary fails
  private languageVariants: Record<string, string[]> = {
    'zh-CN': ['zh-CN', 'zh-Hans', 'zh', 'cmn'],
    'zh-TW': ['zh-TW', 'zh-Hant', 'zh', 'cmn'],
    'ja': ['ja-JP', 'ja'],
    'th': ['th-TH', 'th'],
    'hi': ['hi-IN', 'hi'],
    'bn': ['bn-IN', 'bn-BD', 'bn'],
    'gu': ['gu-IN', 'gu'],
    'he': ['he-IL', 'he', 'iw'],
    'ar': ['ar-SA', 'ar-EG', 'ar-AE', 'ar'],
    'sw': ['sw-TZ', 'sw-KE', 'sw'],
    'ko': ['ko-KR', 'ko'],
    'pa': ['pa-IN', 'pa-PK', 'pa'],
    'ur': ['ur-PK', 'ur-IN', 'ur'],
    'fa': ['fa-IR', 'fa-AF', 'fa'],
    'ta': ['ta-IN', 'ta-LK', 'ta'],
    'te': ['te-IN', 'te']
  };

  // Language families for intelligent fallbacks
  private languageFamilies: Record<string, string[]> = {
    'germanic': ['en', 'de', 'nl', 'sv', 'da', 'no', 'is'],
    'romance': ['es', 'fr', 'it', 'pt', 'ro'],
    'slavic': ['ru', 'pl', 'cs', 'sk', 'hr', 'sr', 'bg', 'uk'],
    'indo_iranian': ['hi', 'ur', 'fa', 'pa', 'gu'],
    'sino_tibetan': ['zh-CN', 'zh-TW'],
    'arabic_semitic': ['ar', 'he'],
    'turkic': ['tr'],
    'finno_ugric': ['fi', 'hu'],
    'mon_khmer': ['vi'],
    'japanese': ['ja'],
    'korean': ['ko'],
    'thai': ['th'],
    'malayo_polynesian': ['id', 'ms', 'tl'],
    'dravidian': ['ta', 'te'],
    'niger_congo': ['sw'],
    'indo_european': ['bn'],
    'greek': ['el'],
    'latin': ['la']
  };

  // Fallback languages for when primary language isn't available
  private getFallbackLanguage(language: string): string {
    // First try to find language family
    for (const [family, languages] of Object.entries(this.languageFamilies)) {
      if (languages.includes(language)) {
        // Find the first available language in the same family
        for (const fallbackLang of languages) {
          if (fallbackLang !== language && this.isLanguageSupported(fallbackLang)) {
            console.log(`🔄 Using ${fallbackLang} as fallback for ${language} (same ${family} family)`);
            return fallbackLang;
          }
        }
      }
    }

    // If no family fallback, use geographic/cultural proximity with better non-Latin support
    const geographicFallbacks: Record<string, string> = {
      // Nordic/Germanic
      'is': 'da',        // Icelandic -> Danish (historical connection)
      
      // Classical/Romance  
      'la': 'it',        // Latin -> Italian (historical connection)
      
      // Southeast Asian
      'ms': 'id',        // Malay -> Indonesian (very similar)
      'tl': 'es',        // Filipino -> Spanish (historical influence)
      
      // Middle Eastern/Arabic script languages
      'fa': 'ar',        // Persian -> Arabic (similar script, may work better)
      
      // Non-Latin alphabet fallbacks to English for clear pronunciation
      'ar': 'en',        // Arabic -> English (clear pronunciation for vocabulary learning)
      'ko': 'en',        // Korean -> English (Korean TTS often poor quality on mobile)
      'zh-CN': 'en',     // Chinese -> English (Mandarin TTS not widely available)
      'zh-TW': 'en',     // Chinese Traditional -> English 
      'ja': 'en',        // Japanese -> English (hiragana/katakana pronunciation complex)
      'th': 'en',        // Thai -> English (Thai script TTS unreliable)
      'he': 'en',        // Hebrew -> English (Hebrew TTS availability issues)
      'ru': 'en',        // Russian -> English (Cyrillic script issues)
      'hi': 'en',        // Hindi -> English (if Hindi TTS unavailable)
      'sw': 'en',        // Swahili -> English (East African English common)
      
      // South Asian languages - use Hindi as intermediate fallback, then English
      'bn': 'hi',        // Bengali -> Hindi -> English
      'gu': 'hi',        // Gujarati -> Hindi -> English  
      'pa': 'hi',        // Punjabi -> Hindi -> English
      'te': 'hi',        // Telugu -> Hindi -> English
      'ta': 'hi',        // Tamil -> Hindi -> English
      'ur': 'hi',        // Urdu -> Hindi (similar phonetics)
    };

    const fallback = geographicFallbacks[language];
    if (fallback && this.isLanguageSupported(fallback)) {
      console.log(`🔄 Using ${fallback} as geographic fallback for ${language}`);
      return fallback;
    }

    // Ultimate fallback to English
    console.log(`🔄 Using English as ultimate fallback for ${language}`);
    return 'en';
  }

  private isLanguageSupported(language: string): boolean {
    const targetLang = this.languageMapping[language] || language;
    const langPrefix = targetLang.split('-')[0];
    
    return this.availableVoices.some(voice => {
      const voiceLangPrefix = voice.language.split('-')[0];
      return voiceLangPrefix.toLowerCase() === langPrefix.toLowerCase();
    });
  }

  private getBestVoice(language: string): VoiceInfo | null {
    try {
      // First try all variants of the requested language
      const variants = this.languageVariants[language] || [this.languageMapping[language] || language];
      
      for (const variant of variants) {
        const langPrefix = variant.split('-')[0];
        
        // Try exact match first
        const exactMatches = this.availableVoices.filter(voice => 
          voice.language.toLowerCase() === variant.toLowerCase()
        );
        
        if (exactMatches.length > 0) {
          console.log(`✅ Found exact voice match for ${language}: ${variant}`);
          return this.selectBestVoiceFromList(exactMatches);
        }
        
        // Try prefix match
        const prefixMatches = this.availableVoices.filter(voice => {
          const voiceLangPrefix = voice.language.split('-')[0];
          return voiceLangPrefix.toLowerCase() === langPrefix.toLowerCase();
        });
        
        if (prefixMatches.length > 0) {
          console.log(`✅ Found prefix voice match for ${language}: ${langPrefix}`);
          return this.selectBestVoiceFromList(prefixMatches);
        }
      }

      console.warn(`⚠️ No voices found for language variants: ${variants.join(', ')}`);
      
      // Try fallback language
      const fallbackLang = this.getFallbackLanguage(language);
      if (fallbackLang !== language) {
        console.log(`🔄 Trying fallback language: ${fallbackLang} for ${language}`);
        const fallbackVoice = this.getBestVoice(fallbackLang);
        
        if (fallbackVoice) {
          console.log(`✅ Found fallback voice for ${language} using ${fallbackLang}`);
          return fallbackVoice;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error selecting voice:', error);
      return null;
    }
  }

  private selectBestVoiceFromList(voices: VoiceInfo[]): VoiceInfo {
    // Special handling for better quality non-Latin alphabet languages
    const languageCode = voices[0]?.language?.split('-')[0]?.toLowerCase();
    
    if (['ko', 'ar', 'ja', 'zh', 'th', 'he', 'ru'].includes(languageCode)) {
      // For non-Latin alphabets, prioritize Enhanced quality voices
      const enhancedVoices = voices.filter(v => 
        v.quality === Speech.VoiceQuality.Enhanced
      );
      
      if (enhancedVoices.length > 0) {
        // For Korean, prefer specific voices if available
        if (languageCode === 'ko') {
          const koreanFemale = enhancedVoices.find(v => 
            v.name.toLowerCase().includes('female') || 
            v.name.toLowerCase().includes('yuna') ||
            v.name.toLowerCase().includes('sora')
          );
          if (koreanFemale) return koreanFemale;
        }
        
        // For Arabic, prefer specific regional voices
        if (languageCode === 'ar') {
          const arabicGood = enhancedVoices.find(v =>
            v.name.toLowerCase().includes('female') ||
            v.language.includes('SA') || // Saudi Arabic often better supported
            v.name.toLowerCase().includes('noor')
          );
          if (arabicGood) return arabicGood;
        }
        
        // For South Asian languages, prefer specific voices
        if (['hi', 'bn', 'gu', 'pa', 'ta', 'te', 'ur'].includes(languageCode)) {
          const indianVoice = enhancedVoices.find(v =>
            v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('india') ||
            v.language.includes('IN') ||
            v.name.toLowerCase().includes('priya') ||
            v.name.toLowerCase().includes('lekha')
          );
          if (indianVoice) return indianVoice;
        }
        
        // For Hebrew, prefer specific voices
        if (languageCode === 'he') {
          const hebrewVoice = enhancedVoices.find(v =>
            v.name.toLowerCase().includes('female') ||
            v.language.includes('IL') ||
            v.name.toLowerCase().includes('carmit')
          );
          if (hebrewVoice) return hebrewVoice;
        }
        
        return enhancedVoices[0];
      }
    }
    
    // For iOS silent mode, prioritize non-eloquence voices as they work better
    if (Platform.OS === 'ios') {
      const nonEloquenceVoices = voices.filter(v => 
        !v.identifier.includes('eloquence')
      );
      
      if (nonEloquenceVoices.length > 0) {
        const enhanced = nonEloquenceVoices.filter(v => 
          v.quality === Speech.VoiceQuality.Enhanced
        );
        
        if (enhanced.length > 0) {
          return enhanced[0];
        }
        return nonEloquenceVoices[0];
      }
      
      // Fallback to any enhanced voice
      const enhanced = voices.filter(v => 
        v.quality === Speech.VoiceQuality.Enhanced
      );
      if (enhanced.length > 0) {
        return enhanced[0];
      }
    }

    // Return the first available voice
    return voices[0];
  }

  async speak(text: string, language: string = 'en'): Promise<void> {
    try {
      if (this.isSpeaking) {
        console.log('Already speaking, stopping current speech...');
        await this.stop();
      }

      const cleanText = this.cleanTextForSpeech(text);
      if (!cleanText) {
        console.warn('No valid text to speak');
        return;
      }

      console.log(`🔊 Speaking: "${cleanText}" in ${language}`);

      await this.prepareForPlayback();

      let actualLanguage = language;
      let selectedVoice = this.getBestVoice(language);

      // If no voice found, try fallback
      if (!selectedVoice) {
        const fallbackLang = this.getFallbackLanguage(language);
        if (fallbackLang !== language) {
          actualLanguage = fallbackLang;
          selectedVoice = this.getBestVoice(fallbackLang);
          
          if (selectedVoice) {
            console.log(`🔄 Speaking in ${fallbackLang} instead of ${language}`);
          } else {
            console.warn(`⚠️ No voice available for ${language} or fallback ${fallbackLang}`);
            // Try emergency speak with further fallbacks
            await this.emergencySpeak(cleanText, language);
            return;
          }
        } else {
          console.warn(`⚠️ No voice available for ${language} and no suitable fallback found`);
          await this.emergencySpeak(cleanText, language);
          return;
        }
      }

      const targetLang = this.languageMapping[actualLanguage] || actualLanguage;
      const rate = this.getOptimalRate(actualLanguage);

      const options: Speech.SpeechOptions = {
        language: targetLang,
        pitch: 1.0,
        rate: rate,
        volume: 1.0,
        ...(selectedVoice && { voice: selectedVoice.identifier }),
        onStart: () => {
          this.isSpeaking = true;
          console.log(`🎵 Speech started with voice: ${selectedVoice?.name || 'default'}`);
        },
        onDone: () => {
          this.isSpeaking = false;
          console.log('✅ Speech completed');
        },
        onError: (error: any) => {
          this.isSpeaking = false;
          console.error('❌ Speech error:', error);
          // Try emergency fallback
          this.emergencySpeak(cleanText, 'en');
        }
      };

      await Speech.speak(cleanText, options);

    } catch (error) {
      this.isSpeaking = false;
      console.error('❌ Speech service error:', error);
      
      // Emergency fallback with most basic settings
      await this.emergencySpeak(text, language);
    }
  }

  private async emergencySpeak(text: string, originalLanguage: string): Promise<void> {
    try {
      const cleanText = this.cleanTextForSpeech(text);
      
      // For languages with no TTS support, immediately fallback to English with explanation
      const noTTSLanguages = ['zh-CN', 'zh-TW', 'ja', 'th', 'ar', 'he', 'hi', 'bn', 'gu', 'pa', 'ta', 'te', 'ur'];
      
      if (noTTSLanguages.includes(originalLanguage)) {
        console.log(`🔄 Language ${originalLanguage} has limited TTS support, using English pronunciation`);
        await this.tryEnglishFallback(cleanText);
        return;
      }
      
      // Try fallback language first if original isn't available
      let tryLanguage = originalLanguage;
      if (!this.isLanguageSupported(originalLanguage)) {
        tryLanguage = this.getFallbackLanguage(originalLanguage);
        console.log(`🔄 Emergency speech: Using ${tryLanguage} fallback for ${originalLanguage}`);
      }
      
      // Try language with minimal options
      const basicOptions: Speech.SpeechOptions = {
        language: this.languageMapping[tryLanguage] || tryLanguage,
        volume: 1.0,
        rate: 0.6,
        pitch: 1.0,
        onStart: () => console.log('🔄 Emergency speech started'),
        onDone: () => console.log('✅ Emergency speech completed'),
        onError: (e: any) => {
          console.error('❌ Emergency speech failed:', e);
          // Try English as last resort
          this.tryEnglishFallback(cleanText);
        }
      };

      await Speech.speak(cleanText, basicOptions);
    } catch (emergencyError) {
      console.error('❌ Complete speech system failure:', emergencyError);
      await this.tryEnglishFallback(text);
    }
  }

  private async tryEnglishFallback(text: string): Promise<void> {
    try {
      console.log('🔄 Trying English fallback...');
      await Speech.speak(text, {
        language: 'en-US',
        volume: 1.0,
        rate: 0.6,
        pitch: 1.0,
        onError: () => {},
        onDone: () => console.log('✅ English fallback completed')
      });
    } catch (e) {
      console.error('❌ Even English fallback failed');
      // Show user-friendly message without blocking the app
      setTimeout(() => {
        Alert.alert(
          'Speech Not Available', 
          'Text-to-speech is not available for this language on your device. You can still learn the word visually!',
          [{ text: 'OK', style: 'default' }]
        );
      }, 100);
    }
  }

  // Add method to check language support
  public isLanguageAvailable(language: string): boolean {
    const directSupport = this.isLanguageSupported(language);
    if (directSupport) return true;
    
    // Check if fallback is available
    const fallback = this.getFallbackLanguage(language);
    return fallback !== language && this.isLanguageSupported(fallback);
  }

  // Add method to get language info for UI
  public getLanguageInfo(language: string): { 
    available: boolean; 
    fallback?: string; 
    message?: string 
  } {
    if (this.isLanguageSupported(language)) {
      return { available: true };
    }
    
    const fallback = this.getFallbackLanguage(language);
    if (fallback !== language && this.isLanguageSupported(fallback)) {
      const fallbackName = this.getLanguageName(fallback);
      return { 
        available: true, 
        fallback: fallback,
        message: `Using ${fallbackName} pronunciation as fallback`
      };
    }
    
    return { 
      available: false, 
      message: 'Speech not available for this language on your device'
    };
  }

  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
      'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
      'ko': 'Korean', 'zh-CN': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
      'da': 'Danish', 'sv': 'Swedish', 'no': 'Norwegian', 'is': 'Icelandic'
    };
    return names[code] || code.toUpperCase();
  }

  async initialize(): Promise<boolean> {
    try {
      // Configure iOS audio for silent mode override
      if (Platform.OS === 'ios') {
        await this.configureSilentModeOverride();
      }

      // Get available voices
      this.availableVoices = await Speech.getAvailableVoicesAsync();
      this.isInitialized = true;

      // Debug: Log available voices for troubleshooting
      this.debugAvailableVoices();

      return true;
    } catch (error) {
      console.error('❌ Speech Service initialization failed:', error);
      return false;
    }
  }

  private debugAvailableVoices(): void {
    // Found available voices (logging disabled for performance)
    
    // Group voices by language for easier debugging
    const voicesByLang: Record<string, VoiceInfo[]> = {};
    this.availableVoices.forEach(voice => {
      const langCode = voice.language.split('-')[0];
      if (!voicesByLang[langCode]) {
        voicesByLang[langCode] = [];
      }
      voicesByLang[langCode].push(voice);
    });

    // Log problematic languages specifically
    const problematicLangs = ['zh', 'ja', 'th', 'ar', 'ko', 'hi', 'bn', 'gu', 'he', 'sw'];
    problematicLangs.forEach(lang => {
      if (voicesByLang[lang]) {
        // Language voice details logging disabled for performance
      } else {
        // No voices logging disabled for performance
      }
    });
  }

  private async prepareForPlayback(): Promise<void> {
    try {
      // Use the centralized AudioManager
      await AudioManager.configureForPlayback();
    } catch (error: any) {
      console.log('⚠️ Audio preparation warning:', error.message);
    }
  }

  private async configureSilentModeOverride(): Promise<void> {
    if (this.silentModeOverrideAttempted) {
      return; // Don't repeat if already attempted
    }
    this.silentModeOverrideAttempted = true;
    
    // Try expo-av directly since expo-audio is not commonly available
    const avSuccess = await this.tryExpoAV();
    if (avSuccess) {
      this.audioConfigured = true;
      return;
    }
    
    // iOS-specific speech configuration
    await this.tryIOSSpeechConfig();
  }

  private async tryExpoAV(): Promise<boolean> {
    try {
      // Note: expo-av is deprecated and will be removed in SDK 54
      // This is temporary until we migrate to expo-audio/expo-video
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      return true;
    } catch (error: any) {
      console.log('⚠️ expo-av configuration failed (deprecated library):', error.message);
      return false;
    }
  }

  private async tryIOSSpeechConfig(): Promise<void> {
    // iOS-specific: Use speech synthesis with maximum force settings
    try {
      // Pre-configure speech with a silent utterance to "wake up" the audio system
      await Speech.speak(' ', {
        language: 'en-US',
        rate: 10,
        volume: 0.001, // Nearly silent
        onError: () => {}, // Ignore errors
        onDone: () => {}
      });

    } catch (error: any) {
      console.log('⚠️ iOS speech priming failed:', error.message);
    }
  }

  private async performSpeechWithForce(text: string, language: string): Promise<void> {
    const voice = await this.getBestVoice(language);

    // Store quality for internal logic, but do not include in SpeechOptions
    const quality = voice?.quality || Speech.VoiceQuality.Default;

    const options: Speech.SpeechOptions = {
      language: voice?.language || this.languageMapping[language] || language,
      pitch: 1.0,
      rate: this.getOptimalRate(language),
      volume: 1.0,
      // quality: quality, // Not included in SpeechOptions, but available for logic
      
      onStart: () => {
        this.isSpeaking = true;
      },
      onDone: () => {
        this.isSpeaking = false;
        this.processQueue();
      },
      onError: (error: Error) => {
        this.isSpeaking = false;
        console.error('❌ Speech error:', error);
        this.handleSpeechError(text, language, error);
      }
    };

    if (voice?.identifier) {
      options.voice = voice.identifier;
    }
    // Execute speech
    await Speech.speak(text, options);
  }

  private async emergencyFallback(text: string, language: string): Promise<void> {
    try {
      // Most basic speech possible with iOS silent mode hints
      const basicOptions: Partial<Speech.SpeechOptions> = {
        language: this.languageMapping[language] || language,
        rate: 0.7,
        volume: 1.0,
        pitch: 1.0,
        quality: Speech.VoiceQuality.Enhanced,
        // Try to hint to iOS that this is important
        ...(Platform.OS === 'ios' && {
          quality: Speech.VoiceQuality.Enhanced,
        }),
        onStart: () => console.log('🔄 Emergency speech started'),
        onDone: () => console.log('✅ Emergency speech completed'),
        onError: (e: any) => console.error('❌ Emergency speech failed:', e)
      };

      await Speech.speak(text, basicOptions);
    } catch (emergencyError) {
      console.error('❌ Complete speech system failure:', emergencyError);
      
      // Last resort: Try English
      if (language !== 'en') {
        try {
          await Speech.speak(text, {
            language: 'en-US',
            volume: 1.0,
            onError: () => {}
          });
        } catch (e) {
          console.error('❌ Even English fallback failed');
        }
      }
    }
  }

  private cleanTextForSpeech(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      // Remove URL encodings
      .replace(/%20/g, ' ')
      .replace(/%([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      
      // Remove HTML entities
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      
      // Clean whitespace but preserve Unicode
      .replace(/\s+/g, ' ')
      
      // Remove only control characters that cause speech issues
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/[""'']/g, '"')
      .replace(/[…]/g, '...')
      
      .trim();
  }

  private getOptimalRate(language: string): number {
    const rates: Record<string, number> = {
      'zh-CN': Platform.select({ ios: 0.4, android: 0.5, default: 0.45 }) || 0.45,
      'zh-TW': Platform.select({ ios: 0.4, android: 0.5, default: 0.45 }) || 0.45,
      'ja': Platform.select({ ios: 0.45, android: 0.55, default: 0.5 }) || 0.5,
      'ko': Platform.select({ ios: 0.45, android: 0.55, default: 0.5 }) || 0.5,
      'ar': Platform.select({ ios: 0.5, android: 0.6, default: 0.55 }) || 0.55,
      'he': Platform.select({ ios: 0.5, android: 0.6, default: 0.55 }) || 0.55,
      'ru': Platform.select({ ios: 0.5, android: 0.6, default: 0.55 }) || 0.55,
      'de': Platform.select({ ios: 0.55, android: 0.65, default: 0.6 }) || 0.6,
      'es': Platform.select({ ios: 0.6, android: 0.7, default: 0.65 }) || 0.65,
      'fr': Platform.select({ ios: 0.6, android: 0.7, default: 0.65 }) || 0.65,
      'pt': Platform.select({ ios: 0.55, android: 0.65, default: 0.6 }) || 0.6,
      'it': Platform.select({ ios: 0.6, android: 0.7, default: 0.65 }) || 0.65,
      'hi': Platform.select({ ios: 0.55, android: 0.65, default: 0.6 }) || 0.6,
      'bn': Platform.select({ ios: 0.55, android: 0.65, default: 0.6 }) || 0.6,
      'en': Platform.select({ ios: 0.55, android: 0.7, default: 0.6 }) || 0.6
    };

    return rates[language] || Platform.select({ 
      ios: 0.55, 
      android: 0.7, 
      default: 0.6 
    }) || 0.6;
  }

  private async handleSpeechError(text: string, language: string, error: Error): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      await Speech.speak(text, {
        language: this.languageMapping[language] || language,
        rate: 0.7,
        volume: 1.0,
        onStart: () => console.log('🔄 Recovery speech started'),
        onError: () => { this.emergencyFallback(text, language); }
      });
    } catch (recoveryError) {
      await this.emergencyFallback(text, language);
    }
  }

  async speakQueue(textArray: string[], language: string = 'en'): Promise<void> {
    this.speechQueue = [...textArray];
    await this.processQueue(language);
  }

  private async processQueue(language: string = 'en'): Promise<void> {
    if (this.speechQueue.length > 0 && !this.isSpeaking) {
      const nextText = this.speechQueue.shift();
      if (nextText) {
        await this.speak(nextText, language);
      }
    }
  }

  async stop(): Promise<void> {
    try {
      await Speech.stop();
      this.isSpeaking = false;
      this.speechQueue = [];
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  }

  async checkAvailability(language: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const langCode = this.languageMapping[language] || language;
      const langPrefix = langCode.split('-')[0];
      
      const available = this.availableVoices.some(voice => 
        voice.language.toLowerCase().startsWith(langPrefix.toLowerCase())
      );
      return available;
    } catch (error) {
      console.error('Error checking language availability:', error);
      return false;
    }
  }

  private async resetAudioConfiguration(): Promise<void> {
    try {
      // Stop any current speech
      if (this.isSpeaking) {
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
        
      // Reconfigure audio for maximum volume
      if (Platform.OS === 'ios') {
        await this.configureSilentModeOverride();
      }
      
      // Reset volume to maximum
      this.audioConfigured = true;
    } catch (error) {
      console.error('Error resetting audio:', error);
    }
  }

  getAudioStatus(): {
    audioLibrary: string;
    audioConfigured: boolean;
    initialized: boolean;
    voicesAvailable: number;
    forceMode: boolean;
  } {
    return {
      audioLibrary: 'expo-av',
      initialized: this.isInitialized,
      audioConfigured: this.audioConfigured,
      voicesAvailable: this.availableVoices.length,
      forceMode: true
    };
  }
  
  isAvailable(): boolean {
    return this.isInitialized && this.availableVoices.length > 0;
  }
}

export default new SpeechService();