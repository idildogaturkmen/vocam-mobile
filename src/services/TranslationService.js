class TranslationService {
  constructor() {
    this.apiKey = null; // You can add Google Translate API key here if needed
  }

  async translateText(text, targetLanguage) {
    try {
      console.log(`🌐 Translating "${text}" to ${targetLanguage}`);
      
      // For now, we'll use a simple mock translation
      // You can replace this with actual Google Translate API calls later
      const mockTranslations = {
        'es': {
          'cup': 'taza',
          'cell phone': 'teléfono móvil',
          'book': 'libro',
          'chair': 'silla',
          'bottle': 'botella',
          'laptop': 'portátil',
          'car': 'coche',
          'cat': 'gato',
          'dog': 'perro',
          'table': 'mesa'
        },
        'fr': {
          'cup': 'tasse',
          'cell phone': 'téléphone portable',
          'book': 'livre',
          'chair': 'chaise',
          'bottle': 'bouteille',
          'laptop': 'ordinateur portable',
          'car': 'voiture',
          'cat': 'chat',
          'dog': 'chien',
          'table': 'table'
        },
        'de': {
          'cup': 'Tasse',
          'cell phone': 'Handy',
          'book': 'Buch',
          'chair': 'Stuhl',
          'bottle': 'Flasche',
          'laptop': 'Laptop',
          'car': 'Auto',
          'cat': 'Katze',
          'dog': 'Hund',
          'table': 'Tisch'
        }
      };

      const translation = mockTranslations[targetLanguage]?.[text.toLowerCase()] || text;
      console.log(`✅ Translation: ${text} → ${translation}`);
      return translation;
      
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text if translation fails
    }
  }

  async getExampleSentence(word, targetLanguage) {
    try {
      console.log(`📝 Getting example sentence for "${word}" in ${targetLanguage}`);
      
      // Mock example sentences
      const examples = {
        'es': {
          english: `I can see a ${word}.`,
          translated: `Puedo ver un/una ${await this.translateText(word, targetLanguage)}.`
        },
        'fr': {
          english: `I can see a ${word}.`,
          translated: `Je peux voir un/une ${await this.translateText(word, targetLanguage)}.`
        },
        'de': {
          english: `I can see a ${word}.`,
          translated: `Ich kann einen/eine ${await this.translateText(word, targetLanguage)} sehen.`
        }
      };

      const example = examples[targetLanguage] || {
        english: `I can see a ${word}.`,
        translated: `I can see a ${word}.`
      };

      console.log(`✅ Example: ${example.english} → ${example.translated}`);
      return example;
      
    } catch (error) {
      console.error('Example sentence error:', error);
      return {
        english: `I can see a ${word}.`,
        translated: `I can see a ${word}.`
      };
    }
  }

  // You can add more translation methods here
  async detectLanguage(text) {
    // Mock language detection - returns 'en' for English
    return 'en';
  }

  getSupportedLanguages() {
    return [
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'zh-CN', name: 'Chinese (Simplified)' }
    ];
  }
}

export default new TranslationService();