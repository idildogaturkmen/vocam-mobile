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
    'ar': 'ar-SA',      // Arabic
    'bn': 'bn-BD',      // Bengali
    'bg': 'bg-BG',      // Bulgarian
    'zh-CN': 'zh-CN',   // Chinese (Simplified)
    'zh-TW': 'zh-TW',   // Chinese (Traditional)
    'hr': 'hr-HR',      // Croatian
    'cs': 'cs-CZ',      // Czech
    'da': 'da-DK',      // Danish
    'nl': 'nl-NL',      // Dutch
    'tl': 'fil-PH',     // Filipino (Tagalog)
    'fi': 'fi-FI',      // Finnish
    'fr': 'fr-FR',      // French
    'de': 'de-DE',      // German
    'el': 'el-GR',      // Greek
    'gu': 'gu-IN',      // Gujarati
    'he': 'he-IL',      // Hebrew
    'hi': 'hi-IN',      // Hindi
    'hu': 'hu-HU',      // Hungarian
    'is': 'is-IS',      // Icelandic
    'id': 'id-ID',      // Indonesian
    'it': 'it-IT',      // Italian
    'ja': 'ja-JP',      // Japanese
    'ko': 'ko-KR',      // Korean
    'la': 'la',         // Latin
    'ms': 'ms-MY',      // Malay
    'no': 'nb-NO',      // Norwegian
    'fa': 'fa-IR',      // Persian (Farsi)
    'pl': 'pl-PL',      // Polish
    'pt': 'pt-PT',      // Portuguese
    'pa': 'pa-IN',      // Punjabi
    'ro': 'ro-RO',      // Romanian
    'ru': 'ru-RU',      // Russian
    'sr': 'sr-RS',      // Serbian
    'sk': 'sk-SK',      // Slovak
    'es': 'es-ES',      // Spanish
    'sw': 'sw-KE',      // Swahili
    'sv': 'sv-SE',      // Swedish
    'ta': 'ta-IN',      // Tamil
    'te': 'te-IN',      // Telugu
    'th': 'th-TH',      // Thai
    'tr': 'tr-TR',      // Turkish
    'uk': 'uk-UA',      // Ukrainian
    'ur': 'ur-PK',      // Urdu
    'vi': 'vi-VN',      // Vietnamese
    'en': 'en-US'       // English (default)
  };

  async initialize(): Promise<boolean> {
    try {
      // Configure iOS audio for silent mode override
      if (Platform.OS === 'ios') {
        await this.configureSilentModeOverride();
      }

      // Get available voices
      this.availableVoices = await Speech.getAvailableVoicesAsync();
      this.isInitialized = true;

      return true;
    } catch (error) {
      console.error('❌ Speech Service initialization failed:', error);
      return false;
    }
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
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      return true;
    } catch (error: any) {
      console.log('⚠️ expo-av configuration failed:', error.message);
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

  async speak(text: string, language: string = 'en'): Promise<void> {
    try {
      if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn('❌ No valid text to speak:', text);
        return;
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      // IMPORTANT: Always prepare audio for playback before speaking
      await this.prepareForPlayback();
      
      // Add extra delay to ensure audio system is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const cleanText = this.cleanTextForSpeech(text);
      
      if (!cleanText || cleanText.trim() === '') {
        console.error('❌ Text became empty after cleaning. Using original text.');
        const finalText = text.trim();
        if (!finalText) return;
        return await this.performSpeechWithForce(finalText, language);
      }
      return await this.performSpeechWithForce(cleanText, language);
      
    } catch (error) {
      console.error('❌ Speech error:', error);
      await this.emergencyFallback(text, language);
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

  private getBestVoice(language: string): VoiceInfo | null {
    try {
      const targetLang = this.languageMapping[language] || language;
      const langPrefix = targetLang.split('-')[0];
      
      const matchingVoices = this.availableVoices.filter(voice => {
        const voiceLangPrefix = voice.language.split('-')[0];
        return voiceLangPrefix.toLowerCase() === langPrefix.toLowerCase();
      });

      if (matchingVoices.length === 0) {
        console.warn(`⚠️ No voices found for language: ${language}`);
        return null;
      }

      // For silent mode, prioritize non-eloquence voices as they work better
      if (Platform.OS === 'ios') {
        const nonEloquenceVoices = matchingVoices.filter(v => 
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
        const enhanced = matchingVoices.filter(v => 
          v.quality === Speech.VoiceQuality.Enhanced
        );
        if (enhanced.length > 0) {
          return enhanced[0];
        }
      }

      // If no non-eloquence voices, return the first matching voice
      return matchingVoices[0];
    } catch (error) {
      console.error('Error selecting voice:', error);
      return null;
    }
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