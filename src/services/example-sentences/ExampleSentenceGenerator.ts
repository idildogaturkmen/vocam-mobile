import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import WordCategorizer from './WordCategorizer';

interface ExampleResult {
  text: string;
  source: string;
  searchTerm?: string;
}

interface ScoredExample extends ExampleResult {
  score: number;
}

interface TranslatedExample {
  english: string;
  translated: string;
  source: string;
}

interface CachedData<T> {
  value: T;
  timestamp: number;
}

type TranslateFunction = (text: string, targetLanguage: string) => Promise<string>;

class ExampleSentenceGenerator {
  private debug: boolean = false;
  private recentExamples: Record<string, string[]> = {};
  private maxRecentExamples: number = 10;
  
  // API Keys from Expo Constants
  private wordnikApiKey: string | undefined;
  private wordsApiKey: string | undefined;
  
  // API limits and tracking
  private wordsApiRequestCount: number = 0;
  private wordsApiMonthlyLimit: number = 2500;
  private rateLimitResetTime: number = 0;

  constructor() {
    const extra = Constants.expoConfig?.extra || 
                  Constants.manifest?.extra || 
                  Constants.manifest2?.extra?.expoClient?.extra;
    
    // Load API keys
    this.wordnikApiKey = extra?.wordnikApiKey;
    this.wordsApiKey = extra?.wordsApiKey;
  }

  setDebug(debug: boolean): void {
    this.debug = debug;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = 5000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async getExampleSentence(
    word: string,
    targetLanguage: string,
    translateFunc: TranslateFunction,
    category: string | null = null
  ): Promise<TranslatedExample> {
    try {
      const originalWord = word;
      word = word.trim().toLowerCase();

      // Try to get examples from APIs with ENHANCED filtering
      const examples = await this.getApiExamplesWithEnhancedPipeline(word, category);
      
      // Score and rank examples
      const scoredExamples = this.scoreExamples(examples, word);
      
      // Select the best example
      if (scoredExamples.length > 0) {
        const bestExample = scoredExamples[0];
        
        // Translate the example
        const translated = await translateFunc(bestExample.text, targetLanguage);
        
        return {
          english: bestExample.text,
          translated: translated,
          source: bestExample.source
        };
      }

      // No examples found - generate contextual sentence
      const contextualSentence = await this.generateContextualSentence(word, category);
      
      const translated = await translateFunc(contextualSentence, targetLanguage);
      
      return {
        english: contextualSentence,
        translated: translated,
        source: 'contextual_generation'
      };
      
    } catch (error) {
      console.error('Example sentence generation error:', error);
      const fallback = `This is a ${word}.`;
      const translated = await translateFunc(fallback, targetLanguage);
      return {
        english: fallback,
        translated: translated,
        source: 'error_fallback'
      };
    }
  }

  // ENHANCED: New method that applies filtering
  private async getApiExamplesWithEnhancedPipeline(word: string, category: string | null): Promise<ExampleResult[]> {
    try {
      let rawExamples: ExampleResult[] = [];
      
      // Handle compound words - be smarter about search terms
      const words = word.split(' ');
      const searchTerms: string[] = [word]; // Always search full word first
      
      // Add variations for compound words
      if (words.length > 1) {
        // Add last word as fallback
        searchTerms.push(words[words.length - 1]);
        
        // For technical terms, also try the main concept
        if (word.startsWith('2d ') || word.startsWith('qr ')) {
          const mainTerm = words.slice(1).join(' ');
          if (mainTerm) searchTerms.push(mainTerm);
        }
      }
      
      // Check rate limiting
      const now = Date.now();
      const isRateLimited = this.rateLimitResetTime > now;
      
      // Run API calls in parallel - PRIORITIZE PAID APIs
      const apiPromises: Promise<ExampleResult[]>[] = [];
      
      for (const searchTerm of searchTerms) {
        // 1. WordsAPI FIRST (paid, high quality) 
        if (this.wordsApiKey && 
            this.wordsApiKey !== 'your-words-api-key' && 
            this.wordsApiRequestCount < this.wordsApiMonthlyLimit &&
            !isRateLimited) {
          
          apiPromises.push(
            this.getWordsApiExamples(searchTerm)
              .then(results => {
                return results.map(text => ({
                  text: this.cleanSentence(text),
                  source: 'WordsAPI',
                  searchTerm
                }));
              })
              .catch(error => {
                return [];
              })
          );
        }
        
        // 2. Tatoeba - High quality community sentences
        apiPromises.push(
          this.getTatoebaExamples(searchTerm)
            .then(results => {
              return results.map(text => ({
                text: this.cleanSentence(text),
                source: 'Tatoeba',
                searchTerm
              }));
            })
            .catch(() => [])
        );
        
        // 3. Free Dictionary
        apiPromises.push(
          this.getFreeDictionaryExamples(searchTerm)
            .then(results => {
              return results.map(text => ({
                text: this.cleanSentence(text),
                source: 'FreeDictionary',
                searchTerm
              }));
            })
            .catch(() => [])
        );
      }
      
      // Wait for all API calls
      const allResults = await Promise.all(apiPromises);
      rawExamples = allResults.flat();
      
      // ENHANCED FILTERING: Apply the filter pipeline
      const filteredExamples: ExampleResult[] = [];
      const identifiedCategory = category || WordCategorizer.getWordCategory(word);
      
      for (const example of rawExamples) {
        // Run through enhanced filter pipeline
        if (this.enhancedFilterPipeline(example.text, word, identifiedCategory)) {
          filteredExamples.push(example);
        }
      }
      
      // Remove duplicates
      const uniqueTexts = new Set<string>();
      const uniqueExamples = filteredExamples.filter(ex => {
        const normalized = ex.text.toLowerCase().trim();
        if (uniqueTexts.has(normalized)) return false;
        uniqueTexts.add(normalized);
        return true;
      });
      
      return uniqueExamples;
    } catch (error) {
      console.error('Enhanced API examples pipeline error:', error);
      return [];
    }
  }

  // Enhanced filter pipeline (integrated directly)
  private enhancedFilterPipeline(example: string, word: string, category: string | null = null): boolean {
    // Filter 1: Basic quality check
    if (!this.basicQualityCheck(example)) {
      return false;
    }
    
    // Filter 2: Exact word match (enhanced for compound words)
    if (!this.containsExactWord(example, word)) {
      return false;
    }
    
    // Filter 3: Wrong meaning check
    if (!this.checkWordMeaning(example, word)) {
      return false;
    }
    
    return true;
  }

  private basicQualityCheck(text: string): boolean {
    const words = text.split(' ');
    if (words.length < 3 || words.length > 25) return false;
    
    if (text.includes(';')) return false;
    
    const lowerText = text.toLowerCase();
    if (lowerText.includes("example of") || lowerText.includes("examples of")) return false;
    
    const trimmedText = text.trim();
    if (!trimmedText.endsWith('.') && !trimmedText.endsWith('!') && !trimmedText.endsWith('?')) return false;
    
    return true;
  }

  private containsExactWord(text: string, word: string): boolean {
    const lowerText = text.toLowerCase();
    const lowerWord = word.toLowerCase();
    
    // For compound words, be more flexible
    if (word.includes(' ')) {
      // Check for exact phrase first
      if (lowerText.includes(lowerWord)) {
        return true;
      }
      
      // For compound words like "table top", also accept "table-top" 
      const hyphenatedWord = word.replace(/\s+/g, '-');
      if (lowerText.includes(hyphenatedWord)) {
        return true;
      }
      
      // For technical terms like "2d barcode", accept just "barcode"
      if (word.startsWith('2d ') || word.startsWith('qr ')) {
        const mainWord = word.split(' ').slice(1).join(' ');
        if (mainWord && lowerText.includes(mainWord)) {
          return true;
        }
      }
      
      // For compound words, check if the MAIN word is present
      const words = word.split(' ');
      const mainWord = words[words.length - 1]; // Last word is usually the main concept
      if (mainWord.length > 3) { // Only for meaningful words
        const pattern = new RegExp(`\\b${this.escapeRegex(mainWord)}\\b`, 'i');
        if (pattern.test(text)) {
          return true;
        }
      }
      
      return false;
    }
    
    // For single words, use exact word boundary matching
    const pattern = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
    return pattern.test(text);
  }

  private checkWordMeaning(text: string, word: string): boolean {
    const lowerText = text.toLowerCase();
    const lowerWord = word.toLowerCase();
    
    // Specific meaning checks
    const meaningChecks: Record<string, (text: string) => boolean> = {
      'lighting': (text: string) => {
        // For "lighting" (noun - illumination), reject verb uses of "light"
        const verbPatterns = [
          /\blight\s+(the|a|an|up|it|fires?|matches?|candles?)\b/i,
          /\b(will|can|could|should|must)\s+light\b/i,
          /\bto\s+light\b/i,
          /\blighting\s+(fires?|candles?|matches?)\b/i,
          /\blit\s+(the|a|an|up|it)\b/i
        ];
        
        // Accept noun uses
        const nounPatterns = [
          /\b(the|good|bad|better|ambient|natural|artificial|led|overhead|proper)\s+lighting\b/i,
          /\blighting\s+(system|fixture|design|setup|conditions?|was|is|needs|required)\b/i,
          /\bunder\s+the\s+lighting\b/i,
          /\b(interior|stage|mood|track)\s+lighting\b/i
        ];
        
        // If it matches good noun patterns, accept
        if (nounPatterns.some(pattern => pattern.test(text))) return true;
        
        // If it matches bad verb patterns, reject
        if (verbPatterns.some(pattern => pattern.test(text))) return false;
        
        // If it just contains "lighting", probably good
        return /\blighting\b/i.test(text);
      },
      
      '2d barcode': (text: string) => {
        // For "2d barcode", accept any barcode-related content
        const barcodePatterns = [
          /\b(barcode|bar\s+code|qr\s+code|scan|scanner|scanning)\b/i,
          /\b(product|package|label|tag|identifier)\b/i,
          /\b(checkout|cashier|inventory|tracking)\b/i
        ];
        
        return barcodePatterns.some(pattern => pattern.test(text));
      },
      
      'qr code': (text: string) => {
        // For "qr code", accept any code-related content
        const codePatterns = [
          /\b(qr|barcode|bar\s+code|scan|scanner|scanning|code)\b/i,
          /\b(smartphone|phone|camera|app|link|website)\b/i,
          /\b(menu|payment|information|access)\b/i
        ];
        
        return codePatterns.some(pattern => pattern.test(text));
      }
    };
    
    // Check main word
    if (meaningChecks[lowerWord]) {
      return meaningChecks[lowerWord](lowerText);
    }
    
    // For compound words, also check the main concept
    const words = lowerWord.split(' ');
    if (words.length > 1) {
      const mainWord = words[words.length - 1];
      if (meaningChecks[mainWord]) {
        return meaningChecks[mainWord](lowerText);
      }
    }
    
    return true; // No specific check needed
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ENHANCED: WordsAPI with better debugging and error handling
  private async getWordsApiExamples(word: string): Promise<string[]> {
    try {
      if (!this.wordsApiKey || this.wordsApiKey === 'your-words-api-key') {
        return [];
      }
      
      // Check if we're still rate limited
      if (this.rateLimitResetTime > Date.now()) {
        return [];
      }
      
      const cacheKey = `wordsapi_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) {
        return cached;
      }
      
      this.wordsApiRequestCount++;
      
      const url = `https://wordsapiv1.p.rapidapi.com/words/${encodeURIComponent(word)}/examples`;
      
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-RapidAPI-Key': this.wordsApiKey,
          'X-RapidAPI-Host': 'wordsapiv1.p.rapidapi.com'
        }
      }, 10000); // Longer timeout for paid API
      
      if (!response.ok) {
        // Handle different error codes
        if (response.status === 429) {
          const resetHeader = response.headers.get('X-RateLimit-Reset');
          if (resetHeader) {
            this.rateLimitResetTime = parseInt(resetHeader) * 1000;
          } else {
            this.rateLimitResetTime = Date.now() + (60 * 60 * 1000);
          }
          console.warn(`WordsAPI rate limited until ${new Date(this.rateLimitResetTime)}`);
        } else if (response.status === 403) {
          console.error('WordsAPI authentication failed. Check your RapidAPI subscription and key.');
        } else if (response.status === 402) {
          console.error('WordsAPI quota exceeded. Upgrade your RapidAPI plan.');
        }
        return [];
      }
      
      const data = await response.json();
      const examples: string[] = data.examples || [];
      
      if (examples.length > 0) {
        await this.setCached(cacheKey, examples.slice(0, 10));
      }
      
      return examples;
    } catch (error) {
      return [];
    }
  }

  private async getTatoebaExamples(word: string): Promise<string[]> {
    try {
      const cacheKey = `tatoeba_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) return cached;
      
      const url = `https://tatoeba.org/en/api_v0/search?from=eng&query=${encodeURIComponent(word)}&limit=20`;
      
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const examples: string[] = [];
      
      if (data.results && Array.isArray(data.results)) {
        for (const result of data.results) {
          if (result.text && result.lang === 'eng') {
            examples.push(result.text);
          }
        }
      }
      
      if (examples.length > 0) {
        await this.setCached(cacheKey, examples);
      }
      
      return examples;
    } catch (error) {
      return [];
    }
  }

  private async getFreeDictionaryExamples(word: string): Promise<string[]> {
    try {
      const cacheKey = `freedict_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) return cached;
      
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const examples: string[] = [];
      
      if (Array.isArray(data) && data.length > 0) {
        for (const entry of data) {
          for (const meaning of entry.meanings || []) {
            for (const definition of meaning.definitions || []) {
              if (definition.example) {
                examples.push(definition.example);
              }
            }
          }
        }
      }
      
      if (examples.length > 0) {
        await this.setCached(cacheKey, examples);
      }
      
      return examples;
    } catch (error) {
      return [];
    }
  }

  private scoreExamples(examples: ExampleResult[], targetWord: string): ScoredExample[] {
    return examples
      .map(ex => {
        let score = 0;
        const text = ex.text.toLowerCase();
        
        // CRITICAL: Strongly prefer examples with the EXACT full phrase
        if (text.includes(targetWord.toLowerCase())) {
          score += 100;
        }
        
        // Source quality scoring - PRIORITIZE WordsAPI over others
        const sourceScores: Record<string, number> = {
          'WordsAPI': 20,
          'Tatoeba': 15,
          'FreeDictionary': 12,
          'Wordnik': 8,
        };
        score += sourceScores[ex.source] || 0;
        
        // Prefer natural, everyday sentences
        if (text.length > 20 && text.length < 80) {
          score += 5;
        }
        
        // Bonus for sentences with good context
        const wordCount = ex.text.split(' ').length;
        if (wordCount >= 6 && wordCount <= 15) {
          score += 10;
        } else if (wordCount <= 3) {
          score -= 20;
        }
        
        return { ...ex, score };
      })
      .filter(ex => ex.score > -10)
      .sort((a, b) => b.score - a.score);
  }

  private async generateContextualSentence(word: string, category: string | null): Promise<string> {
    // Enhanced contextual generation for specific word types
    const templates: Record<string, string[]> = {
      'barcode': [
        'The cashier scanned the barcode at checkout.',
        'Each product has a unique barcode for identification.',
        'The barcode reader quickly processed the information.',
        'Modern barcodes can store a lot of product data.'
      ],
      '2d barcode': [
        'The 2D barcode contains more information than regular barcodes.',
        'Scan the 2D barcode with your smartphone camera.',
        'The 2D barcode links directly to the product website.',
        'Modern packaging often includes a 2D barcode for tracking.'
      ],
      'qr code': [
        'Scan the QR code to access the menu.',
        'The QR code links to our website.',
        'Payment is easy with this QR code.',
        'The poster displays a QR code for more information.'
      ],
      'laptop': [
        'She opened her laptop to start working.',
        'The laptop battery lasts all day.',
        'He carries his laptop in a protective case.',
        'The new laptop is lightweight and fast.'
      ],
      'keyboard': [
        'The wireless keyboard connects via Bluetooth.',
        'She typed quickly on the mechanical keyboard.',
        'The keyboard has backlit keys for dark rooms.',
        'He spilled coffee on his keyboard.'
      ]
    };
    
    // Check for specific word templates
    if (templates[word]) {
      const wordTemplates = templates[word];
      return wordTemplates[Math.floor(Math.random() * wordTemplates.length)];
    }
    
    // Fallback templates
    const fallbackTemplates = [
      `The ${word} is very useful.`,
      `I can see a ${word} here.`,
      `This ${word} looks interesting.`,
      `We have a new ${word}.`,
      `The ${word} works perfectly.`,
      `Someone left their ${word} on the table.`
    ];
    
    return fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
  }

  private cleanSentence(sentence: string): string {
    sentence = sentence.trim().replace(/\s+/g, ' ');
    sentence = sentence.replace(/^\d+[\.\)]\s*/g, '');
    sentence = sentence.replace(/\[.*?\]/g, '');
    sentence = sentence.replace(/\s+([,.!?;:])/g, '$1');
    
    if (sentence && /^[a-z]/.test(sentence)) {
      sentence = sentence[0].toUpperCase() + sentence.slice(1);
    }
    
    if (sentence && !/[.!?]$/.test(sentence)) {
      sentence += '.';
    }
    
    return sentence;
  }

  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`sentence_cache_${key}`);
      if (cached) {
        const data: CachedData<T> = JSON.parse(cached);
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return data.value;
        }
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  }

  private async setCached<T>(key: string, value: T): Promise<void> {
    try {
      const data: CachedData<T> = {
        value,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(`sentence_cache_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }
}

export default new ExampleSentenceGenerator();