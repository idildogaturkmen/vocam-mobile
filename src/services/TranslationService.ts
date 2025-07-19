import Constants from 'expo-constants';
import ExampleSentenceGenerator from './example-sentences/ExampleSentenceGenerator';

interface ExampleSentence {
  english: string;
  translated: string;
  source: string;
}

interface GoogleTranslateResponse {
  data: {
    translations: Array<{
      translatedText: string;
    }>;
  };
}

interface MyMemoryResponse {
  responseData: {
    translatedText: string;
  };
}

interface TatoebaResult {
  text: string;
  translations: Array<{
    text: string;
  }>;
}

interface TatoebaResponse {
  results: TatoebaResult[];
}

class TranslationService {
  private apiKey: string | null;
  private translationCache: Map<string, string>;
  private lastRequestTime: number;
  private rateLimit: number;
  private baseUrl: string;
  private isInitialized: boolean;

  constructor() {
    this.apiKey = null;
    this.translationCache = new Map<string, string>();
    this.lastRequestTime = 0;
    this.rateLimit = 100; // ms between requests
    this.baseUrl = 'https://translation.googleapis.com/language/translate/v2';
    this.isInitialized = false;
  }

  async initialize(): Promise<boolean> {
    try {
      // Get API key from multiple sources
      this.apiKey = this.getApiKey();
      
      if (!this.apiKey) {
        console.log('Available constants:', Constants.expoConfig?.extra);
        throw new Error('Google Cloud API key not found. Please check your configuration.');
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Translation Service initialization failed:', error);
      // Don't throw - allow fallback to work
      this.isInitialized = false;
      return false;
    }
  }

  private getApiKey(): string | null {
    // Try multiple sources for API key
    const sources: (string | undefined)[] = [
      // From app.config.js extra
      Constants.expoConfig?.extra?.googleCloudApiKey,
      Constants.expoConfig?.extra?.googleVisionApiKey,
      // From manifest (older Expo versions)
      (Constants as any).manifest?.extra?.googleCloudApiKey,
      (Constants as any).manifest?.extra?.googleVisionApiKey,
      // From environment
      process.env.GOOGLE_CLOUD_API_KEY,
      process.env.GOOGLE_CLOUD_VISION_API_KEY,
    ];

    for (const key of sources) {
      if (key && key !== '') {
        return key;
      }
    }

    console.warn('⚠️ No API key found in any source');
    return null;
  }

  async translateText(text: string, targetLanguage: string, sourceLanguage: string = 'en'): Promise<string> {
    try {
      // Define cache key at the beginning
      const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;
      
      // Check cache
      if (this.translationCache.has(cacheKey)) {
        return this.translationCache.get(cacheKey)!;
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

  private async googleTranslate(text: string, targetLanguage: string, sourceLanguage: string, cacheKey: string): Promise<string> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimit - timeSinceLastRequest));
    }

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

    const data: GoogleTranslateResponse = await response.json();
    const translation = data.data?.translations?.[0]?.translatedText || text;
    
    // Decode HTML entities
    const decodedTranslation = this.decodeHTMLEntities(translation);
    
    // Cache the result
    this.translationCache.set(cacheKey, decodedTranslation);
    this.lastRequestTime = Date.now();
    return decodedTranslation;
  }

  private async fallbackTranslation(text: string, targetLanguage: string, sourceLanguage: string = 'en'): Promise<string> {
    try {
      // Properly encode the text
      const encodedText = encodeURIComponent(text);
      const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${sourceLanguage}|${targetLanguage}`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data: MyMemoryResponse = await response.json();
        const translation = data.responseData?.translatedText || text;
        
        // Clean up any HTML entities or encoding issues
        const cleanTranslation = translation
          .replace(/%20/g, ' ')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
        return cleanTranslation;
      }
    } catch (error) {
      console.error('Fallback translation error:', error);
    }
    
    // Ultimate fallback - return original text
    return text;
  }

  private decodeHTMLEntities(text: string): string {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec)));
  }

  async getExampleSentence(word: string, targetLanguage: string): Promise<ExampleSentence> {
    try {
      // Use the enhanced sentence generator
      const example = await ExampleSentenceGenerator.getExampleSentence(
        word, 
        targetLanguage, 
        (text: string, lang: string) => this.translateText(text, lang)
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
}

export default new TranslationService();