import { supabase } from '../../database/config';
import VocabularyService, { SavedWord } from './VocabularyService';
import SpeechService from './SpeechService';
import ExampleSentenceGenerator from 'src/services/example-sentences/ExampleSentenceGenerator.js';
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
            const vocabulary = await VocabularyService.getUserVocabulary(userId);
            const languageCounts: Record<string, number> = {};
            
            vocabulary.forEach(word => {
                if (word.language) {
                    languageCounts[word.language] = (languageCounts[word.language] || 0) + 1;
                }
            });
            
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

    // Helper method for regex escaping:
    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Create context question using example sentences
     */
    private async createContextQuestionWithAPI(word: SavedWord, vocabulary: SavedWord[]): Promise<QuizQuestion> {
        const category = WordCategorizer.getWordCategory(word.original);
        
        let contextSentence = '';
        let displayQuestion = `Complete the sentence in ${this.getLanguageName(word.language)}:`;
        
        // First, try to get a sentence that contains the exact word
        let attempts = 0;
        let foundValidSentence = false;
        
        while (attempts < 3 && !foundValidSentence) {
            attempts++;
            
            // Generate a simple sentence that will definitely contain the word
            const templateSentences = {
                'de': [
                    `Ich brauche ${word.original === 'glasses' ? 'eine' : 'einen'} ${word.translation}.`,
                    `Das ist ${word.original === 'glasses' ? 'eine' : 'ein'} ${word.translation}.`,
                    `Wo ist ${word.original === 'glasses' ? 'die' : 'der'} ${word.translation}?`
                ],
                'fr': [
                    `J'ai besoin ${this.getFrenchArticle(word.translation)} ${word.translation}.`,
                    `C'est ${this.getFrenchArticle(word.translation)} ${word.translation}.`,
                    `Où est ${this.getFrenchArticle(word.translation)} ${word.translation}?`
                ],
                'es': [
                    `Necesito ${this.getSpanishArticle(word.translation)} ${word.translation}.`,
                    `Esto es ${this.getSpanishArticle(word.translation)} ${word.translation}.`,
                    `¿Dónde está ${this.getSpanishArticle(word.translation)} ${word.translation}?`
                ],
                'it': [
                    `Ho bisogno di ${this.getItalianArticle(word.translation)} ${word.translation}.`,
                    `Questo è ${this.getItalianArticle(word.translation)} ${word.translation}.`,
                    `Dov'è ${this.getItalianArticle(word.translation)} ${word.translation}?`
                ]
            };
            
            const templates = templateSentences[word.language as keyof typeof templateSentences] || [
                `This is a ${word.translation}.`,
                `I need a ${word.translation}.`,
                `Where is the ${word.translation}?`
            ];
            
            // Use a template sentence
            contextSentence = templates[Math.floor(Math.random() * templates.length)];
            
            // For non-template languages, translate
            if (!templateSentences[word.language as keyof typeof templateSentences]) {
                try {
                    const englishSentence = contextSentence.replace(word.translation, word.original);
                    contextSentence = await TranslationService.translateText(
                        englishSentence,
                        word.language,
                        'en'
                    );
                } catch (error) {
                    console.error('Translation error:', error);
                }
            }
            
            // Check if the sentence contains the exact word
            if (contextSentence.toLowerCase().includes(word.translation.toLowerCase())) {
                foundValidSentence = true;
                // Replace the word with blank
                contextSentence = contextSentence.replace(
                    new RegExp(`\\b${this.escapeRegex(word.translation)}\\b`, 'gi'),
                    '_____'
                );
            }
        }
        
        // If we still don't have a valid sentence, use a fallback
        if (!foundValidSentence) {
            console.warn(`Could not generate valid sentence for "${word.translation}"`);
            contextSentence = await this.generateTargetLanguageSentenceWithBlank(word);
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

    private getFrenchArticle(word: string): string {
        // Simple heuristic - you might want to expand this
        if (word.endsWith('e')) return 'une';
        return 'un';
    }

    private getSpanishArticle(word: string): string {
        if (word.endsWith('a')) return 'una';
        return 'un';
    }

    private getItalianArticle(word: string): string {
        if (word.endsWith('a')) return 'una';
        return 'un';
    }

    private async generateTargetLanguageSentenceWithBlank(word: SavedWord): Promise<string> {
        // Generate a simple sentence with blank in target language
        const simpleTemplate = `I need a ${word.original}.`;
        try {
            const translated = await TranslationService.translateText(
                simpleTemplate, 
                word.language,
                'en'
            );
            // Replace the translated word with blank
            return translated.replace(
                new RegExp(`\\b${this.escapeRegex(word.translation)}\\b`, 'gi'),
                '_____'
            );
        } catch (error) {
            // Ultimate fallback
            return this.generateTargetLanguageContext(word);
        }
    }

    /**
     * Generate context sentences in target language
     */
    private generateTargetLanguageContext(word: SavedWord): string {
        // Common sentence patterns that work across languages
        // The blank will be replaced with the translated word
        const patterns: Record<string, string[]> = {
            'es': [ // Spanish
                `El _____ está aquí.`,
                `Necesito un _____.`,
                `¿Dónde está el _____?`,
                `Me gusta el _____.`
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
            'it': [ // Italian
                `Il _____ è qui.`,
                `Ho bisogno di un _____.`,
                `Dov'è il _____?`,
                `Mi piace il _____.`
            ],
            'default': [ // Default pattern
                `_____ [${word.translation}]`, // Show translation as hint
            ]
        };
        
        const langPatterns = patterns[word.language] || patterns['default'];
        return langPatterns[Math.floor(Math.random() * langPatterns.length)];
    }

    
    private async generateProperHint(word: SavedWord): Promise<string | undefined> {
        try {
            // First, try to generate a simple sentence that definitely contains the exact word
            const simpleExamples = [
                `I see a ${word.original}.`,
                `This is a ${word.original}.`,
                `I need a ${word.original}.`,
                `Where is the ${word.original}?`,
                `The ${word.original} is here.`
            ];
            
            // Pick a random simple example
            const simpleExample = simpleExamples[Math.floor(Math.random() * simpleExamples.length)];
            
            // Translate it to get the exact word in context
            const translatedExample = await TranslationService.translateText(
                simpleExample,
                word.language,
                'en'
            );
            
            // Verify the translated example contains the EXACT word
            if (translatedExample.toLowerCase().includes(word.translation.toLowerCase())) {
                return `${translatedExample}|${simpleExample}`;
            }
            
            // If simple translation didn't work, try with forced word insertion
            const forcedTemplates: Record<string, string[]> = {
                'de': [
                    `Ich sehe ${this.getGermanArticle(word)} ${word.translation}.`,
                    `Das ist ${this.getGermanArticle(word)} ${word.translation}.`,
                    `Ich brauche ${this.getGermanArticle(word)} ${word.translation}.`,
                    `Wo ist ${this.getGermanArticle(word)} ${word.translation}?`
                ],
                'fr': [
                    `Je vois ${this.getFrenchArticle(word.translation)} ${word.translation}.`,
                    `C'est ${this.getFrenchArticle(word.translation)} ${word.translation}.`,
                    `J'ai besoin ${this.getFrenchArticleWithDe(word.translation)} ${word.translation}.`,
                    `Où est ${this.getFrenchArticle(word.translation)} ${word.translation}?`
                ],
                'es': [
                    `Veo ${this.getSpanishArticle(word.translation)} ${word.translation}.`,
                    `Esto es ${this.getSpanishArticle(word.translation)} ${word.translation}.`,
                    `Necesito ${this.getSpanishArticle(word.translation)} ${word.translation}.`,
                    `¿Dónde está ${this.getSpanishArticleWithEl(word.translation)} ${word.translation}?`
                ],
                'it': [
                    `Vedo ${this.getItalianArticle(word.translation)} ${word.translation}.`,
                    `Questo è ${this.getItalianArticle(word.translation)} ${word.translation}.`,
                    `Ho bisogno di ${this.getItalianArticle(word.translation)} ${word.translation}.`,
                    `Dov'è ${this.getItalianArticleWithIl(word.translation)} ${word.translation}?`
                ]
            };
            
            if (forcedTemplates[word.language]) {
                const templates = forcedTemplates[word.language];
                const forcedExample = templates[Math.floor(Math.random() * templates.length)];
                const englishEquivalent = simpleExample;
                return `${forcedExample}|${englishEquivalent}`;
            }
            
            // Ultimate fallback - just create a basic sentence with the word
            return `${word.translation}.|This is ${word.original}.`;
            
        } catch (error) {
            console.error('Error generating hint:', error);
            return word.example;
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