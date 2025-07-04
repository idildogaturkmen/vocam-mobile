import * as Speech from 'expo-speech';
import { Platform, Alert } from 'react-native';

class SpeechService {
  constructor() {
    this.isSpeaking = false;
    this.speechQueue = [];
    this.isInitialized = false;
    this.availableVoices = [];
    this.audioConfigured = false;
    this.silentModeOverrideAttempted = false;
    this.languageMapping = {
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'ru': 'ru-RU',
      'ja': 'ja-JP',
      'zh-CN': 'zh-CN',
      'zh': 'zh-CN',
      'en': 'en-US'
    };
  }

  async initialize() {
    try {
      console.log('🔊 Initializing Speech Service...');
      
      // Configure iOS audio for silent mode override
      if (Platform.OS === 'ios') {
        await this.configureSilentModeOverride();
      }

      // Get available voices
      this.availableVoices = await Speech.getAvailableVoicesAsync();
      console.log(`🔊 Speech Service initialized with ${this.availableVoices.length} voices available`);
      
      const availableLanguages = [...new Set(this.availableVoices.map(v => v.language))];
      console.log('🌍 Available languages:', availableLanguages);
      
      this.isInitialized = true;
      
      // NO TEST AUDIO - removed as requested
      console.log('✅ Speech Service ready (test audio disabled)');
      
      return true;
    } catch (error) {
      console.error('❌ Speech Service initialization failed:', error);
      return false;
    }
  }

  async configureSilentModeOverride() {
    if (this.silentModeOverrideAttempted) {
      return; // Don't repeat if already attempted
    }
    
    console.log('🔧 Configuring silent mode override...');
    this.silentModeOverrideAttempted = true;
    
    // Strategy 1: Try expo-audio
    const audioSuccess = await this.tryExpoAudio();
    if (audioSuccess) {
      console.log('✅ Silent mode override configured via expo-audio');
      this.audioConfigured = true;
      return;
    }
    
    // Strategy 2: Try expo-av
    const avSuccess = await this.tryExpoAV();
    if (avSuccess) {
      console.log('✅ Silent mode override configured via expo-av');
      this.audioConfigured = true;
      return;
    }
    
    // Strategy 3: iOS-specific speech configuration
    await this.tryIOSSpeechConfig();
    console.log('✅ Using iOS speech-specific configuration');
  }

  async tryExpoAudio() {
    try {
      const { Audio } = require('expo-audio');
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      
      console.log('✅ expo-audio configuration successful');
      return true;
    } catch (error) {
      console.log('⚠️ expo-audio configuration failed:', error.message);
      return false;
    }
  }

  async tryExpoAV() {
    try {
      const { Audio } = require('expo-av');
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      });
      
      console.log('✅ expo-av configuration successful');
      return true;
    } catch (error) {
      console.log('⚠️ expo-av configuration failed:', error.message);
      return false;
    }
  }

  async tryIOSSpeechConfig() {
    // iOS-specific: Use speech synthesis with maximum force settings
    try {
      // Pre-configure speech with a silent utterance to "wake up" the audio system
      await Speech.speak(' ', {
        language: 'en-US',
        rate: 10,
        volume: 0.001, // Nearly silent
        quality: Speech.VoiceQuality.Enhanced,
        onError: () => {}, // Ignore errors
        onDone: () => {}
      });
      
      console.log('✅ iOS speech system primed');
    } catch (error) {
      console.log('⚠️ iOS speech priming failed:', error.message);
    }
  }

  async speak(text, language = 'en') {
    try {
      if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn('❌ No valid text to speak:', text);
        return;
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      // Force silent mode override before each speech
      if (Platform.OS === 'ios' && !this.audioConfigured) {
        await this.configureSilentModeOverride();
      }

      if (this.isSpeaking) {
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const cleanText = this.cleanTextForSpeech(text);
      
      if (!cleanText || cleanText.trim() === '') {
        console.error('❌ Text became empty after cleaning. Using original text.');
        const finalText = text.trim();
        if (!finalText) return;
        return await this.performSpeechWithForce(finalText, language);
      }

      console.log(`🔊 Attempting to speak: "${cleanText}" in language: ${language}`);
      return await this.performSpeechWithForce(cleanText, language);
      
    } catch (error) {
      console.error('❌ Speech error:', error);
      await this.emergencyFallback(text, language);
    }
  }

  async performSpeechWithForce(text, language) {
    const voice = await this.getBestVoice(language);
    console.log(`🎤 Selected voice:`, voice?.identifier || 'default');

    // MAXIMUM FORCE speech options for silent mode override
    const options = {
      language: voice?.language || this.languageMapping[language] || language,
      pitch: 1.0,
      rate: this.getOptimalRate(language),
      volume: 1.0, // Maximum volume
      quality: Speech.VoiceQuality.Enhanced,
      
      // Force iOS to treat this as important system audio
      ...(Platform.OS === 'ios' && {
        iosCategory: 'playback', // Try to force playback category
        iosMode: 'default',
        iosAllowBluetooth: true,
        iosAllowBluetoothA2DP: true,
        iosAllowAirPlay: true,
      }),
      
      onStart: () => {
        this.isSpeaking = true;
        console.log('✅ Speech started successfully');
      },
      onDone: () => {
        this.isSpeaking = false;
        console.log('✅ Speech completed successfully');
        this.processQueue();
      },
      onError: (error) => {
        this.isSpeaking = false;
        console.error('❌ Speech error:', error);
        this.handleSpeechError(text, language, error);
      }
    };

    if (voice?.identifier) {
      options.voice = voice.identifier;
    }

    console.log('🔊 Speech options:', JSON.stringify(options, null, 2));

    // iOS-specific: Force audio session preparation
    if (Platform.OS === 'ios') {
      await this.prepareIOSAudioSession();
    }

    // Execute speech with force
    await Speech.speak(text, options);
  }

  async prepareIOSAudioSession() {
    try {
      // Strategy: Use multiple silent utterances to force iOS audio system activation
      const prepTasks = [
        // Different languages to activate voice synthesis system
        Speech.speak(' ', { language: 'en-US', rate: 10, volume: 0.001 }),
        Speech.speak(' ', { language: 'es-ES', rate: 10, volume: 0.001 }),
      ];
      
      await Promise.allSettled(prepTasks);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log('🎯 iOS audio session prepared');
    } catch (error) {
      console.log('⚠️ iOS audio preparation completed with warnings');
    }
  }

  async emergencyFallback(text, language) {
    console.log('🚨 Emergency fallback for speech...');
    
    try {
      // Most basic speech possible with iOS silent mode hints
      const basicOptions = {
        language: this.languageMapping[language] || language,
        rate: 0.7,
        volume: 1.0,
        // Try to hint to iOS that this is important
        ...(Platform.OS === 'ios' && {
          quality: Speech.VoiceQuality.Enhanced,
        }),
        onStart: () => console.log('🔄 Emergency speech started'),
        onDone: () => console.log('✅ Emergency speech completed'),
        onError: (e) => console.error('❌ Emergency speech failed:', e)
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

  cleanTextForSpeech(text) {
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

  getBestVoice(language) {
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
            console.log(`🎤 Using enhanced non-eloquence voice for ${language}:`, enhanced[0].identifier);
            return enhanced[0];
          }
          
          console.log(`🎤 Using non-eloquence voice for ${language}:`, nonEloquenceVoices[0].identifier);
          return nonEloquenceVoices[0];
        }
        
        // Fallback to any enhanced voice
        const enhanced = matchingVoices.filter(v => 
          v.quality === Speech.VoiceQuality.Enhanced
        );
        if (enhanced.length > 0) {
          console.log(`🎤 Using enhanced voice for ${language}:`, enhanced[0].identifier);
          return enhanced[0];
        }
      }

      console.log(`🎤 Using standard voice for ${language}:`, matchingVoices[0].identifier);
      return matchingVoices[0];
    } catch (error) {
      console.error('Error selecting voice:', error);
      return null;
    }
  }

  getOptimalRate(language) {
    const rates = {
      'zh-CN': Platform.select({ ios: 0.4, android: 0.5, default: 0.45 }),
      'zh': Platform.select({ ios: 0.4, android: 0.5, default: 0.45 }),
      'ja': Platform.select({ ios: 0.45, android: 0.55, default: 0.5 }),
      'ru': Platform.select({ ios: 0.5, android: 0.6, default: 0.55 }),
      'de': Platform.select({ ios: 0.55, android: 0.65, default: 0.6 }),
      'es': Platform.select({ ios: 0.6, android: 0.7, default: 0.65 }),
      'fr': Platform.select({ ios: 0.6, android: 0.7, default: 0.65 }),
      'pt': Platform.select({ ios: 0.55, android: 0.65, default: 0.6 }),
      'en': Platform.select({ ios: 0.55, android: 0.7, default: 0.6 })
    };

    return rates[language] || Platform.select({ 
      ios: 0.55, 
      android: 0.7, 
      default: 0.6 
    });
  }

  async handleSpeechError(text, language, error) {
    console.log('🔄 Handling speech error, attempting recovery...');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      await Speech.speak(text, {
        language: this.languageMapping[language] || language,
        rate: 0.7,
        volume: 1.0,
        onStart: () => console.log('🔄 Recovery speech started'),
        onError: () => this.emergencyFallback(text, language)
      });
    } catch (recoveryError) {
      await this.emergencyFallback(text, language);
    }
  }

  async speakQueue(textArray, language = 'en') {
    this.speechQueue = [...textArray];
    await this.processQueue(language);
  }

  async processQueue(language = 'en') {
    if (this.speechQueue.length > 0 && !this.isSpeaking) {
      const nextText = this.speechQueue.shift();
      await this.speak(nextText, language);
    }
  }

  async stop() {
    try {
      await Speech.stop();
      this.isSpeaking = false;
      this.speechQueue = [];
      console.log('🔇 Speech stopped successfully');
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  }

  async checkAvailability(language) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const langCode = this.languageMapping[language] || language;
      const langPrefix = langCode.split('-')[0];
      
      const available = this.availableVoices.some(voice => 
        voice.language.toLowerCase().startsWith(langPrefix.toLowerCase())
      );
      
      console.log(`🔊 Language ${language} (${langCode}) availability: ${available}`);
      return available;
    } catch (error) {
      console.error('Error checking language availability:', error);
      return false;
    }
  }

  async testSpeech() {
    console.log('🧪 Testing speech system...');
    
    try {
      await this.speak('Testing speech system', 'en');
      return true;
    } catch (error) {
      console.error('❌ Speech test failed:', error);
      return false;
    }
  }

  getAudioStatus() {
    return {
      initialized: this.isInitialized,
      audioConfigured: this.audioConfigured,
      silentModeOverrideAttempted: this.silentModeOverrideAttempted,
      voicesAvailable: this.availableVoices.length,
      platform: Platform.OS
    };
  }
}

export default new SpeechService();