import AsyncStorage from '@react-native-async-storage/async-storage';
import WordCategorizer from './WordCategorizer';
import ExampleSentenceFilters from './ExampleSentenceFilters';
import { templates, additionalTemplates } from './ExampleTemplates';

class ExampleSentenceGenerator {
  constructor() {
    this.debug = false;
    this.recentTemplates = {};
    this.maxRecentTemplates = 10;
    this.templateHistory = {};
    this.allTemplates = { ...templates, ...additionalTemplates };
  }

  setDebug(debug) {
    this.debug = debug;
    ExampleSentenceFilters.setDebug(debug);
  }

  async getExampleSentence(word, targetLanguage, translateFunc, category = null) {
    try {
      const originalWord = word;
      word = word.trim().toLowerCase();

      // Fuzzy match helper
      function fuzzyMatch(a, b) {
        if (!a || !b) return false;
        a = a.toLowerCase();
        b = b.toLowerCase();
        if (a === b) return true;
        if (a.includes(b) || b.includes(a)) return true;
        // Levenshtein distance
        function lev(s, t) {
          const d = [];
          for (let i = 0; i <= s.length; i++) d[i] = [i];
          for (let j = 0; j <= t.length; j++) d[0][j] = j;
          for (let i = 1; i <= s.length; i++) {
            for (let j = 1; j <= t.length; j++) {
              d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1)
              );
            }
          }
          return d[s.length][t.length];
        }
        return lev(a, b) <= 2;
      }

      // Helper to get synonyms for a word
      function getSynonyms(word) {
        // Add more synonyms as needed
        const synonymMap = {
          'glasses': ['brille', 'gläser', 'eyeglasses', 'spectacles'],
          'brille': ['glasses', 'gläser', 'eyeglasses', 'spectacles'],
          'gläser': ['glasses', 'brille', 'eyeglasses', 'spectacles'],
          'top': ['oberteil', 'spitze', 'shirt', 'bluse'],
          'oberteil': ['top', 'spitze', 'shirt', 'bluse'],
          'spitze': ['top', 'oberteil', 'shirt', 'bluse'],
          'now': ['maintenant', 'jetzt', 'nun'],
        };
        return [word, ...(synonymMap[word] || [])];
      }

      // Try to get example from API with filter pipeline, strict matching and blanking
      const synonyms = getSynonyms(word);
      const examples = await this.getApiExamplesWithPipeline(word, category);
      let validExample = null;
      if (examples && examples.length > 0) {
        // Only accept examples that contain the exact word as a standalone word
        const validExactExamples = examples.filter(ex => {
          const exactPattern = new RegExp(`\\b${word}\\b`, 'i');
          return exactPattern.test(ex);
        });
        // Track recently used examples for this word
        const recentKey = `recent_${word}`;
        if (!this.recentTemplates[recentKey]) this.recentTemplates[recentKey] = [];
        // Filter out recently used examples
        const unusedExamples = validExactExamples.filter(ex => !this.recentTemplates[recentKey].includes(ex));
        let chosenExample = null;
        if (unusedExamples.length > 0) {
          chosenExample = unusedExamples[Math.floor(Math.random() * unusedExamples.length)];
        } else if (validExactExamples.length > 0) {
          // All have been used, reset history and pick randomly
          this.recentTemplates[recentKey] = [];
          chosenExample = validExactExamples[Math.floor(Math.random() * validExactExamples.length)];
        }
        if (chosenExample) {
          // Blank out the exact word only
          const regex = new RegExp(`\\b${word}\\b`, 'i');
          let blanked = chosenExample.replace(regex, '____');
          validExample = blanked;
          // Track as recently used
          this.recentTemplates[recentKey].push(chosenExample);
          if (this.recentTemplates[recentKey].length > this.maxRecentTemplates) {
            this.recentTemplates[recentKey] = this.recentTemplates[recentKey].slice(-this.maxRecentTemplates);
          }
        }
        // If no example with the exact word, as a last resort, allow a synonym
        if (!validExample) {
          const validSynExamples = examples.filter(ex => {
            return synonyms.some(syn => {
              if (syn.toLowerCase() === word.toLowerCase()) return false;
              const pattern = new RegExp(`\\b${syn}\\b`, 'i');
              return pattern.test(ex);
            });
          });
          // Track recently used synonym examples
          const unusedSynExamples = validSynExamples.filter(ex => !this.recentTemplates[recentKey].includes(ex));
          let chosenSynExample = null;
          if (unusedSynExamples.length > 0) {
            chosenSynExample = unusedSynExamples[Math.floor(Math.random() * unusedSynExamples.length)];
          } else if (validSynExamples.length > 0) {
            this.recentTemplates[recentKey] = [];
            chosenSynExample = validSynExamples[Math.floor(Math.random() * validSynExamples.length)];
          }
          if (chosenSynExample) {
            let foundSyn = synonyms.find(syn => {
              if (syn.toLowerCase() === word.toLowerCase()) return false;
              const pattern = new RegExp(`\\b${syn}\\b`, 'i');
              return pattern.test(chosenSynExample);
            });
            if (foundSyn) {
              const regex = new RegExp(`\\b${foundSyn}\\b`, 'i');
              let blanked = chosenSynExample.replace(regex, '____');
              validExample = blanked;
              this.recentTemplates[recentKey].push(chosenSynExample);
              if (this.recentTemplates[recentKey].length > this.maxRecentTemplates) {
                this.recentTemplates[recentKey] = this.recentTemplates[recentKey].slice(-this.maxRecentTemplates);
              }
            }
          }
        }
      }

      if (validExample) {
        const translated = await translateFunc(validExample, targetLanguage);
        return {
          english: validExample,
          translated,
          source: 'api_example_fuzzy_match'
        };
      }

      // Use category if provided, otherwise determine category
      const wordCategory = category || WordCategorizer.getWordCategory(word);

      // Get appropriate templates and select a diverse one
      const { template, complexity } = await this.selectDiverseTemplate(word, wordCategory);

      // Create example from template with appropriate handling
      let example = this.createExampleFromTemplate(template, word, wordCategory);

      // Ensure the exact word appears in the template, blank it out; only use synonym if not present
      let foundSyn = null;
      const exactPattern = new RegExp(`\\b${word}\\b`, 'i');
      if (exactPattern.test(example)) {
        foundSyn = word;
      } else {
        foundSyn = synonyms.find(syn => fuzzyMatch(example, syn));
      }
      if (foundSyn) {
        const regex = new RegExp(`\\b${foundSyn}\\b`, 'i');
        example = example.replace(regex, '____');
      } else {
        // Fallback: force a guaranteed template
        example = `____`;
      }

      // Translate the example
      const translated = await translateFunc(example, targetLanguage);

      return {
        english: example,
        translated: translated,
        source: `template_${wordCategory}_${complexity}_forced_blank`
      };
    } catch (error) {
      if (this.debug) {
        console.error('Example sentence generation error:', error);
      }
      // Ultimate fallback
      const fallback = `This is a ${word}.`;
      const translated = await translateFunc(fallback, targetLanguage);
      return {
        english: fallback,
        translated: translated,
        source: 'error_fallback'
      };
    }
  }

  async getFreeDictionaryExamples(word) {
    try {
      // Check cache first
      const cacheKey = `freedict_${word}`;
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
      
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
      const response = await fetch(url, { timeout: 5000 });
      
      if (response.status !== 200) {
        return [];
      }
      
      const data = await response.json();
      
      // Extract example sentences
      const examples = [];
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
      
      // Cache results
      if (examples.length > 0) {
        await this.setCached(cacheKey, examples);
      }
      
      return examples;
    } catch (error) {
      return [];
    }
  }

  async getMyMemoryExamples(word) {
    try {
      // MyMemory API provides translated sentences which we can use as examples
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|en&de=yourmail@example.com`;
      const response = await fetch(url, { timeout: 5000 });
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      
      // Extract matches that contain example sentences
      const examples = [];
      if (data.matches) {
        for (const match of data.matches) {
          if (match.segment && match.segment.toLowerCase().includes(word.toLowerCase())) {
            examples.push(match.segment);
          }
        }
      }
      
      return examples.slice(0, 5); // Limit to 5 examples
    } catch (error) {
      if (this.debug) {
        console.log(`>>> MyMemory API error: ${error}`);
      }
      return [];
    }
  }

  selectDiverseExample(examples, word) {
    if (!examples || examples.length === 0) {
      return null;
    }
    
    // If only one example, return it
    if (examples.length === 1) {
      return examples[0];
    }
    
    // For now, return a random example
    // In the future, we could implement more sophisticated selection
    return examples[Math.floor(Math.random() * examples.length)];
  }

  async selectDiverseTemplate(word, category) {
    // Determine appropriate template category
    let templateCategory = category;
    
    // If no templates for this category, use general or noun
    if (!this.allTemplates[templateCategory]) {
      templateCategory = ["clothing", "tools", "jewelry", "eyewear"].includes(category) ? "noun" : "general";
    }
    
    // Get template subcategories for this type (basic, intermediate, advanced)
    const categoryTemplates = this.allTemplates[templateCategory] || this.allTemplates.general;
    const subcats = Object.keys(categoryTemplates);
    
    // Adjust weights for specific categories to prefer simpler examples
    let weights;
    if (["animal", "toys"].includes(category) || word === "bear" || word === "teddy bear") {
      // 60% basic, 30% intermediate, 10% advanced
      weights = [0.6, 0.3, 0.1];
    } else if (WordCategorizer.isPluralWord(word) || word.length <= 4) {
      // For simple or plural words, prefer simpler examples
      weights = [0.6, 0.3, 0.1];
    } else {
      // Default weights: 50% basic, 30% intermediate, 20% advanced
      weights = [0.5, 0.3, 0.2];
    }
    
    // Select complexity level
    const complexity = this.weightedRandom(subcats, weights.slice(0, subcats.length));
    
    // Get templates for this category and complexity
    let templates = categoryTemplates[complexity] || categoryTemplates.basic || [];

    // Filter out inappropriate templates for certain categories
    if (templateCategory === 'person') {
      // Exclude templates with verbs like 'buy', 'sell', 'borrow', 'need to buy', etc.
      const inappropriateVerbs = [
        'buy', 'sell', 'borrow', 'purchase', 'own', 'get a', 'need a', 'need to buy', 'replace', 'belongs to me', 'can I borrow', 'I need to buy'
      ];
      templates = templates.filter(t => !inappropriateVerbs.some(v => t.toLowerCase().includes(v)));
      // If all templates are filtered out, fall back to unfiltered
      if (templates.length === 0) {
        templates = categoryTemplates[complexity] || categoryTemplates.basic || [];
      }
    }
    
    // Initialize template history for this word if not exists
    const wordKey = `${word}_${templateCategory}`;
    if (!this.templateHistory[wordKey]) {
      this.templateHistory[wordKey] = [];
    }
    
    // Try to find a template that hasn't been used recently
    let availableTemplates = templates.filter(t => !this.templateHistory[wordKey].includes(t));
    
    // If all templates have been used, reset history
    if (availableTemplates.length === 0) {
      availableTemplates = templates;
      this.templateHistory[wordKey] = [];
    }
    
    // Select a template
    const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
    
    // Update history
    this.templateHistory[wordKey].push(template);
    if (this.templateHistory[wordKey].length > Math.min(5, templates.length)) {
      this.templateHistory[wordKey] = this.templateHistory[wordKey].slice(-5);
    }
    
    return { template, complexity };
  }

  createExampleFromTemplate(template, word, category) {
    let example = template;
    
    // Special handling for plural words
    if (WordCategorizer.isPluralWord(word)) {
      // Replace articles appropriately for plurals
      example = example.replace("a {word}", "{word}").replace("an {word}", "{word}");
      example = example.replace("the {word} is", "the {word} are");
      example = example.replace("This {word} is", "These {word} are");
      example = example.replace("this {word} is", "these {word} are");
    }
    // Special handling for uncountable nouns
    else if (category === "uncountable_clothing") {
      // Remove articles for uncountable nouns
      example = example.replace("a {word}", "{word}").replace("an {word}", "{word}");
    }
    
    // Insert word into template
    example = example.replace(/{word}/g, word);
    
    // Ensure first letter is capitalized
    if (example && !example[0].match(/[A-Z]/)) {
      example = example[0].toUpperCase() + example.slice(1);
    }
    
    // Ensure ending punctuation
    if (example && !example.match(/[.!?]$/)) {
      example += '.';
    }
    
    return example;
  }

  cleanSentence(sentence) {
    // Remove quotes, extra spaces, etc.
    sentence = sentence.trim();
    sentence = sentence.replace(/\s+/g, ' ');
    
    // Remove metadata markers
    sentence = sentence.replace(/\[.*?\]/g, '');
    
    // Capitalize first letter
    if (sentence && !sentence[0].match(/[A-Z]/)) {
      sentence = sentence[0].toUpperCase() + sentence.slice(1);
    }
    
    // Ensure ending punctuation
    if (sentence && !sentence.match(/[.!?]$/)) {
      sentence += '.';
    }
    
    return sentence;
  }

  // Helper methods
  weightedRandom(items, weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    
    return items[items.length - 1];
  }

  async getCached(key) {
    try {
      const cached = await AsyncStorage.getItem(`sentence_cache_${key}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Check if cache is less than 24 hours old
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return data.value;
        }
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  }

  async setCached(key, value) {
    try {
      const data = {
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