import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

class SpeechService {
  constructor() {
    this.isSpeaking = false;
    this.speechQueue = [];
    this.languageMapping = {
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'ru': 'ru-RU',
      'ja': 'ja-JP',
      'zh-CN': 'zh-CN',
      'en': 'en-US'
    };
  }

  async initialize() {
    // Check if speech synthesis is available
    const voices = await Speech.getAvailableVoicesAsync();
    console.log(`🔊 Speech Service initialized with ${voices.length} voices available`);
    return true;
  }

  async speak(text, language = 'en') {
    try {
      if (!text || text.trim() === '') {
        console.warn('No text to speak');
        return;
      }

      // Stop any ongoing speech
      if (this.isSpeaking) {
        await Speech.stop();
        this.isSpeaking = false;
      }

      // Clean the text (remove HTML entities, etc.)
      const cleanText = this.cleanTextForSpeech(text);
      
      // Get proper language code
      const speechLang = this.languageMapping[language] || language;
      
      console.log(`🔊 Speaking "${cleanText}" in ${speechLang}`);
      
      // Configure speech options
      const options = {
        language: speechLang,
        pitch: 1.0,
        rate: Platform.select({
          ios: 0.5,      // iOS needs slower rate
          android: 0.75,  // Android slightly faster
          default: 0.7
        }),
        onStart: () => {
          this.isSpeaking = true;
          console.log('🔊 Speech started');
        },
        onDone: () => {
          this.isSpeaking = false;
          console.log('✅ Speech completed');
          this.processQueue();
        },
        onError: (error) => {
          this.isSpeaking = false;
          console.error('❌ Speech error:', error);
          this.processQueue();
        }
      };

      // Special handling for certain languages
      if (language === 'zh-CN' || language === 'ja') {
        options.rate = Platform.select({
          ios: 0.4,
          android: 0.6,
          default: 0.5
        });
      }

      // Speak the text
      await Speech.speak(cleanText, options);
      
    } catch (error) {
      console.error('Speech error:', error);
      this.isSpeaking = false;
      
      // Try alternative approach for iOS
      if (Platform.OS === 'ios' && error.message?.includes('not available')) {
        console.log('Trying alternative iOS speech approach...');
        await this.speakWithFallback(text, language);
      }
    }
  }

  async speakWithFallback(text, language) {
    try {
      // For iOS, sometimes we need to use a different voice
      const voices = await Speech.getAvailableVoicesAsync();
      const targetVoices = voices.filter(v => v.language.startsWith(language));
      
      if (targetVoices.length > 0) {
        const voice = targetVoices[0];
        await Speech.speak(text, {
          language: voice.language,
          voice: voice.identifier,
          rate: 0.5,
          pitch: 1.0
        });
      } else {
        // Use default language as last resort
        await Speech.speak(text, {
          language: 'en-US',
          rate: 0.7,
          pitch: 1.0
        });
      }
    } catch (fallbackError) {
      console.error('Fallback speech also failed:', fallbackError);
    }
  }

  cleanTextForSpeech(text) {
    // Remove HTML entities and clean up text
    return text
      .replace(/%20/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async speakQueue(textArray, language = 'en') {
    // Queue multiple texts to speak one after another
    this.speechQueue = [...textArray];
    this.processQueue(language);
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
      console.log('🔇 Speech stopped');
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  }

  async checkAvailability(language) {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const langCode = this.languageMapping[language] || language;
      const available = voices.some(voice => 
        voice.language.toLowerCase().startsWith(langCode.toLowerCase().split('-')[0])
      );
      
      console.log(`🔊 Language ${language} availability: ${available}`);
      return available;
    } catch (error) {
      console.error('Error checking language availability:', error);
      return false;
    }
  }
}

export default new SpeechService();