declare interface ExampleSentence {
  english: string;
  translated: string;
  source: string;
}

declare class TranslationService {
  initialize(): Promise<boolean>;
  translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string>;
  getExampleSentence(word: string, targetLanguage: string): Promise<ExampleSentence>;
  getSupportedLanguages(): Record<string, string>;
}

declare const translationService: TranslationService;
export default translationService;