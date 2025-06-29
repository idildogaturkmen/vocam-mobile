class TranslationService {
  constructor() {
    this.cache = new Map();
  }

  async translateText(text, targetLanguage, sourceLanguage = 'en') {
    const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // MyMemory API (free tier)
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|${targetLanguage}`
      );
      
      const data = await response.json();
      
      if (data.responseStatus === 200) {
        const translation = data.responseData.translatedText;
        this.cache.set(cacheKey, translation);
        return translation;
      }
      
      return text; // Return original if translation fails
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }

  async getExampleSentence(word, targetLanguage) {
    const examples = {
      en: `I can see a ${word} in the picture.`,
      es: `Puedo ver un ${word} en la imagen.`,
      fr: `Je peux voir un ${word} dans l'image.`,
      de: `Ich kann ein ${word} im Bild sehen.`,
      it: `Posso vedere un ${word} nell'immagine.`,
    };

    const englishSentence = examples.en;
    const translatedSentence = examples[targetLanguage] || 
      await this.translateText(englishSentence, targetLanguage);

    return {
      english: englishSentence,
      translated: translatedSentence,
      source: 'template'
    };
  }
}

export default new TranslationService();