declare interface ExampleSentence {
  translated: string;
  english: string;
}

declare interface LanguageInfo {
  code: string;
  name: string;
}

declare class TranslationService {
  translateText(text: string, targetLanguage: string): Promise<string>;
  getExampleSentence(word: string, targetLanguage: string): Promise<ExampleSentence>;
  getSupportedLanguages(): Record<string, string>;
}

declare const translationService: TranslationService;
export default translationService;