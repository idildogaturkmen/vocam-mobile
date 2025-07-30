import AsyncStorage from '@react-native-async-storage/async-storage';
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
  
  // API Keys from environment variables
  private wordnikApiKey: string | undefined = process.env.EXPO_PUBLIC_WORDNIK_API_KEY;
  private wordsApiKey: string | undefined = process.env.EXPO_PUBLIC_WORDS_API_KEY;
  private oxfordAppId: string | undefined = process.env.EXPO_PUBLIC_OXFORD_APP_ID;
  private oxfordAppKey: string | undefined = process.env.EXPO_PUBLIC_OXFORD_APP_KEY;
  
  // API limits
  private wordsApiRequestCount: number = 0;
  private wordsApiMonthlyLimit: number = 2500;

  setDebug(debug: boolean): void {
    this.debug = debug;
  }

  // Helper function for timeout in React Native
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

      if (this.debug) {
        console.log(`\n🔍 Getting example for word: ${word}`);
      }

      // Try to get examples from APIs
      const examples = await this.getApiExamplesWithPipeline(word, category);
      
      if (this.debug) {
        console.log(`📊 Found ${examples.length} total examples for "${word}"`);
        examples.forEach((ex, index) => {
          console.log(`  ${index + 1}. [${ex.source}]: ${ex.text}`);
        });
      }
      
      // Score and rank examples
      const scoredExamples = this.scoreExamples(examples, word);
      
      if (this.debug && scoredExamples.length > 0) {
        console.log(`\n📈 Scored examples:`);
        scoredExamples.slice(0, 5).forEach((ex, index) => {
          console.log(`  ${index + 1}. Score: ${ex.score} - "${ex.text}" [${ex.source}]`);
        });
      }
      
      // Select the best example
      if (scoredExamples.length > 0) {
        const bestExample = scoredExamples[0];
        
        if (this.debug) {
          console.log(`✅ Selected best example (score: ${bestExample.score}) from ${bestExample.source}: "${bestExample.text}"`);
        }
        
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
      console.log(`⚠️ No API examples found for "${word}", using contextual sentence`);
      
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

  private scoreExamples(examples: ExampleResult[], targetWord: string): ScoredExample[] {
    return examples
      .map(ex => {
        let score = 0;
        const text = ex.text.toLowerCase();
        const words = targetWord.split(' ');
        
        // CRITICAL: Strongly prefer examples with the EXACT full phrase
        if (text.includes(targetWord.toLowerCase())) {
          score += 100; // Much higher bonus for exact match
        } else if (words.length > 1) {
          // For compound words, heavily penalize if only partial match
          const hasAllWords = words.every(w => text.includes(w.toLowerCase()));
          if (!hasAllWords) {
            score -= 50; // Heavy penalty if missing any word
          } else {
            score += 20; // Small bonus if has all words but not together
          }
        }
        
        // Source quality scoring - PRIORITIZE PAID APIs
        const sourceScores: Record<string, number> = {
          'Oxford': 20,         // Highest - paid API
          'WordsAPI': 18,       // High - paid API
          'Tatoeba': 15,
          'FreeDictionary': 12,
          'Wordnik': 8,
          'Datamuse': 3,
        };
        score += sourceScores[ex.source] || 0;
        
        // Penalize metaphorical uses for object detection
        const metaphoricalIndicators = [
          'at the top of',
          'on top of the world',
          'top lawyer',
          'top student',
          'spinning top',
          'tank top',
          'topped with',
          'topping from',
          'top yourself',
        ];
        const hasMetaphorical = metaphoricalIndicators.some(phrase => text.includes(phrase));
        if (hasMetaphorical) {
          score -= 60;
        }
        
        // Penalize generic or nonsensical phrases
        const nonsensicalPhrases = [
          'computer laptop',
          'shortcut keyboard',
          'management top',
          'is very useful',
          'caught my attention',
          'I need a new',
        ];
        const isNonsensical = nonsensicalPhrases.some(phrase => text.includes(phrase));
        if (isNonsensical) {
          score -= 50;
        }
        
        // Prefer natural, everyday sentences
        if (text.length > 20 && text.length < 80) {
          score += 5;
        }
        
        // Bonus for concrete, physical descriptions
        const concretePatterns = /\b(wooden|glass|metal|plastic|leather|marble|oak|pine)\b/i;
        if (concretePatterns.test(text)) {
          score += 10;
        }
        
        // Bonus for location/placement context
        const locationPatterns = /\b(on the|in the|under the|beside the|near the|kitchen|living room|office|bedroom)\b/i;
        if (locationPatterns.test(text)) {
          score += 8;
        }
        
        // Bonus for sentences with more context
        const wordCount = ex.text.split(' ').length;
        if (wordCount >= 6 && wordCount <= 15) {
          score += 10;
        } else if (wordCount > 15 && wordCount <= 25) {
          score += 5;
        }
        
        // Penalize very short sentences
        if (wordCount <= 3) {
          score -= 20;
        }
        
        // Bonus for possessive/descriptive context
        const contextPatterns = new RegExp(`\\b(my|your|his|her|their|our|the new|the old|this|that)\\s+\\w*\\s*${targetWord}`, 'i');
        if (contextPatterns.test(text)) {
          score += 15;
        }
        
        // Bonus for action verbs (but not the word as a verb)
        const actionPatterns = /\b(opened|closed|bought|fixed|cleaned|moved|placed|put|set)\b/i;
        if (actionPatterns.test(text) && !text.includes(`${targetWord}ed`)) {
          score += 10;
        }

        // Penalize questions and exclamations
        if (text.includes('?')) score -= 10;
        if (text.includes('!')) score -= 5;
        
        return { ...ex, score };
      })
      .filter(ex => ex.score > -20)
      .sort((a, b) => b.score - a.score);
  }

  private async getApiExamplesWithPipeline(word: string, category: string | null): Promise<ExampleResult[]> {
    try {
      let examples: ExampleResult[] = [];
      
      // Handle compound words - for very long phrases, extract key words
      const words = word.split(' ');
      const searchTerms: string[] = [];
      
      // Always search for full phrase first
      searchTerms.push(word);
      
      // For complex phrases, extract meaningful parts
      if (words.length > 3) {
        // For "kitchen & dining room table", also search for "table" and "dining table"
        const keyWords = words.filter(w => !['&', 'and', 'the', 'a', 'an', 'room'].includes(w));
        if (keyWords.includes('table')) {
          searchTerms.push('table');
          if (keyWords.includes('dining')) {
            searchTerms.push('dining table');
          }
          if (keyWords.includes('kitchen')) {
            searchTerms.push('kitchen table');
          }
        }
      } else if (words.length > 1) {
        // For simpler compound words, search the last word as fallback
        searchTerms.push(words[words.length - 1]);
      }
      
      // Run API calls in parallel - PRIORITIZE PAID APIs
      const apiPromises: Promise<ExampleResult[]>[] = [];
      
      for (const searchTerm of searchTerms) {
        // 1. Oxford API FIRST (paid, high quality)
        if (this.oxfordAppId && this.oxfordAppKey && 
            this.oxfordAppId !== 'your-oxford-app-id') {
          apiPromises.push(
            this.getOxfordExamples(searchTerm)
              .then(results => results.map(text => ({
                text: this.cleanSentence(text),
                source: 'Oxford',
                searchTerm
              })))
              .catch(error => {
                if (this.debug) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  console.log(`Oxford failed for "${searchTerm}":`, errorMessage);
                }
                return [];
              })
          );
        }
        
        // 2. WordsAPI SECOND (paid, good quality)
        if (this.wordsApiKey && 
            this.wordsApiKey !== 'your-words-api-key' && 
            this.wordsApiRequestCount < this.wordsApiMonthlyLimit) {
          apiPromises.push(
            this.getWordsApiExamples(searchTerm)
              .then(results => {
                this.wordsApiRequestCount++;
                return results.map(text => ({
                  text: this.cleanSentence(text),
                  source: 'WordsAPI',
                  searchTerm
                }));
              })
              .catch(error => {
                if (this.debug) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  console.log(`WordsAPI failed for "${searchTerm}":`, errorMessage);
                }
                return [];
              })
          );
        }
        
        // 3. Tatoeba - High quality community sentences (FREE)
        apiPromises.push(
          this.getTatoebaExamples(searchTerm)
            .then(results => results.map(text => ({
              text: this.cleanSentence(text),
              source: 'Tatoeba',
              searchTerm
            })))
            .catch(error => {
              if (this.debug) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`Tatoeba failed for "${searchTerm}":`, errorMessage);
              }
              return [];
            })
        );
        
        // 4. Free Dictionary - Good quality dictionary examples (FREE)
        apiPromises.push(
          this.getFreeDictionaryExamples(searchTerm)
            .then(results => results.map(text => ({
              text: this.cleanSentence(text),
              source: 'FreeDictionary',
              searchTerm
            })))
            .catch(error => {
              if (this.debug) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`FreeDictionary failed for "${searchTerm}":`, errorMessage);
              }
              return [];
            })
        );
        
        // 5. Wordnik - if configured
        if (this.wordnikApiKey && this.wordnikApiKey !== 'your-wordnik-api-key') {
          apiPromises.push(
            this.getWordnikExamples(searchTerm)
              .then(results => results.map(text => ({
                text: this.cleanSentence(text),
                source: 'Wordnik',
                searchTerm
              })))
              .catch(error => {
                if (this.debug) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  console.log(`Wordnik failed for "${searchTerm}":`, errorMessage);
                }
                return [];
              })
          );
        }
      }
      
      // Wait for all API calls
      const allResults = await Promise.all(apiPromises);
      examples = allResults.flat();
      
      // Only use Datamuse for single words or as last resort
      if (examples.length < 3 && words.length === 1) {
        try {
          const datamuseExamples = await this.getDatamuseContextualExamples(word);
          examples = examples.concat(
            datamuseExamples.map(text => ({
              text: this.cleanSentence(text),
              source: 'Datamuse',
              searchTerm: word
            }))
          );
        } catch (error) {
          if (this.debug) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('Datamuse failed:', errorMessage);
          }
        }
      }
      
      if (this.debug) {
        console.log(`Raw examples collected: ${examples.length}`);
      }
      
      // Filter and clean
      examples = this.filterWrongMeanings(examples, word);
      examples = this.removeInappropriateExamples(examples, word);
      
      // Remove duplicates
      const uniqueTexts = new Set<string>();
      examples = examples.filter(ex => {
        const normalized = ex.text.toLowerCase().trim();
        if (uniqueTexts.has(normalized)) return false;
        uniqueTexts.add(normalized);
        return true;
      });
      
      if (this.debug) {
        console.log(`Final filtered examples: ${examples.length}`);
      }
      
      return examples;
    } catch (error) {
      console.error('API examples pipeline error:', error);
      return [];
    }
  }

  // Fixed Datamuse to generate better contextual examples
  private async getDatamuseContextualExamples(word: string): Promise<string[]> {
    try {
      const url = `https://api.datamuse.com/words?rel_trg=${encodeURIComponent(word)}&max=10`;
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) return [];
      
      const relatedWords = await response.json();
      const examples: string[] = [];
      
      // Generate natural sentences based on the word type
      const templates = this.getNaturalTemplates(word);
      
      // Use up to 3 templates
      examples.push(...templates.slice(0, 3));
      
      return examples;
    } catch (error) {
      if (this.debug) console.error('Datamuse contextual error:', error);
      return [];
    }
  }

  private async getOxfordExamples(word: string): Promise<string[]> {
    try {
      if (!this.oxfordAppId || !this.oxfordAppKey) {
        if (this.debug) console.log('Oxford API credentials not configured');
        return [];
      }
      
      const cacheKey = `oxford_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) {
        if (this.debug) console.log(`  📦 Using cached Oxford examples for "${word}"`);
        return cached;
      }
      
      const url = `https://od-api.oxforddictionaries.com/api/v2/entries/en-gb/${word.toLowerCase()}`;
      
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'app_id': this.oxfordAppId,
          'app_key': this.oxfordAppKey
        }
      });
      
      if (!response.ok) {
        if (this.debug) console.log(`  ❌ Oxford API returned ${response.status} for "${word}"`);
        return [];
      }
      
      const data = await response.json();
      const examples: string[] = [];
      
      if (data.results) {
        for (const result of data.results) {
          for (const lexicalEntry of result.lexicalEntries || []) {
            for (const entry of lexicalEntry.entries || []) {
              for (const sense of entry.senses || []) {
                for (const example of sense.examples || []) {
                  if (example.text) {
                    examples.push(example.text);
                  }
                }
                // Also check subsenses
                for (const subsense of sense.subsenses || []) {
                  for (const example of subsense.examples || []) {
                    if (example.text) {
                      examples.push(example.text);
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      if (this.debug && examples.length > 0) {
        console.log(`  ✅ Oxford found ${examples.length} examples for "${word}"`);
      }
      
      if (examples.length > 0) {
        await this.setCached(cacheKey, examples.slice(0, 15));
      }
      
      return examples;
    } catch (error) {
      if (this.debug) console.error('Oxford API error:', error);
      return [];
    }
  }

  // Generate natural, everyday sentences
  private getNaturalTemplates(word: string): string[] {
    // Common objects and their typical contexts
    const contextTemplates: Record<string, string[]> = {
      'keyboard': [
        'She typed quickly on her wireless keyboard.',
        'The mechanical keyboard made satisfying clicking sounds.',
        'I spilled coffee on my keyboard this morning.',
        'The ergonomic keyboard helped reduce wrist strain.'
      ],
      'laptop': [
        'He opened his laptop to check his emails.',
        'My laptop battery only lasts three hours now.',
        'She carries her laptop in a protective case.',
        'The laptop screen was too bright in the dark room.'
      ],
      'table top': [
        'The marble table top was cool to the touch.',
        'We need to clean the table top before dinner.',
        'The glass table top showed every fingerprint.',
        'She placed the vase on the wooden table top.'
      ],
      'couch': [
        'We bought a new leather couch for the living room.',
        'The dog loves sleeping on the couch.',
        'Three people can comfortably sit on this couch.',
        'The couch cushions need to be fluffed.'
      ],
      'chair': [
        'He adjusted the office chair to the right height.',
        'The dining chair had a comfortable cushion.',
        'She pulled up a chair to join the conversation.',
        'The wooden chair creaked when he sat down.'
      ],
      'desk': [
        'Her desk was organized with labeled folders.',
        'The desk drawer was stuck again.',
        'He works at a standing desk for better posture.',
        'Papers were scattered across the desk.'
      ],
      'monitor': [
        'The computer monitor displayed vibrant colors.',
        'She adjusted the monitor brightness to reduce eye strain.',
        'Dual monitors increased his productivity.',
        'The monitor stand kept the screen at eye level.'
      ],
      'mouse': [
        'The wireless mouse needed new batteries.',
        'She clicked the mouse to open the file.',
        'The gaming mouse had customizable buttons.',
        'He preferred using a mouse over the trackpad.'
      ],
      'lighting': [
        'The overhead lighting was too bright for the evening.',
        'We installed new LED lighting in the kitchen.',
        'The ambient lighting created a cozy atmosphere.',
        'She adjusted the lighting to reduce glare on her screen.'
      ],
      'table': [
        'We gathered around the dining table for dinner.',
        'The coffee table was covered with magazines.',
        'She wiped down the kitchen table after breakfast.',
        'The wooden table had been in the family for generations.'
      ],
      'dining table': [
        'The dining table seats eight people comfortably.',
        'We set the dining table with our best china.',
        'The dining table was made from solid oak.',
        'They bought a new dining table for their home.'
      ],
      'kitchen table': [
        'The family ate breakfast at the kitchen table.',
        'She did her homework at the kitchen table.',
        'The kitchen table was cluttered with mail.',
        'We need a bigger kitchen table for our new house.'
      ],
      'kitchen & dining room table': [
        'The kitchen & dining room table serves both spaces perfectly.',
        'Our kitchen & dining room table extends for guests.',
        'The kitchen & dining room table has a beautiful wood finish.',
        'We chose a kitchen & dining room table that matches our decor.'
      ],
      '2d barcode': [
        'The cashier scanned the 2D barcode on my phone.',
        'The 2D barcode contained all the shipping information.',
        'Modern 2D barcodes can store much more data than traditional ones.',
        'The app generates a 2D barcode for mobile tickets.'
      ],
      'qr code': [
        'Scan the QR code to see the menu.',
        'The QR code linked to the restaurant website.',
        'Payment was easy with the QR code on the table.',
        'The poster had a QR code for more information.'
      ],
      'barcode': [
        'The barcode wouldn\'t scan at the checkout.',
        'Each product has a unique barcode.',
        'The barcode reader beeped when it worked.',
        'She printed barcode labels for inventory.'
      ]
    };
    
    // Check for exact match first
    let templates = contextTemplates[word];
    
    // If no exact match, try to find partial matches
    if (!templates) {
      for (const [key, value] of Object.entries(contextTemplates)) {
        if (word.includes(key) || key.includes(word)) {
          templates = value;
          break;
        }
      }
    }
    
    // Default templates if nothing matches
    return templates || [
      `The ${word} was exactly what we needed.`,
      `She carefully examined the ${word}.`,
      `They placed the ${word} in the corner.`,
      `The new ${word} arrived yesterday.`
    ];
  }

  // Tatoeba API - Fixed for React Native
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
      if (this.debug) console.error('Tatoeba API error:', error);
      return [];
    }
  }

  // Other API methods with fetchWithTimeout
  private async getFreeDictionaryExamples(word: string): Promise<string[]> {
    try {
      const cacheKey = `freedict_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) {
        if (this.debug) console.log(`  📦 Using cached FreeDictionary examples for "${word}"`);
        return cached;
      }
      
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        if (this.debug) {
          console.log(`  ❌ Free Dictionary API returned ${response.status} for "${word}"`);
        }
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
      
      if (this.debug && examples.length > 0) {
        console.log(`  ✅ FreeDictionary found ${examples.length} examples for "${word}"`);
      }
      
      if (examples.length > 0) {
        await this.setCached(cacheKey, examples);
      }
      
      return examples;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('  ⏱️ Free Dictionary API timeout');
      } else if (this.debug) {
        console.error('  ❌ Free Dictionary API error:', error);
      }
      return [];
    }
  }

  private async getWordnikExamples(word: string): Promise<string[]> {
    try {
      if (!this.wordnikApiKey) {
        if (this.debug) console.log('Wordnik API key not configured');
        return [];
      }
      
      const cacheKey = `wordnik_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) return cached;
      
      const url = `https://api.wordnik.com/v4/word.json/${word}/examples?limit=10&useCanonical=true&api_key=${this.wordnikApiKey}`;
      
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) return [];
      
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
        await this.setCached(cacheKey, examples);
      }
      
      return examples;
    } catch (error) {
      if (this.debug) console.error('Wordnik API error:', error);
      return [];
    }
  }

  private async getWordsApiExamples(word: string): Promise<string[]> {
    try {
      if (!this.wordsApiKey) {
        if (this.debug) console.log('WordsAPI key not configured');
        return [];
      }
      
      const cacheKey = `wordsapi_${word}`;
      const cached = await this.getCached<string[]>(cacheKey);
      if (cached) {
        if (this.debug) console.log(`  📦 Using cached WordsAPI examples for "${word}"`);
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
      });
      
      if (!response.ok) {
        if (this.debug) console.log(`  ❌ WordsAPI returned ${response.status} for "${word}"`);
        return [];
      }
      
      const data = await response.json();
      const examples: string[] = data.examples || [];
      
      if (this.debug && examples.length > 0) {
        console.log(`  ✅ WordsAPI found ${examples.length} examples for "${word}"`);
      }
      
      if (examples.length > 0) {
        await this.setCached(cacheKey, examples.slice(0, 10));
      }
      
      return examples;
    } catch (error) {
      if (this.debug) console.error('WordsAPI error:', error);
      return [];
    }
  }

  // Enhanced filtering for wrong meanings
  private filterWrongMeanings(examples: ExampleResult[], targetWord: string): ExampleResult[] {
    const words = targetWord.split(' ');
    const lastWord = words[words.length - 1];
    
    const meaningFilters: Record<string, (text: string) => boolean> = {
      'top': (text: string) => {
        // For "table top", filter out other meanings of "top"
        const wrongMeanings = [
          /\btop of\b/i,
          /\bspinning top\b/i,
          /\btank top\b/i,
          /\btop lawyer\b/i,
          /\btop student\b/i,
          /\btop[\s-]?notch\b/i,
          /\bon top\b/i,
          /\btopped with\b/i,
          /\btopping\b/i,
          /\btop yourself\b/i
        ];
        
        // Allow "on top of the table" but not other "on top" uses
        if (/\bon top of the table\b/i.test(text)) return true;
        
        return !wrongMeanings.some(pattern => pattern.test(text));
      },

      'chair': (text: string) => {
        // Filter out verb usages of "chair"
        const verbPatterns = [
          /\bwill chair\b/i,
          /\bto chair\b/i,
          /\bchair(?:ing|ed|s)?\s+(?:a|the|this|that)\s+(?:meeting|session|committee)\b/i,
          /\bwas chaired\b/i,
          /\bfirst chair\b/i, // Musical position
        ];
        return !verbPatterns.some(pattern => pattern.test(text));
      },

      'mouse': (text: string) => {
        // Filter out animal references
        const animalPatterns = [
          /\b(?:mice|rodent|cheese|trap|tail|squeak|fur)\b/i,
          /\bcat.*mouse\b/i,
          /\bmouse.*hole\b/i
        ];
        return !animalPatterns.some(pattern => pattern.test(text));
      },
      
      'keyboard': (text: string) => {
        // Filter out "keyboarding" (verb) 
        return !/\bkeyboarding\b/i.test(text);
      },
      
      'lighting': (text: string) => {
        // Don't filter out lighting - it's a valid object
        return true;
      }
    };
    
    // Apply specific filters
    if (words.length > 1 && meaningFilters[lastWord]) {
      examples = examples.filter(ex => meaningFilters[lastWord](ex.text));
    } else if (meaningFilters[targetWord]) {
      examples = examples.filter(ex => meaningFilters[targetWord](ex.text));
    }
    
    return examples;
  }

  private removeInappropriateExamples(examples: ExampleResult[], word: string): ExampleResult[] {
    return examples.filter(ex => {
      const text = ex.text.toLowerCase();
      const words = word.split(' ');
      
      // For compound words, be more flexible
      if (words.length > 1) {
        // For very long phrases, check if it contains key words
        if (words.length > 3) {
          const keyWords = words.filter(w => !['&', 'and', 'the', 'a', 'an', 'room'].includes(w));
          const hasKeyWord = keyWords.some(kw => text.includes(kw.toLowerCase()));
          if (!hasKeyWord) return false;
        } else {
          // For shorter compounds, prefer full phrase but allow partial
          if (!text.includes(word.toLowerCase())) {
            if (ex.searchTerm && ex.searchTerm !== word) {
              const hasAllWords = words.every(w => text.includes(w.toLowerCase()));
              if (!hasAllWords) return false;
            }
          }
        }
      } else {
        // Single word - ensure it contains the word
        if (!text.includes(word.toLowerCase())) return false;
      }
      
      // Length check
      if (ex.text.length < 15 || ex.text.length > 200) return false;
      
      // Remove definitions
      if (/\b(?:is|are)\s+(?:a|an)\s+(?:type|kind|form|sort)\s+of\b/i.test(text)) {
        return false;
      }
      
      return true;
    });
  }

  // Generate contextual sentences when no examples found
  private async generateContextualSentence(word: string, category: string | null): Promise<string> {
    const templates = this.getNaturalTemplates(word);
    return templates[0] || `The ${word} is on the table.`;
  }

  private cleanSentence(sentence: string): string {
    sentence = sentence.trim().replace(/\s+/g, ' ');
    sentence = sentence.replace(/^\d+[\.\)]\s*/g, '');
    sentence = sentence.replace(/\[.*?\]/g, '');
    sentence = sentence.replace(/\((?:Source|Citation|Reference):.*?\)/gi, '');
    sentence = sentence.replace(/\(\d{4}\)/g, '');
    sentence = sentence.replace(/\s+([,.!?;:])/g, '$1');
    
    if (sentence && /^[a-z]/.test(sentence)) {
      sentence = sentence[0].toUpperCase() + sentence.slice(1);
    }
    
    if (sentence && !/[.!?]$/.test(sentence)) {
      sentence += '.';
    }
    
    return sentence;
  }

  private isVerb(word: string): boolean {
    return /(?:ing|ed|ize|ify|ate)$/.test(word);
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