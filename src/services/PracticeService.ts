import { supabase } from '../../database/config';
import VocabularyService, { SavedWord } from './VocabularyService';
import SpeechService from './SpeechService';
import ExampleSentenceGenerator from './example-sentences/ExampleSentenceGenerator';
import WordCategorizer from 'src/services/example-sentences/WordCategorizer.js';
import TranslationService from './TranslationService';

export interface QuizQuestion {
    id: string;
    type: 'translation' | 'reverse_translation' | 'multiple_choice' | 'listening' | 'typing' | 'context' | 'pronunciation' | 'recording';
    word: SavedWord;
    options?: string[];
    correctAnswer: string;
    userAnswer?: string;
    isCorrect?: boolean;
    timeSpent?: number;
    contextSentence?: string;
    displayQuestion?: string;
    recordingUri?: string;
}

export interface PracticeSession {
    id: string;
    userId: string;
    startedAt: Date;
    totalQuestions: number;
    correctAnswers: number;
    currentQuestion: number;
    questions: QuizQuestion[];
    isCompleted: boolean;
}

export interface PracticeStats {
    totalSessions: number;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    streak: number;
    lastPracticeDate: string | null;
    languageStats: Record<string, { practiced: number; correct: number }>;
    totalXP: number;
}

class PracticeService {
    private currentSession: PracticeSession | null = null;

    /**
     * Get available languages for practice
     */
    async getAvailableLanguages(userId: string): Promise<{ code: string; name: string; wordCount: number }[]> {
        try {
            // Use the optimized language counts method instead of loading all vocabulary
            const languageCounts = await VocabularyService.getUserVocabularyCounts(userId);
            
            
            return Object.entries(languageCounts)
                .map(([code, count]) => ({
                    code,
                    name: this.getLanguageName(code),
                    wordCount: count
                }))
                .filter(lang => lang.wordCount >= 4) // Need at least 4 words for practice
                .sort((a, b) => b.wordCount - a.wordCount);
        } catch (error) {
            console.error('Error getting available languages:', error);
            return [];
        }
    }

    /**
     * Start a new practice session
     */
    async startPracticeSession(
        userId: string, 
        questionCount: number = 10,
        languageFilter?: string
    ): Promise<PracticeSession | null> {
        try {
            // Get user's vocabulary
            const vocabulary = await VocabularyService.getUserVocabulary(userId, languageFilter);
            
            if (vocabulary.length < 4) {
                console.error('Not enough vocabulary for practice');
                return null;
            }

            // Create session in database
            const { data: sessionData, error } = await supabase
                .from('quiz_sessions')
                .insert({
                    user_id: userId,
                    started_at: new Date().toISOString(),
                    score: 0
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating session:', error);
                return null;
            }

            // Generate questions with variety
            const questions = await this.generateVariedQuestions(vocabulary, questionCount);

            this.currentSession = {
                id: sessionData.id,
                userId,
                startedAt: new Date(sessionData.started_at),
                totalQuestions: questionCount,
                correctAnswers: 0,
                currentQuestion: 0,
                questions,
                isCompleted: false
            };

            return this.currentSession;
        } catch (error) {
            console.error('Error starting practice session:', error);
            return null;
        }
    }

    /**
     * Generate varied questions for engagement
     */
    private async generateVariedQuestions(vocabulary: SavedWord[], count: number): Promise<QuizQuestion[]> {
        const questions: QuizQuestion[] = [];
        const usedWords = new Set<string>();
        
        // Define question type distribution for variety
        const questionTypeDistribution = [
            { type: 'translation' as const, weight: 0.2 },
            { type: 'reverse_translation' as const, weight: 0.2 },
            { type: 'multiple_choice' as const, weight: 0.15 },
            { type: 'listening' as const, weight: 0.1 },
            { type: 'context' as const, weight: 0.2 },
            { type: 'pronunciation' as const, weight: 0.05 },
            { type: 'typing' as const, weight: 0.05 },
            { type: 'recording' as const, weight: 0.05 }
        ];

        // Helper to get random question type based on weights
        const getRandomQuestionType = (): QuizQuestion['type'] => {
            const random = Math.random();
            let cumulativeWeight = 0;
            
            for (const { type, weight } of questionTypeDistribution) {
                cumulativeWeight += weight;
                if (random < cumulativeWeight) {
                    return type;
                }
            }
            
            return 'translation'; // Fallback
        };

        for (let i = 0; i < count; i++) {
            // Select a random word that hasn't been used
            let word: SavedWord;
            do {
                word = vocabulary[Math.floor(Math.random() * vocabulary.length)];
            } while (usedWords.has(word.id) && usedWords.size < vocabulary.length);
            
            usedWords.add(word.id);

            // Select question type
            let type = getRandomQuestionType();
            
            // Validate question type for the word
            if (type === 'recording' && !SpeechService.isAvailable()) {
                type = 'pronunciation'; // Fallback if recording not available
            }

            if (type === 'typing' && word.translation.length > 20) {
                type = 'multiple_choice'; // Fallback for very long words
            }
            
            const question = await this.createQuestion(word, type, vocabulary);
            questions.push(question);
        }

        return questions;
    }

    /**
     * Create a question based on type
     */
    private async createQuestion(
        word: SavedWord, 
        type: QuizQuestion['type'], 
        vocabulary: SavedWord[]
    ): Promise<QuizQuestion> {
        // Generate proper example that includes the actual word
        const properExample = await this.generateProperHint(word);
        const fixedWord = {
            ...word,
            example: properExample || word.example
        };
        
        switch (type) {
            case 'translation':
                return this.createTranslationQuestion(fixedWord, vocabulary);
            case 'reverse_translation':
                return this.createReverseTranslationQuestion(fixedWord, vocabulary);
            case 'multiple_choice':
                return this.createMultipleChoiceQuestion(fixedWord, vocabulary);
            case 'listening':
                return this.createListeningQuestion(fixedWord, vocabulary);
            case 'context':
                return await this.createContextQuestionWithAPI(fixedWord, vocabulary);
            case 'pronunciation':
                return this.createRecordingQuestion(fixedWord, vocabulary);
            case 'typing':
                return this.createTypingQuestion(fixedWord);
            case 'recording':
                return this.createRecordingQuestion(fixedWord, vocabulary);
            default:
                return this.createTranslationQuestion(fixedWord, vocabulary);
        }
    }

    /**
     * Create translation question (show original, select translation)
     */
    private createTranslationQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.translation, vocabulary, 'translation');
        
        return {
            id: `${word.id}_translation`,
            type: 'translation',
            word,
            options,
            correctAnswer: word.translation,
            displayQuestion: `What is "${word.original}" in ${this.getLanguageName(word.language)}?`
        };
    }

    /**
     * Create reverse translation question (show translation, select original)
     */
    private createReverseTranslationQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.original, vocabulary, 'original');
        
        return {
            id: `${word.id}_reverse`,
            type: 'reverse_translation',
            word,
            options,
            correctAnswer: word.original,
            displayQuestion: `What is "${word.translation}" in English?`
        };
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    /**
     * Enhanced regex escaping that handles Unicode characters properly
     */
    private escapeRegexUnicode(string: string): string {
        // First escape regex special characters
        let escaped = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Handle Turkish and other special characters by creating character class alternatives
        const turkishMappings: Record<string, string> = {
            'ş': '[şs]',
            's': '[şs]',
            'ç': '[çc]',
            'c': '[çc]',
            'ı': '[ıi]',
            'i': '[ıi]',
            'ğ': '[ğg]',
            'g': '[ğg]',
            'ü': '[üu]',
            'u': '[üu]',
            'ö': '[öo]',
            'o': '[öo]'
        };
        
        // Apply Turkish character mappings
        for (const [char, pattern] of Object.entries(turkishMappings)) {
            escaped = escaped.replace(new RegExp(char, 'gi'), pattern);
        }
        
        return escaped;
    }

    /**
     * Create context question using example sentences
     */
    private async createContextQuestionWithAPI(word: SavedWord, vocabulary: SavedWord[]): Promise<QuizQuestion> {
        const category = WordCategorizer.getWordCategory(word.original);
        
        let contextSentence = '';
        let displayQuestion = `Complete the sentence in ${this.getLanguageName(word.language)}:`;
        
        try {
            // Use ExampleSentenceGenerator to get a proper example sentence
            // Use the English word (word.original) to get the example, then translate
            const example = await ExampleSentenceGenerator.getExampleSentence(
                word.original, // Use English word to get example
                word.language,
                async (text: string, targetLang: string) => {
                    return await TranslationService.translateText(text, targetLang, 'en');
                }
            );
            
            if (
                example &&
                example.source !== 'error_fallback' &&
                example.translated &&
                // Check if the translated sentence contains the target word
                new RegExp(`\\b${this.escapeRegex(word.translation)}\\b`, 'i').test(example.translated)
            ) {
                // Blank the correct answer in the translated sentence
                const blanked = example.translated.replace(
                    new RegExp(`\\b${this.escapeRegex(word.translation)}\\b`, 'gi'),
                    '_____' 
                );
                contextSentence = blanked;
                // Store the blanked sentence for both display and audio
                word.example = `${blanked}|${example.english}`;
            } else {
                // Fall back to generating a varied sentence with blank
                contextSentence = await this.generateVariedSentenceWithBlank(word);
                // Store the blanked sentence for both display and audio
                word.example = `${contextSentence}|`;
            }
        } catch (error) {
            console.error('Error creating context question:', error);
            contextSentence = await this.generateVariedSentenceWithBlank(word);
            // Store the blanked sentence for both display and audio
            word.example = `${contextSentence}|`;
        }
        
        // Generate options in target language
        const options = this.generateOptions(word.translation, vocabulary, 'translation');
        
        return {
            id: `${word.id}_context`,
            type: 'context',
            word,
            options,
            correctAnswer: word.translation,
            contextSentence,
            displayQuestion
        };
    }

    // Add this helper method
    private async generateTargetLanguageSentenceWithWord(word: SavedWord): Promise<string> {
        const contextTemplates = [
            `Yesterday I bought a beautiful ${word.original} at the market.`,
            `My friend gave me this ${word.original} as a birthday present.`,
            `I always keep my ${word.original} in a safe place.`,
            `The ${word.original} on the shelf belongs to my sister.`,
            `We need to find a new ${word.original} before the party.`
        ];
        
        const template = contextTemplates[Math.floor(Math.random() * contextTemplates.length)];
        
        try {
            const translated = await TranslationService.translateText(
                template, 
                word.language,
                'en'
            );
            return translated;
        } catch (error) {
            return this.generateTargetLanguageContext(word);
        }
    }

    private async generateVariedSentenceWithBlank(word: SavedWord): Promise<string> {
        // Generate varied sentence templates to avoid repetition
        const templates = [
            `I need a ${word.original}.`,
            `The ${word.original} is very useful.`,
            `Can you pass me the ${word.original}?`,
            `My ${word.original} is broken.`,
            `Where did you buy this ${word.original}?`,
            `I lost my ${word.original} yesterday.`,
            `This ${word.original} belongs to me.`,
            `The new ${word.original} works perfectly.`,
            `I'm looking for a good ${word.original}.`,
            `Have you seen my ${word.original}?`
        ];
        
        // Select a random template
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        try {
            const translated = await TranslationService.translateText(
                template, 
                word.language,
                'en'
            );
            // Replace the translated word with blank using Unicode-aware regex
            const blanked = translated.replace(
                new RegExp(`\\b${this.escapeRegexUnicode(word.translation)}\\b`, 'gi'),
                '_____'
            );
            
            // Ensure we actually have a blank in the sentence
            if (!blanked.includes('_____')) {
                // If blanking failed, use the fallback pattern
                return this.generateTargetLanguageContext(word);
            }
            
            return blanked;
        } catch (error) {
            // Ultimate fallback
            return this.generateTargetLanguageContext(word);
        }
    }

    /**
     * Generate context sentences in target language with proper fallbacks
     */
    private generateTargetLanguageContext(word: SavedWord): string {
        // Complete sentence patterns for all 44 supported languages
        const patterns: Record<string, string[]> = {
            'ar': [ // Arabic
                `_____ هنا.`,
                `أحتاج إلى _____.`,
                `أين _____؟`,
                `_____ جيد.`
            ],
            'bn': [ // Bengali
                `_____ এখানে আছে।`,
                `আমার _____ দরকার।`,
                `_____ কোথায়?`,
                `এই _____ ভাল।`
            ],
            'bg': [ // Bulgarian
                `_____ е тук.`,
                `Нуждая се от _____.`,
                `Къде е _____?`,
                `Харесвам _____.`
            ],
            'zh-CN': [ // Chinese Simplified
                `_____在这里。`,
                `我需要_____。`,
                `_____在哪里？`,
                `这个_____很好。`
            ],
            'zh-TW': [ // Chinese Traditional
                `_____在這裡。`,
                `我需要_____。`,
                `_____在哪裡？`,
                `這個_____很好。`
            ],
            'hr': [ // Croatian
                `_____ je ovdje.`,
                `Trebam _____.`,
                `Gdje je _____?`,
                `Sviđa mi se _____.`
            ],
            'cs': [ // Czech
                `_____ je tady.`,
                `Potřebuji _____.`,
                `Kde je _____?`,
                `Líbí se mi _____.`
            ],
            'da': [ // Danish
                `_____ er her.`,
                `Jeg har brug for _____.`,
                `Hvor er _____?`,
                `Jeg kan lide _____.`
            ],
            'nl': [ // Dutch
                `_____ is hier.`,
                `Ik heb _____ nodig.`,
                `Waar is _____?`,
                `Ik vind _____ leuk.`
            ],
            'tl': [ // Filipino
                `_____ ay nandito.`,
                `Kailangan ko ng _____.`,
                `Nasaan ang _____?`,
                `Gusto ko ang _____.`
            ],
            'fi': [ // Finnish
                `_____ on täällä.`,
                `Tarvitsen _____.`,
                `Missä _____ on?`,
                `Pidän _____.`
            ],
            'fr': [ // French
                `Le _____ est ici.`,
                `J'ai besoin d'un _____.`,
                `Où est le _____ ?`,
                `J'aime le _____.`
            ],
            'de': [ // German
                `Der _____ ist hier.`,
                `Ich brauche einen _____.`,
                `Wo ist der _____?`,
                `Ich mag den _____.`
            ],
            'el': [ // Greek
                `_____ είναι εδώ.`,
                `Χρειάζομαι _____.`,
                `Πού είναι _____?`,
                `Μου αρέσει _____.`
            ],
            'gu': [ // Gujarati
                `_____ અહીં છે.`,
                `મને _____ જોઈએ છે.`,
                `_____ ક્યાં છે?`,
                `આ _____ સારું છે.`
            ],
            'he': [ // Hebrew
                `_____ נמצא כאן.`,
                `אני צריך _____.`,
                `איפה _____?`,
                `אני אוהב _____.`
            ],
            'hi': [ // Hindi
                `_____ यहाँ है।`,
                `मुझे _____ चाहिए।`,
                `_____ कहाँ है?`,
                `यह _____ अच्छा है।`
            ],
            'hu': [ // Hungarian
                `_____ itt van.`,
                `Szükségem van _____.`,
                `Hol van _____?`,
                `Szeretem _____.`
            ],
            'is': [ // Icelandic
                `_____ er hér.`,
                `Ég þarf _____.`,
                `Hvar er _____?`,
                `Mér líkar _____.`
            ],
            'id': [ // Indonesian
                `_____ ada di sini.`,
                `Saya butuh _____.`,
                `Di mana _____?`,
                `_____ ini bagus.`
            ],
            'it': [ // Italian
                `Il _____ è qui.`,
                `Ho bisogno di un _____.`,
                `Dov'è il _____?`,
                `Mi piace il _____.`
            ],
            'ja': [ // Japanese
                `_____はここにあります。`,
                `_____が必要です。`,
                `_____はどこですか？`,
                `この_____は良いです。`
            ],
            'ko': [ // Korean
                `_____이 여기 있습니다.`,
                `_____이 필요합니다.`,
                `_____이 어디에 있나요?`,
                `이 _____은 좋습니다.`
            ],
            'la': [ // Latin
                `_____ hic est.`,
                `_____ mihi opus est.`,
                `Ubi est _____?`,
                `_____ mihi placet.`
            ],
            'ms': [ // Malay
                `_____ ada di sini.`,
                `Saya perlukan _____.`,
                `Di mana _____?`,
                `_____ ini bagus.`
            ],
            'no': [ // Norwegian
                `_____ er her.`,
                `Jeg trenger _____.`,
                `Hvor er _____?`,
                `Jeg liker _____.`
            ],
            'fa': [ // Persian (Farsi)
                `_____ اینجاست.`,
                `من به _____ نیاز دارم.`,
                `_____ کجاست؟`,
                `من _____ را دوست دارم.`
            ],
            'pl': [ // Polish
                `_____ jest tutaj.`,
                `Potrzebuję _____.`,
                `Gdzie jest _____?`,
                `Lubię _____.`
            ],
            'pt': [ // Portuguese
                `O _____ está aqui.`,
                `Eu preciso de um _____.`,
                `Onde está o _____?`,
                `Eu gosto do _____.`
            ],
            'pa': [ // Punjabi
                `_____ ਇੱਥੇ ਹੈ।`,
                `ਮੈਨੂੰ _____ ਦੀ ਲੋੜ ਹੈ।`,
                `_____ ਕਿੱਥੇ ਹੈ?`,
                `ਇਹ _____ ਚੰਗਾ ਹੈ।`
            ],
            'ro': [ // Romanian
                `_____ este aici.`,
                `Am nevoie de _____.`,
                `Unde este _____?`,
                `Îmi place _____.`
            ],
            'ru': [ // Russian
                `_____ здесь.`,
                `Мне нужен _____.`,
                `Где _____?`,
                `Мне нравится _____.`
            ],
            'sr': [ // Serbian
                `_____ је овде.`,
                `Требам _____.`,
                `Где је _____?`,
                `Свиђа ми се _____.`
            ],
            'sk': [ // Slovak
                `_____ je tu.`,
                `Potrebujem _____.`,
                `Kde je _____?`,
                `Páči sa mi _____.`
            ],
            'es': [ // Spanish
                `El _____ está aquí.`,
                `Necesito un _____.`,
                `¿Dónde está el _____?`,
                `Me gusta el _____.`
            ],
            'sw': [ // Swahili
                `_____ iko hapa.`,
                `Ninahitaji _____.`,
                `_____ iko wapi?`,
                `Ninapenda _____.`
            ],
            'sv': [ // Swedish
                `_____ är här.`,
                `Jag behöver _____.`,
                `Var är _____?`,
                `Jag gillar _____.`
            ],
            'ta': [ // Tamil
                `_____ இங்கே இருக்கிறது.`,
                `எனக்கு _____ வேண்டும்.`,
                `_____ எங்கே?`,
                `இந்த _____ நல்லது.`
            ],
            'te': [ // Telugu
                `_____ ఇక్కడ ఉంది.`,
                `నాకు _____ కావాలి.`,
                `_____ ఎక్కడ ఉంది?`,
                `ఈ _____ బాగుంది.`
            ],
            'th': [ // Thai
                `_____ อยู่ที่นี่`,
                `ฉันต้องการ _____`,
                `_____ อยู่ที่ไหน?`,
                `_____ นี้ดี`
            ],
            'tr': [ // Turkish
                `_____ burada.`,
                `Bir _____ istiyorum.`,
                `_____ nerede?`,
                `Bu _____ güzel.`
            ],
            'uk': [ // Ukrainian
                `_____ тут.`,
                `Мені потрібен _____.`,
                `Де _____?`,
                `Мені подобається _____.`
            ],
            'ur': [ // Urdu
                `_____ یہاں ہے۔`,
                `مجھے _____ چاہیے۔`,
                `_____ کہاں ہے؟`,
                `یہ _____ اچھا ہے۔`
            ],
            'vi': [ // Vietnamese
                `_____ ở đây.`,
                `Tôi cần _____.`,
                `_____ ở đâu?`,
                `Tôi thích _____.`
            ]
        };
        
        // Get patterns for the language
        let langPatterns = patterns[word.language];
        
        // If no specific patterns for this language, this should never happen now
        // but we'll keep a fallback that logs an error
        if (!langPatterns) {
            console.error(`CRITICAL: No patterns found for supported language: ${word.language}`);
            // Use Spanish as emergency fallback (better than English)
            langPatterns = patterns['es'];
        }
        
        return langPatterns[Math.floor(Math.random() * langPatterns.length)];
    }

    private async generateProperHint(word: SavedWord): Promise<string | undefined> {
        try {
            // PRIORITY 1: Try ExampleSentenceGenerator with multiple strategies
            const exampleHint = await this.tryExampleSentenceGenerator(word);
            if (exampleHint) {
                return exampleHint;
            }
            
            // PRIORITY 2: Try with different search terms if compound word
            if (word.original.includes(' ')) {
                const alternativeHint = await this.tryAlternativeSearchTerms(word);
                if (alternativeHint) {
                    return alternativeHint;
                }
            }
            
            // PRIORITY 3: Try contextual templates only if ExampleSentenceGenerator fails
            const contextualHint = await this.generateContextualHint(word);
            if (contextualHint) {
                return contextualHint;
            }
            
            // LAST RESORT: Simple templates (should rarely be reached)
            console.warn(`Falling back to simple template for word: ${word.original}`);
            return await this.generateSimpleHint(word);
            
        } catch (error) {
            console.error('Error generating hint:', error);
            return await this.generateSimpleHint(word);
        }
    }
    
    /**
     * Try ExampleSentenceGenerator with enhanced validation and correction
     */
    private async tryExampleSentenceGenerator(word: SavedWord): Promise<string | null> {
        try {
            const example = await ExampleSentenceGenerator.getExampleSentence(
                word.original,
                word.language,
                async (text: string, targetLang: string) => {
                    return await TranslationService.translateText(text, targetLang, 'en');
                }
            );
            
            // Accept more sources, but validate them properly
            if (example && 
                example.source !== 'error_fallback' && 
                example.translated && 
                example.english) {
                
                // First check: Does it contain our exact word?
                if (new RegExp(`\\b${this.escapeRegexUnicode(word.translation)}\\b`, 'i').test(example.translated)) {
                    // Validate context appropriateness
                    if (!this.isContextuallyInappropriate(example.english, word.original)) {
                        return `${example.translated}|${example.english}`;
                    }
                }
                
                // Second check: Can we correct synonyms to our exact word?
                const correctedSentence = await this.correctWordInSentence(example.translated, word);
                if (correctedSentence && !this.isContextuallyInappropriate(example.english, word.original)) {
                    return `${correctedSentence}|${example.english}`;
                }
                
                // Third check: If it's a good sentence but wrong word, try to force replace
                if (!this.isContextuallyInappropriate(example.english, word.original)) {
                    const forcedCorrection = await this.forceWordReplacement(example.translated, word);
                    if (forcedCorrection) {
                        return `${forcedCorrection}|${example.english}`;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('ExampleSentenceGenerator error:', error);
            return null;
        }
    }
    
    /**
     * Try alternative search terms for compound words
     */
    private async tryAlternativeSearchTerms(word: SavedWord): Promise<string | null> {
        const words = word.original.split(' ');
        const searchTerms = [
            words[words.length - 1], // Last word
            words[0], // First word
            words.slice(1).join(' ') // Everything except first word
        ];
        
        for (const searchTerm of searchTerms) {
            if (searchTerm.length < 3) continue; // Skip very short terms
            
            try {
                const example = await ExampleSentenceGenerator.getExampleSentence(
                    searchTerm,
                    word.language,
                    async (text: string, targetLang: string) => {
                        return await TranslationService.translateText(text, targetLang, 'en');
                    }
                );
                
                if (example && 
                    example.source !== 'error_fallback' && 
                    example.translated && 
                    example.english &&
                    !this.isContextuallyInappropriate(example.english, word.original)) {
                    
                    // Try to replace the search term with our full word
                    const adaptedSentence = await this.adaptSentenceForWord(example.translated, example.english, word, searchTerm);
                    if (adaptedSentence) {
                        return adaptedSentence;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        return null;
    }
    
    /**
     * Force word replacement when we have a good sentence but wrong word
     */
    private async forceWordReplacement(sentence: string, word: SavedWord): Promise<string | null> {
        // Find potential words to replace (nouns, typically)
        const words = sentence.split(' ');
        
        // Look for words that might be nouns (capitalized in German, or common patterns)
        for (let i = 0; i < words.length; i++) {
            const currentWord = words[i];
            
            // Skip articles, prepositions, etc.
            if (currentWord.length < 3) continue;
            
            // Try replacing this word with our target word
            const testSentence = [...words];
            testSentence[i] = word.translation;
            const result = testSentence.join(' ');
            
            // Basic validation - does it still make grammatical sense?
            if (this.isGrammaticallyValid(result, word.language)) {
                return result;
            }
        }
        
        return null;
    }
    
    /**
     * Adapt a sentence found with a search term to use our full word
     */
    private async adaptSentenceForWord(translatedSentence: string, englishSentence: string, word: SavedWord, searchTerm: string): Promise<string | null> {
        // Try to replace the search term with our full word in the translated sentence
        const searchTermRegex = new RegExp(`\\b${this.escapeRegexUnicode(searchTerm)}\\b`, 'gi');
        
        if (searchTermRegex.test(translatedSentence)) {
            const adapted = translatedSentence.replace(searchTermRegex, word.translation);
            
            // Validate the adapted sentence
            if (this.isGrammaticallyValid(adapted, word.language)) {
                // Also adapt the English sentence
                const adaptedEnglish = englishSentence.replace(
                    new RegExp(`\\b${this.escapeRegexUnicode(searchTerm)}\\b`, 'gi'),
                    word.original
                );
                return `${adapted}|${adaptedEnglish}`;
            }
        }
        
        return null;
    }
    
    /**
     * Basic grammatical validation
     */
    private isGrammaticallyValid(sentence: string, language: string): boolean {
        // Basic checks for common grammatical issues
        const sentenceLower = sentence.toLowerCase();
        
        // Check for repeated words
        const words = sentenceLower.split(' ');
        for (let i = 0; i < words.length - 1; i++) {
            if (words[i] === words[i + 1] && words[i].length > 2) {
                return false; // Repeated words
            }
        }
        
        // Language-specific basic validation
        switch (language) {
            case 'de':
                // German: Check for basic article-noun agreement issues
                if (sentenceLower.includes('der die') || sentenceLower.includes('die der')) {
                    return false;
                }
                break;
            case 'es':
                // Spanish: Check for basic gender agreement issues
                if (sentenceLower.includes('el la') || sentenceLower.includes('la el')) {
                    return false;
                }
                break;
        }
        
        return true;
    }
    
    /**
     * Generate contextually appropriate hint using word categories and semantic matching
     * This should only be used when ExampleSentenceGenerator fails
     */
    private async generateContextualHint(word: SavedWord): Promise<string | null> {
        console.log(`Using contextual templates for word: ${word.original} (ExampleSentenceGenerator failed)`);
        
        const category = WordCategorizer.getWordCategory(word.original);
        
        // Get contextually appropriate templates based on word category
        const templates = this.getContextualTemplates(word.original, category);
        
        for (const template of templates) {
            try {
                const englishSentence = template.replace(/{word}/g, word.original);
                
                // Translate the sentence
                const translatedSentence = await TranslationService.translateText(
                    englishSentence,
                    word.language,
                    'en'
                );
                
                // Check if the translation contains our exact target word
                if (new RegExp(`\\b${this.escapeRegexUnicode(word.translation)}\\b`, 'i').test(translatedSentence)) {
                    return `${translatedSentence}|${englishSentence}`;
                }
                
                // If not exact match, try to replace any synonym with our exact word
                const correctedSentence = await this.correctWordInSentence(translatedSentence, word);
                if (correctedSentence && correctedSentence !== translatedSentence) {
                    return `${correctedSentence}|${englishSentence}`;
                }
                
            } catch (error) {
                continue; // Try next template
            }
        }
        
        return null;
    }
    
    /**
     * Get contextually appropriate templates based on word category
     */
    private getContextualTemplates(word: string, category: string | null): string[] {
        const wordLower = word.toLowerCase();
        
        // Specific templates for common problematic words
        const specificTemplates: Record<string, string[]> = {
            'glasses': [
                `I need new {word} to see better.`,
                `My {word} are broken.`,
                `Where are my {word}?`,
                `These {word} are too small.`
            ],
            'remote': [
                `The TV {word} is not working.`,
                `I can't find the {word} control.`,
                `This {word} has many buttons.`,
                `The {word} needs new batteries.`
            ],
            'top': [
                `This {word} is comfortable.`,
                `I bought a new {word} yesterday.`,
                `The {word} is too tight.`,
                `This {word} matches my pants.`
            ],
            'chair': [
                `The {word} is very comfortable.`,
                `I need a new {word} for my desk.`,
                `This {word} is broken.`,
                `The {word} is too high.`
            ]
        };
        
        // Return specific templates if available
        if (specificTemplates[wordLower]) {
            return specificTemplates[wordLower];
        }
        
        // Category-based templates
        switch (category) {
            case 'clothing':
                return [
                    `This {word} fits perfectly.`,
                    `I bought a new {word} yesterday.`,
                    `The {word} is very comfortable.`,
                    `This {word} is my favorite.`
                ];
            case 'furniture':
                return [
                    `The {word} is in the living room.`,
                    `I need a new {word} for my home.`,
                    `This {word} is very comfortable.`,
                    `The {word} is made of wood.`
                ];
            case 'electronics':
                return [
                    `The {word} is not working properly.`,
                    `I bought a new {word} yesterday.`,
                    `This {word} is very useful.`,
                    `The {word} needs to be charged.`
                ];
            case 'food':
                return [
                    `This {word} tastes delicious.`,
                    `I want to eat some {word}.`,
                    `The {word} is fresh.`,
                    `I bought {word} at the market.`
                ];
            case 'tools':
                return [
                    `I need this {word} for work.`,
                    `The {word} is very useful.`,
                    `This {word} is broken.`,
                    `I can't find my {word}.`
                ];
            default:
                return [
                    `I have a {word}.`,
                    `The {word} is here.`,
                    `This {word} is useful.`,
                    `I need a {word}.`
                ];
        }
    }
    
    /**
     * Validate and fix hints from ExampleSentenceGenerator
     */
    private async validateAndFixHint(translatedSentence: string, englishSentence: string, word: SavedWord): Promise<string | null> {
        // Check if sentence makes contextual sense (basic validation)
        if (this.isContextuallyInappropriate(englishSentence, word.original)) {
            return null;
        }
        
        // Check if our exact word is in the translated sentence
        if (new RegExp(`\\b${this.escapeRegexUnicode(word.translation)}\\b`, 'i').test(translatedSentence)) {
            return `${translatedSentence}|${englishSentence}`;
        }
        
        // Try to correct the word in the sentence
        const correctedSentence = await this.correctWordInSentence(translatedSentence, word);
        if (correctedSentence) {
            return `${correctedSentence}|${englishSentence}`;
        }
        
        return null;
    }
    
    /**
     * Check if a sentence is contextually inappropriate for a word
     */
    private isContextuallyInappropriate(sentence: string, word: string): boolean {
        const sentenceLower = sentence.toLowerCase();
        const wordLower = word.toLowerCase();
        
        // Specific inappropriate contexts
        const inappropriateContexts: Record<string, string[]> = {
            'remote': ['looks nice on you', 'wear', 'fits', 'comfortable to wear'],
            'table': ['on the table next to', 'table is on the table'],
            'chair': ['looks nice on you', 'wear'],
            'glasses': ['tastes', 'eat', 'drink'],
            'food': ['wear', 'looks nice on you']
        };
        
        const inappropriate = inappropriateContexts[wordLower];
        if (inappropriate) {
            return inappropriate.some(context => sentenceLower.includes(context));
        }
        
        // General inappropriate patterns
        const generalInappropriate = [
            'table is on the table',
            'chair is on the chair',
            'looks nice on you' // for non-wearable items
        ];
        
        return generalInappropriate.some(pattern => sentenceLower.includes(pattern));
    }
    
    /**
     * Try to correct synonyms/variants in translated sentence with exact answer word
     */
    private async correctWordInSentence(sentence: string, word: SavedWord): Promise<string | null> {
        // Common synonym mappings for problematic words
        const synonymMappings: Record<string, Record<string, string[]>> = {
            'de': {
                'Spitze': ['Oberteil', 'Top'],
                'Gläser': ['Brille'],
                'Stuhl': ['Sessel']
            },
            'es': {
                'silla': ['asiento'],
                'gafas': ['anteojos', 'lentes']
            },
            'fr': {
                'chaise': ['siège'],
                'lunettes': ['verres']
            }
        };
        
        const langMappings = synonymMappings[word.language];
        if (langMappings && langMappings[word.translation]) {
            let correctedSentence = sentence;
            const synonyms = langMappings[word.translation];
            
            for (const synonym of synonyms) {
                const synonymRegex = new RegExp(`\\b${this.escapeRegexUnicode(synonym)}\\b`, 'gi');
                if (synonymRegex.test(correctedSentence)) {
                    correctedSentence = correctedSentence.replace(synonymRegex, word.translation);
                    return correctedSentence;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Generate a simple, guaranteed correct hint as absolute final fallback
     * This should rarely be reached if ExampleSentenceGenerator is working properly
     */
    private async generateSimpleHint(word: SavedWord): Promise<string> {
        console.warn(`Using simple template fallback for word: ${word.original} - this should be rare!`);
        
        // Ultra-simple templates that always work
        const simpleTemplates = [
            `This is a ${word.original}.`,
            `I have a ${word.original}.`,
            `The ${word.original} is here.`
        ];
        
        const template = simpleTemplates[Math.floor(Math.random() * simpleTemplates.length)];
        
        try {
            const translated = await TranslationService.translateText(
                template,
                word.language,
                'en'
            );
            
            // Force replace with our exact word if translation differs
            const corrected = translated.replace(
                new RegExp(`\\b[^\\s]+\\b(?=\\s|$)`, 'i'),
                word.translation
            );
            
            return `${corrected}|${template}`;
        } catch (error) {
            // Ultimate fallback - no translation needed
            return `${word.translation}.|This is ${word.original}.`;
        }
    }

    // Add these helper methods for proper article handling:
    private getGermanArticle(word: SavedWord): string {
        // Special cases for German
        if (word.original.toLowerCase() === 'glasses') return 'eine';
        if (word.original.toLowerCase() === 'person') return 'eine';
        if (word.original.toLowerCase() === 'top') return 'ein';
        // Default
        return 'ein';
    }

    private getFrenchArticleWithDe(word: string): string {
        if (word.endsWith('e')) return "d'une";
        return "d'un";
    }

    private getSpanishArticleWithEl(word: string): string {
        if (word.endsWith('a')) return 'la';
        return 'el';
    }

    private getItalianArticleWithIl(word: string): string {
        if (word.endsWith('a')) return 'la';
        return 'il';
    }

    /**
     * Create recording pronunciation question
     */
    private createRecordingQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        return {
            id: `${word.id}_recording`,
            type: 'recording',
            word,
            correctAnswer: word.translation,
            displayQuestion: `Record yourself saying "${word.translation}" in ${this.getLanguageName(word.language)}`
        };
    }

    /**
     * Create multiple choice question
     */
    private createMultipleChoiceQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.translation, vocabulary, 'translation');
        
        return {
            id: `${word.id}_multiple`,
            type: 'multiple_choice',
            word,
            options,
            correctAnswer: word.translation,
            displayQuestion: `Select the ${this.getLanguageName(word.language)} translation for "${word.original}":`
        };
    }

    /**
     * Create listening question
     */
    private createListeningQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.original, vocabulary, 'original');
        
        return {
            id: `${word.id}_listening`,
            type: 'listening',
            word,
            options,
            correctAnswer: word.original,
            displayQuestion: 'Listen and select the correct word:'
        };
    }

    /**
     * Create typing question
     */
    private createTypingQuestion(word: SavedWord): QuizQuestion {
        return {
            id: `${word.id}_typing`,
            type: 'typing',
            word,
            correctAnswer: word.translation,
            displayQuestion: `Type "${word.original}" in ${this.getLanguageName(word.language)}:`
        };
    }

    /**
     * Generate options for multiple choice questions
     */
    private generateOptions(
        correct: string, 
        vocabulary: SavedWord[], 
        field: 'original' | 'translation'
    ): string[] {
        const options = [correct];
        const used = new Set([correct.toLowerCase()]);
        
        // Get words in the same language for better distractors
        const sameLanguageWords = vocabulary.filter(w => 
            field === 'translation' ? w.language === vocabulary[0].language : true
        );
        
        // Add 3 wrong options
        while (options.length < 4 && sameLanguageWords.length > options.length) {
            const randomWord = sameLanguageWords[Math.floor(Math.random() * sameLanguageWords.length)];
            const option = randomWord[field];
            
            if (!used.has(option.toLowerCase())) {
                options.push(option);
                used.add(option.toLowerCase());
            }
        }
        
        // Shuffle options
        return options.sort(() => Math.random() - 0.5);
    }

    /**
     * Get language name from code
     */
    private getLanguageName(code: string): string {
        const languages: Record<string, string> = {
            'ar': 'Arabic',
            'bn': 'Bengali',
            'bg': 'Bulgarian',
            'zh-CN': 'Chinese (Simplified)',
            'zh-TW': 'Chinese (Traditional)',
            'hr': 'Croatian',
            'cs': 'Czech',
            'da': 'Danish',
            'nl': 'Dutch',
            'tl': 'Filipino',
            'fi': 'Finnish',
            'fr': 'French',
            'de': 'German',
            'el': 'Greek',
            'gu': 'Gujarati',
            'he': 'Hebrew',
            'hi': 'Hindi',
            'hu': 'Hungarian',
            'is': 'Icelandic',
            'id': 'Indonesian',
            'it': 'Italian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'la': 'Latin',
            'ms': 'Malay',
            'no': 'Norwegian',
            'fa': 'Persian (Farsi)',
            'pl': 'Polish',
            'pt': 'Portuguese',
            'pa': 'Punjabi',
            'ro': 'Romanian',
            'ru': 'Russian',
            'sr': 'Serbian',
            'sk': 'Slovak',
            'es': 'Spanish',
            'sw': 'Swahili',
            'sv': 'Swedish',
            'ta': 'Tamil',
            'te': 'Telugu',
            'th': 'Thai',
            'tr': 'Turkish',
            'uk': 'Ukrainian',
            'ur': 'Urdu',
            'vi': 'Vietnamese'
        };
        
        return languages[code] || code;
    }

    /**
     * Submit answer for current question
     */
    async submitAnswer(answer: string): Promise<boolean> {
        if (!this.currentSession || this.currentSession.isCompleted) {
            return false;
        }

        const currentQuestion = this.currentSession.questions[this.currentSession.currentQuestion];
        currentQuestion.userAnswer = answer;
        currentQuestion.isCorrect = answer.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
        
        if (currentQuestion.isCorrect) {
            this.currentSession.correctAnswers++;
            
            // Update word proficiency
            const newProficiency = Math.min(100, currentQuestion.word.proficiency + 10);
            await VocabularyService.updateProficiency(currentQuestion.word.id, newProficiency);
        } else {
            // Decrease proficiency slightly for wrong answers
            const newProficiency = Math.max(0, currentQuestion.word.proficiency - 5);
            await VocabularyService.updateProficiency(currentQuestion.word.id, newProficiency);
        }

        return currentQuestion.isCorrect;
    }

    /**
     * Move to next question
     */
    nextQuestion(): QuizQuestion | null {
        if (!this.currentSession) return null;
        
        this.currentSession.currentQuestion++;
        
        if (this.currentSession.currentQuestion >= this.currentSession.totalQuestions) {
            this.completeSession();
            return null;
        }
        
        return this.currentSession.questions[this.currentSession.currentQuestion];
    }

    /**
     * Complete the current session
     */
    private async completeSession() {
        if (!this.currentSession) return;
        
        this.currentSession.isCompleted = true;
        
        // Calculate XP earned
        const correctAnswers = this.currentSession.correctAnswers;
        const totalQuestions = this.currentSession.totalQuestions;
        const baseXP = correctAnswers * 10;
        const bonusXP = totalQuestions === 20 ? 100 : totalQuestions === 10 ? 20 : 0;
        const totalXP = baseXP + bonusXP;
        
        // Update session in database with correct score and total questions
        const { error: sessionError } = await supabase
            .from('quiz_sessions')
            .update({
                score: correctAnswers,
                total_questions: totalQuestions
            })
            .eq('id', this.currentSession.id);

        if (sessionError) {
            console.error('Error updating session:', sessionError);
        }
        
        // Record XP earned
        if (totalXP > 0) {
            const { error: xpError } = await supabase
                .from('user_xp')
                .insert({
                    user_id: this.currentSession.userId,
                    xp_earned: totalXP,
                    source: 'practice',
                    session_id: this.currentSession.id
                });
            
            if (xpError) {
                console.error('Error recording XP:', xpError);
            }
        }
        
        // Update user streak
        await this.updateUserStreak(this.currentSession.userId);
    }

    /**
     * Update user's practice streak
     */
    private async updateUserStreak(userId: string) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('last_login, streak')
            .eq('user_id', userId)
            .single();
        
        if (profile) {
            const lastLogin = new Date(profile.last_login);
            const today = new Date();
            const daysDiff = Math.floor((today.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
            
            let newStreak = profile.streak || 0;
            if (daysDiff === 1) {
                newStreak++;
            } else if (daysDiff > 1) {
                newStreak = 1;
            }
            
            await supabase
                .from('profiles')
                .update({
                    streak: newStreak,
                    last_login: today.toISOString()
                })
                .eq('user_id', userId);
        }
    }



    /**
     * Get user's practice statistics
     */
    async getUserStats(userId: string): Promise<PracticeStats> {
        const { data: sessions } = await supabase
            .from('quiz_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('started_at', { ascending: false });
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('streak, last_login, total_xp')
            .eq('user_id', userId)
            .single();
        
        // Calculate language-specific stats
        const vocabulary = await VocabularyService.getUserVocabulary(userId);
        const languageStats: Record<string, { practiced: number; correct: number }> = {};
        
        let totalQuestions = 0;
        let correctAnswers = 0;
        
        sessions?.forEach(session => {
            correctAnswers += session.score || 0;
            totalQuestions += session.total_questions || 10;
        });
        
        return {
            totalSessions: sessions?.length || 0,
            totalQuestions,
            correctAnswers,
            accuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
            streak: profile?.streak || 0,
            lastPracticeDate: profile?.last_login || null,
            languageStats,
            totalXP: profile?.total_xp || 0
        };
    }

    /**
     * Get current session
     */
    getCurrentSession(): PracticeSession | null {
        return this.currentSession;
    }

    /**
     * Get current question
     */
    getCurrentQuestion(): QuizQuestion | null {
        if (!this.currentSession) return null;
        return this.currentSession.questions[this.currentSession.currentQuestion];
    }
}

export default new PracticeService();