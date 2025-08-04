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
                  text: this.robustCleanSentence(text),
                  source: 'WordsAPI',
                  searchTerm
                }));
              })
              .catch(error => {
                console.log(`  ❌ WordsAPI failed for "${searchTerm}":`, error.message);
                return [];
              })
          );
        }
        
        // 2. Wordnik - High quality dictionary examples
        if (this.wordnikApiKey && this.wordnikApiKey !== 'your-wordnik-api-key') {
          apiPromises.push(
            this.getWordnikExamples(searchTerm)
              .then(results => {
                return results.map(text => ({
                  text: this.robustCleanSentence(text),
                  source: 'Wordnik',
                  searchTerm
                }));
              })
              .catch(error => {
                console.log(`  ❌ Wordnik failed for "${searchTerm}":`, error.message);
                return [];
              })
          );
        }
        
        // 3. Tatoeba - High quality community sentences
        apiPromises.push(
          this.getTatoebaExamples(searchTerm)
            .then(results => {
              return results.map(text => ({
                text: this.robustCleanSentence(text),
                source: 'Tatoeba',
                searchTerm
              }));
            })
            .catch(() => {
              return [];
            })
        );
        
        // 4. Free Dictionary
        apiPromises.push(
          this.getFreeDictionaryExamples(searchTerm)
            .then(results => {
              return results.map(text => ({
                text: this.robustCleanSentence(text),
                source: 'FreeDictionary',
                searchTerm
              }));
            })
            .catch(() => {
              return [];
            })
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
    
    // Reject meta-commentary, references, and non-natural sentences
    const metaPatterns = [
      /^note:/i,
      /^\(psst:/i,
      /^psst:/i,
      /^fyi:/i,
      /^hint:/i,
      /^tip:/i,
      /^remember:/i,
      /^important:/i,
      /^warning:/i,
      /^notice:/i,
      /keywords?\s*"/i,  // "Google can't reach keywords"
      /from the cache/i,   // Technical references
      /\.com\b/i,         // Website references
      /^\([^)]*\)\.?$/i,  // Sentences that are just parenthetical comments
      /^\([^)]*-/i,       // References starting with (Name - 
      /^\([^)]*\s+[A-Z][a-z]+/i, // References starting with (Name
      /- an eye for/i,    // Specific pattern for "- an eye for"
      /view it »/i,       // "View It »" pattern
      /forbes\.?\s*com/i, // Forbes references
      /boost your business/i, // Contest references
    ];
    
    if (metaPatterns.some(pattern => pattern.test(text))) {
      return false;
    }
    
    // Reject sentences that start with parentheses (likely references/citations)
    if (text.trim().startsWith('(')) {
      return false;
    }
    
    // Reject sentences that look like references or citations
    const referencePatterns = [
      /^[A-Z][a-z]+\s+[A-Z][a-z]+\s*-/i, // "John Smith - something"
      /^[A-Z][a-z]+\s*-/i,               // "Name - something"
      /\([A-Z][a-z]+\s+[A-Z][a-z]+/i,   // "(John Smith" pattern
    ];
    
    if (referencePatterns.some(pattern => pattern.test(text))) {
      return false;
    }
    
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
          console.warn(`  ⏱️ WordsAPI rate limited until ${new Date(this.rateLimitResetTime)}`);
        } else if (response.status === 403) {
          console.error('  ❌ WordsAPI authentication failed. Check your RapidAPI subscription and key.');
        } else if (response.status === 402) {
          console.error('  💳 WordsAPI quota exceeded. Upgrade your RapidAPI plan.');
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

  private async getWordnikExamples(word: string): Promise<string[]> {
    try {
      if (!this.wordnikApiKey || this.wordnikApiKey === 'your-wordnik-api-key') {
        return [];
      }
      
      const cacheKey = `wordnik_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) {
        return cached;
      }
      
      const url = `https://api.wordnik.com/v4/word.json/${encodeURIComponent(word)}/examples?includeDuplicates=false&useCanonical=false&skip=0&limit=10&api_key=${this.wordnikApiKey}`;
      
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, 8000);
      
      if (!response.ok) {
        if (response.status === 403) {
          console.error('  ❌ Wordnik API authentication failed. Check your API key.');
        } else if (response.status === 429) {
          console.warn('  ⏱️ Wordnik API rate limited. Please wait before making more requests.');
        }
        return [];
      }
      
      const data = await response.json();
      const examples: string[] = [];
      
      if (data.examples && Array.isArray(data.examples)) {
        for (const example of data.examples) {
          if (example.text) {
            examples.push(example.text);
          }
        }
      }
      
      if (examples.length > 0) {
        await this.setCached(cacheKey, examples.slice(0, 10));
      }
      
      return examples;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ Wordnik API error:`, errorMessage);
      return [];
    }
  }

  private async getTatoebaExamples(word: string): Promise<string[]> {
    try {
      const cacheKey = `tatoeba_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) {
        return cached;
      }
      
      const url = `https://tatoeba.org/en/api_v0/search?from=eng&query=${encodeURIComponent(word)}&limit=20`;
      
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        return [];
      }
      
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ Tatoeba API error:`, errorMessage);
      return [];
    }
  }

  private async getFreeDictionaryExamples(word: string): Promise<string[]> {
    try {
      const cacheKey = `freedict_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) {
        return cached;
      }
      
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        return [];
      }
      
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ FreeDictionary API error:`, errorMessage);
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
        
        // Source quality scoring - PRIORITIZE WordsAPI, then Wordnik
        const sourceScores: Record<string, number> = {
          'WordsAPI': 20,
          'Wordnik': 18,
          'Tatoeba': 15,
          'FreeDictionary': 12,
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

  /**
   * Comprehensive sentence cleaning algorithm that handles problematic formatting
   * from various APIs, especially Wordnik's ellipses and dot patterns
   */
  private robustCleanSentence(sentence: string): string {
    if (!sentence || typeof sentence !== 'string') {
      return '';
    }

    let cleaned = sentence.trim();
    
    // Step 1: Handle problematic ellipses and dot patterns
    cleaned = this.cleanEllipsesAndDots(cleaned);
    
    // Step 2: Remove unwanted formatting and metadata
    cleaned = this.removeUnwantedFormatting(cleaned);
    
    // Step 3: Fix spacing and punctuation
    cleaned = this.fixSpacingAndPunctuation(cleaned);
    
    // Step 4: Handle capitalization
    cleaned = this.fixCapitalization(cleaned);
    
    // Step 5: Ensure proper sentence ending
    cleaned = this.ensureProperEnding(cleaned);
    
    // Step 6: Final validation and quality check
    if (!this.isValidCleanedSentence(cleaned)) {
      return ''; // Return empty string for invalid sentences
    }
    
    return cleaned;
  }

  /**
   * Handles the problematic ellipses and dot patterns from Wordnik
   */
  private cleanEllipsesAndDots(text: string): string {
    // Remove excessive dots and ellipses patterns like "… … … …."
    text = text.replace(/[…\.]{4,}/g, ''); // Remove 4+ consecutive dots/ellipses
    text = text.replace(/\s*[…\.]+\s*[…\.]+\s*[…\.]+/g, ''); // Remove spaced ellipses patterns
    text = text.replace(/\s*…\s*…\s*/g, ''); // Remove double ellipses with spaces
    text = text.replace(/\.{3,}/g, '...'); // Normalize multiple dots to proper ellipsis
    text = text.replace(/…+/g, '...'); // Convert Unicode ellipses to ASCII
    
    // Clean up trailing ellipses at the end of sentences
    text = text.replace(/\.{3,}\s*$/, '.'); // Replace trailing ellipses with period
    text = text.replace(/…\s*$/, '.'); // Replace trailing Unicode ellipsis with period
    
    return text.trim();
  }

  /**
   * Removes unwanted formatting, brackets, and metadata
   */
  private removeUnwantedFormatting(text: string): string {
    // Remove numbered list prefixes
    text = text.replace(/^\d+[\.\)\-]\s*/g, '');
    
    // Remove various bracket types and their contents
    text = text.replace(/\[.*?\]/g, ''); // Square brackets
    text = text.replace(/\{.*?\}/g, ''); // Curly brackets
    text = text.replace(/\<.*?\>/g, ''); // Angle brackets
    
    // Remove citation patterns
    text = text.replace(/\([A-Z][a-z]+\s+[A-Z][a-z]+.*?\)/g, ''); // (Author Name ...)
    text = text.replace(/\([A-Z][a-z]+\s*-.*?\)/g, ''); // (Name - ...)
    text = text.replace(/\(\d{4}\)/g, ''); // (Year)
    text = text.replace(/\(p\.?\s*\d+\)/g, ''); // (p. 123)
    
    // Remove quotation marks that wrap entire sentences
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }
    if (text.startsWith("'") && text.endsWith("'")) {
      text = text.slice(1, -1);
    }
    
    // Remove asterisks and other formatting markers
    text = text.replace(/\*+/g, '');
    text = text.replace(/_+/g, '');
    text = text.replace(/#+/g, '');
    
    return text.trim();
  }

  /**
   * Fixes spacing issues and punctuation problems
   */
  private fixSpacingAndPunctuation(text: string): string {
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ');
    
    // Fix spacing around punctuation
    text = text.replace(/\s+([,.!?;:])/g, '$1'); // Remove space before punctuation
    text = text.replace(/([.!?])([A-Z])/g, '$1 $2'); // Add space after sentence-ending punctuation
    text = text.replace(/,([A-Za-z])/g, ', $1'); // Add space after commas
    text = text.replace(/;([A-Za-z])/g, '; $1'); // Add space after semicolons
    text = text.replace(/:([A-Za-z])/g, ': $1'); // Add space after colons
    
    // Fix double punctuation
    text = text.replace(/\.{2}/g, '.'); // Double periods to single
    text = text.replace(/!{2,}/g, '!'); // Multiple exclamations to single
    text = text.replace(/\?{2,}/g, '?'); // Multiple questions to single
    text = text.replace(/,{2,}/g, ','); // Multiple commas to single
    
    // Remove punctuation at the beginning
    text = text.replace(/^[,.;:!?]+\s*/, '');
    
    return text.trim();
  }

  /**
   * Fixes capitalization issues
   */
  private fixCapitalization(text: string): string {
    if (!text) return text;
    
    // Capitalize first letter
    if (/^[a-z]/.test(text)) {
      text = text[0].toUpperCase() + text.slice(1);
    }
    
    // Fix capitalization after sentence-ending punctuation
    text = text.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => {
      return punct + ' ' + letter.toUpperCase();
    });
    
    return text;
  }

  /**
   * Ensures the sentence has proper ending punctuation
   */
  private ensureProperEnding(text: string): string {
    if (!text) return text;
    
    // If sentence doesn't end with punctuation, add a period
    if (!/[.!?]$/.test(text)) {
      text += '.';
    }
    
    return text;
  }

  /**
   * Validates that the cleaned sentence meets quality standards
   */
  private isValidCleanedSentence(text: string): boolean {
    if (!text || text.length < 3) return false;
    
    // Check for minimum word count
    const words = text.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 2) return false;
    
    // Check for excessive punctuation (might indicate cleaning failure)
    const punctuationCount = (text.match(/[.!?;:,]/g) || []).length;
    const wordCount = words.length;
    if (punctuationCount > wordCount * 0.5) return false; // Too much punctuation
    
    // Check for remaining problematic patterns
    const problematicPatterns = [
      /[…\.]{3,}/, // Still has excessive dots
      /\s{3,}/, // Excessive whitespace
      /^[^A-Z]/, // Doesn't start with capital
      /[\[\]\{\}\<\>]/, // Still has brackets
      /^[.!?;:,]/, // Starts with punctuation
    ];
    
    if (problematicPatterns.some(pattern => pattern.test(text))) {
      return false;
    }
    
    return true;
  }

  // Keep the old method for backward compatibility if needed elsewhere
  private cleanSentence(sentence: string): string {
    return this.robustCleanSentence(sentence);
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