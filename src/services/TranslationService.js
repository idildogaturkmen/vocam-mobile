import Constants from 'expo-constants';
import ExampleSentenceGenerator from '../services/example-sentences/ExampleSentenceGenerator';

class TranslationService {
  constructor() {
    this.apiKey = null;
    this.translationCache = new Map();
    this.lastRequestTime = 0;
    this.rateLimit = 100; // ms between requests
    this.baseUrl = 'https://translation.googleapis.com/language/translate/v2';
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Get API key from multiple sources
      this.apiKey = this.getApiKey();
      
      if (!this.apiKey) {
        console.log('Available constants:', Constants.expoConfig?.extra);
        throw new Error('Google Cloud API key not found. Please check your configuration.');
      }
      
      console.log('✅ Translation Service initialized with API key');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Translation Service initialization failed:', error);
      // Don't throw - allow fallback to work
      this.isInitialized = false;
      return false;
    }
  }

  getApiKey() {
    // Try multiple sources for API key
    const sources = [
      // From app.config.js extra
      Constants.expoConfig?.extra?.googleCloudApiKey,
      Constants.expoConfig?.extra?.googleVisionApiKey,
      // From manifest (older Expo versions)
      Constants.manifest?.extra?.googleCloudApiKey,
      Constants.manifest?.extra?.googleVisionApiKey,
      // From environment
      process.env.GOOGLE_CLOUD_API_KEY,
      process.env.GOOGLE_CLOUD_VISION_API_KEY,
    ];

    for (const key of sources) {
      if (key && key !== '') {
        console.log('🔑 Found API key from configuration');
        return key;
      }
    }

    console.warn('⚠️ No API key found in any source');
    return null;
  }

  async translateText(text, targetLanguage, sourceLanguage = 'en') {
    try {
      // Define cache key at the beginning
      const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;
      
      // Check cache
      if (this.translationCache.has(cacheKey)) {
        return this.translationCache.get(cacheKey);
      }

      // If API key is available, use Google Translate
      if (this.apiKey && this.isInitialized) {
        return await this.googleTranslate(text, targetLanguage, sourceLanguage, cacheKey);
      } else {
        // Fallback to free API
        return await this.fallbackTranslation(text, targetLanguage, sourceLanguage);
      }
    } catch (error) {
      console.error('Translation error:', error);
      return await this.fallbackTranslation(text, targetLanguage, sourceLanguage);
    }
  }

  async googleTranslate(text, targetLanguage, sourceLanguage, cacheKey) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimit - timeSinceLastRequest));
    }

    console.log(`🌐 Google Translating "${text}" from ${sourceLanguage} to ${targetLanguage}`);

    const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Translation API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const translation = data.data?.translations?.[0]?.translatedText || text;
    
    // Decode HTML entities
    const decodedTranslation = this.decodeHTMLEntities(translation);
    
    // Cache the result
    this.translationCache.set(cacheKey, decodedTranslation);
    this.lastRequestTime = Date.now();
    
    console.log(`✅ Translated: "${text}" → "${decodedTranslation}"`);
    return decodedTranslation;
  }

  async fallbackTranslation(text, targetLanguage, sourceLanguage = 'en') {
    try {
      console.log('📱 Using fallback translation (MyMemory API)');
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|${targetLanguage}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const translation = data.responseData?.translatedText || text;
        console.log(`✅ Fallback translation: "${text}" → "${translation}"`);
        return translation;
      }
    } catch (error) {
      console.error('Fallback translation error:', error);
    }
    
    // Ultimate fallback - return original text
    return text;
  }

  decodeHTMLEntities(text) {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  }

  async getExampleSentence(word, targetLanguage) {
    try {
      console.log(`📝 Getting example sentence for "${word}" in ${targetLanguage}`);
      
      // Use the enhanced sentence generator
      const example = await ExampleSentenceGenerator.getExampleSentence(
        word, 
        targetLanguage, 
        (text, lang) => this.translateText(text, lang)
      );
      
      return example;
      
    } catch (error) {
      console.error('Example sentence error:', error);
      const fallback = `I can see a ${word}.`;
      return {
        english: fallback,
        translated: await this.translateText(fallback, targetLanguage),
        source: 'error_fallback'
      };
    }
  }

  async getTatoebaExample(word, targetLanguage) {
    try {
      const response = await fetch(
        `https://tatoeba.org/en/api_v0/search?from=eng&to=${this.getTatoebaLangCode(targetLanguage)}&query=${encodeURIComponent(word)}&limit=10`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const sentence = data.results[Math.floor(Math.random() * Math.min(5, data.results.length))];
          
          if (sentence.translations && sentence.translations.length > 0) {
            return {
              english: sentence.text,
              translated: sentence.translations[0].text,
              source: 'tatoeba'
            };
          }
        }
      }
    } catch (error) {
      console.log('Tatoeba API failed, using fallback');
    }
    return null;
  }

  getTatoebaLangCode(langCode) {
    const mapping = {
      'es': 'spa',
      'fr': 'fra',
      'de': 'deu',
      'it': 'ita',
      'pt': 'por',
      'ru': 'rus',
      'ja': 'jpn',
      'zh-CN': 'cmn'
    };
    return mapping[langCode] || 'eng';
  }

  getSupportedLanguages() {
    return {
      'Spanish': 'es',
      'French': 'fr',
      'German': 'de',
      'Italian': 'it',
      'Portuguese': 'pt',
      'Russian': 'ru',
      'Japanese': 'ja',
      'Chinese (Simplified)': 'zh-CN'
    };
  }
}

export default new TranslationService();